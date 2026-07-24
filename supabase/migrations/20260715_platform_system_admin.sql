-- BauPro platform system-admin hardening.
--
-- admin = firmenuebergreifender BauPro-Systemadministrator.
-- chef = operative Betriebsleitung einer einzelnen Firma.
--
-- Systemadmins duerfen Firmen-/Benutzer-/Rechte-/Audit-Metadaten ueber Firmen hinweg
-- verwalten. Operative Firmendaten wie Baustellen, Kunden, Lager und Preise bleiben
-- weiterhin ueber die bestehenden Chef-/Mitarbeiter-Policies firmenscharf begrenzt.

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

drop policy if exists "systemadmins read all companies" on public.companies;
create policy "systemadmins read all companies"
on public.companies for select
to authenticated
using (public.is_system_admin());

drop policy if exists "systemadmins create companies" on public.companies;
create policy "systemadmins create companies"
on public.companies for insert
to authenticated
with check (public.is_system_admin());

drop policy if exists "systemadmins update all companies" on public.companies;
create policy "systemadmins update all companies"
on public.companies for update
to authenticated
using (public.is_system_admin())
with check (public.is_system_admin());

drop policy if exists "systemadmins read all profiles" on public.profiles;
create policy "systemadmins read all profiles"
on public.profiles for select
to authenticated
using (public.is_system_admin());

drop policy if exists "systemadmins insert profiles" on public.profiles;
create policy "systemadmins insert profiles"
on public.profiles for insert
to authenticated
with check (public.is_system_admin());

drop policy if exists "systemadmins update profiles" on public.profiles;
create policy "systemadmins update profiles"
on public.profiles for update
to authenticated
using (public.is_system_admin())
with check (public.is_system_admin());

create table if not exists public.employee_permissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  permission_key text not null check (
    permission_key in (
      'orders.view',
      'orders.create',
      'orders.edit',
      'orders.delete',
      'customers.view',
      'customers.edit',
      'customer_requests.view',
      'customer_requests.edit',
      'inventory.view',
      'inventory.edit',
      'materials.order',
      'time.team.view',
      'time.team.edit',
      'photos.upload',
      'photos.delete',
      'reports.create',
      'reports.approve',
      'vehicles.manage'
    )
  ),
  granted boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, profile_id, permission_key)
);

create table if not exists public.employee_permission_audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  target_profile_id uuid not null references public.profiles(id) on delete cascade,
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists employee_permissions_profile_idx
  on public.employee_permissions(company_id, profile_id);

create index if not exists employee_permissions_key_idx
  on public.employee_permissions(company_id, permission_key)
  where granted = true;

create index if not exists employee_permission_audit_company_created_idx
  on public.employee_permission_audit_log(company_id, created_at desc);

alter table public.employee_permissions enable row level security;
alter table public.employee_permissions force row level security;
alter table public.employee_permission_audit_log enable row level security;
alter table public.employee_permission_audit_log force row level security;

create or replace function public.assert_employee_permission_change_allowed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_company_id uuid;
  target_profile_id uuid;
  target_role text;
begin
  if tg_op = 'DELETE' then
    target_company_id := old.company_id;
    target_profile_id := old.profile_id;
  else
    target_company_id := new.company_id;
    target_profile_id := new.profile_id;
  end if;

  if not public.is_system_admin() then
    raise exception 'Keine Berechtigung fuer diese Rechteaenderung.';
  end if;

  if target_profile_id = auth.uid() then
    raise exception 'Eigene Rechte koennen nicht geaendert werden.';
  end if;

  select role
    into target_role
  from public.profiles
  where id = target_profile_id
    and company_id = target_company_id;

  if target_role is null then
    raise exception 'Mitarbeiter wurde nicht gefunden.';
  end if;

  if target_role in ('admin', 'chef') then
    raise exception 'Systemadmin- und Chef-Rollen koennen nicht ueber Mitarbeiterrechte geaendert werden.';
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new.company_id := target_company_id;
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_employee_permission_changes on public.employee_permissions;
create trigger guard_employee_permission_changes
before insert or update or delete on public.employee_permissions
for each row execute function public.assert_employee_permission_change_allowed();

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

grant execute on function public.has_employee_permission(text, uuid) to authenticated;

drop policy if exists "read own or managed employee permissions" on public.employee_permissions;
drop policy if exists "read own or systemadmin employee permissions" on public.employee_permissions;
create policy "read own or systemadmin employee permissions"
on public.employee_permissions for select
to authenticated
using (
  public.is_system_admin()
  or (company_id = public.current_company_id() and profile_id = auth.uid())
);

drop policy if exists "managers insert employee permissions" on public.employee_permissions;
drop policy if exists "systemadmins insert employee permissions" on public.employee_permissions;
create policy "systemadmins insert employee permissions"
on public.employee_permissions for insert
to authenticated
with check (public.is_system_admin());

drop policy if exists "managers update employee permissions" on public.employee_permissions;
drop policy if exists "systemadmins update employee permissions" on public.employee_permissions;
create policy "systemadmins update employee permissions"
on public.employee_permissions for update
to authenticated
using (public.is_system_admin())
with check (public.is_system_admin());

drop policy if exists "managers delete employee permissions" on public.employee_permissions;
drop policy if exists "systemadmins delete employee permissions" on public.employee_permissions;
create policy "systemadmins delete employee permissions"
on public.employee_permissions for delete
to authenticated
using (public.is_system_admin());

drop policy if exists "managers read employee permission audit" on public.employee_permission_audit_log;
drop policy if exists "systemadmins read employee permission audit" on public.employee_permission_audit_log;
create policy "systemadmins read employee permission audit"
on public.employee_permission_audit_log for select
to authenticated
using (public.is_system_admin());

drop policy if exists "managers create employee permission audit" on public.employee_permission_audit_log;
drop policy if exists "systemadmins create employee permission audit" on public.employee_permission_audit_log;
create policy "systemadmins create employee permission audit"
on public.employee_permission_audit_log for insert
to authenticated
with check (public.is_system_admin());

drop policy if exists "systemadmins read company audit log" on public.company_audit_log;
create policy "systemadmins read company audit log"
on public.company_audit_log for select
to authenticated
using (public.is_system_admin());

drop policy if exists "systemadmins create company audit log" on public.company_audit_log;
create policy "systemadmins create company audit log"
on public.company_audit_log for insert
to authenticated
with check (public.is_system_admin());

do $$
begin
  if to_regclass('public.privacy_requests') is not null then
    drop policy if exists "systemadmins read privacy requests" on public.privacy_requests;
    create policy "systemadmins read privacy requests"
    on public.privacy_requests for select
    to authenticated
    using (public.is_system_admin());

    drop policy if exists "systemadmins update privacy requests" on public.privacy_requests;
    create policy "systemadmins update privacy requests"
    on public.privacy_requests for update
    to authenticated
    using (public.is_system_admin())
    with check (public.is_system_admin());
  end if;
end $$;

comment on function public.is_system_admin() is
  'BauPro-Plattformrolle: admin verwaltet Firmen, Nutzer, Rechte, Abrechnung, Integrationen, Datenschutz und Systemstatus firmenuebergreifend.';

comment on function public.can_manage_company() is
  'Operative Firmenleitung: chef verwaltet Baustellen, Kunden, Material, Zeiten, Kalkulation, Angebote und Rechnungen innerhalb der eigenen Firma.';

notify pgrst, 'reload schema';
