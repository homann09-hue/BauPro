-- BauPro role split:
-- admin = BauPro-Systemadmin (firmenuebergreifende Plattformverwaltung)
-- chef = Betriebsleiter der Firma (operative Firmenverwaltung)

create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = 'admin', false)
$$;

create or replace function public.can_manage_company()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = 'chef', false)
$$;

create or replace function public.has_employee_permission(p_permission_key text, p_profile_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case
    when p_permission_key in (
      'settings.edit',
      'users.permissions.manage',
      'billing.manage',
      'features.manage',
      'integrations.manage',
      'security.manage',
      'privacy.manage',
      'api.manage'
    ) then public.is_system_admin()
    when p_permission_key in (
      'quotes.view',
      'quotes.create',
      'prices.purchase.view',
      'prices.sales.view'
    ) then public.can_manage_company()
    when public.current_role() = 'chef' then true
    else exists (
      select 1
      from public.employee_permissions ep
      where ep.company_id = public.current_company_id()
        and ep.profile_id = coalesce(p_profile_id, auth.uid())
        and ep.permission_key = p_permission_key
        and ep.granted = true
    )
  end;
$$;

drop policy if exists "read own or managed employee permissions" on public.employee_permissions;
create policy "read own or systemadmin employee permissions"
on public.employee_permissions for select
to authenticated
using (
  company_id = public.current_company_id()
  and (public.is_system_admin() or profile_id = auth.uid())
);

drop policy if exists "managers insert employee permissions" on public.employee_permissions;
create policy "systemadmins insert employee permissions"
on public.employee_permissions for insert
to authenticated
with check (company_id = public.current_company_id() and public.is_system_admin());

drop policy if exists "managers update employee permissions" on public.employee_permissions;
create policy "systemadmins update employee permissions"
on public.employee_permissions for update
to authenticated
using (company_id = public.current_company_id() and public.is_system_admin())
with check (company_id = public.current_company_id() and public.is_system_admin());

drop policy if exists "managers delete employee permissions" on public.employee_permissions;
create policy "systemadmins delete employee permissions"
on public.employee_permissions for delete
to authenticated
using (company_id = public.current_company_id() and public.is_system_admin());

drop policy if exists "managers read employee permission audit" on public.employee_permission_audit_log;
create policy "systemadmins read employee permission audit"
on public.employee_permission_audit_log for select
to authenticated
using (company_id = public.current_company_id() and public.is_system_admin());

drop policy if exists "managers create employee permission audit" on public.employee_permission_audit_log;
create policy "systemadmins create employee permission audit"
on public.employee_permission_audit_log for insert
to authenticated
with check (company_id = public.current_company_id() and public.is_system_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_company_id uuid;
  requested_role text;
begin
  target_company_id := nullif(new.raw_user_meta_data->>'company_id', '')::uuid;
  requested_role := coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'chef');

  if requested_role not in ('admin', 'chef', 'vorarbeiter', 'mitarbeiter', 'kunde') then
    requested_role := 'mitarbeiter';
  end if;

  if target_company_id is null then
    insert into public.companies (name, created_by)
    values (coalesce(nullif(new.raw_user_meta_data->>'company_name', ''), 'Meine Firma'), new.id)
    returning id into target_company_id;

    requested_role := 'chef';
  end if;

  insert into public.profiles (id, company_id, email, full_name, role)
  values (
    new.id,
    target_company_id,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    requested_role
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    company_id = excluded.company_id,
    role = excluded.role,
    active = true;

  return new;
end;
$$;

notify pgrst, 'reload schema';
