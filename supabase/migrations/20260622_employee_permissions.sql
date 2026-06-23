-- 20260622_employee_permissions.sql
-- Feingranulare Rechteverwaltung fuer Vorarbeiter/Mitarbeiter.

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

  if not public.can_manage_company() then
    raise exception 'Keine Berechtigung fuer diese Rechteaenderung.';
  end if;

  if target_company_id is distinct from public.current_company_id() then
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
    raise exception 'Chef/Admin-Rechte koennen nicht ueber Mitarbeiterrechte geaendert werden.';
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
      'quotes.view',
      'quotes.create',
      'prices.purchase.view',
      'prices.sales.view',
      'settings.edit',
      'users.permissions.manage'
    ) then public.can_manage_company()
    when public.current_role() in ('admin', 'chef') then true
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

alter table public.employee_permissions enable row level security;
alter table public.employee_permissions force row level security;
alter table public.employee_permission_audit_log enable row level security;
alter table public.employee_permission_audit_log force row level security;

drop policy if exists "read own or managed employee permissions" on public.employee_permissions;
create policy "read own or managed employee permissions"
on public.employee_permissions for select
to authenticated
using (
  company_id = public.current_company_id()
  and (public.can_manage_company() or profile_id = auth.uid())
);

drop policy if exists "managers insert employee permissions" on public.employee_permissions;
create policy "managers insert employee permissions"
on public.employee_permissions for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update employee permissions" on public.employee_permissions;
create policy "managers update employee permissions"
on public.employee_permissions for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers delete employee permissions" on public.employee_permissions;
create policy "managers delete employee permissions"
on public.employee_permissions for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers read employee permission audit" on public.employee_permission_audit_log;
create policy "managers read employee permission audit"
on public.employee_permission_audit_log for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers create employee permission audit" on public.employee_permission_audit_log;
create policy "managers create employee permission audit"
on public.employee_permission_audit_log for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

-- RLS-Erweiterungen fuer freigegebene operative Bereiche.
drop policy if exists "permitted users read orders" on public.orders;
create policy "permitted users read orders"
on public.orders for select
to authenticated
using (company_id = public.current_company_id() and public.has_employee_permission('orders.view'));

drop policy if exists "permitted users create orders" on public.orders;
create policy "permitted users create orders"
on public.orders for insert
to authenticated
with check (company_id = public.current_company_id() and public.has_employee_permission('orders.create'));

drop policy if exists "permitted users update orders" on public.orders;
create policy "permitted users update orders"
on public.orders for update
to authenticated
using (company_id = public.current_company_id() and public.has_employee_permission('orders.edit'))
with check (company_id = public.current_company_id() and public.has_employee_permission('orders.edit'));

drop policy if exists "permitted users read customers" on public.customers;
create policy "permitted users read customers"
on public.customers for select
to authenticated
using (company_id = public.current_company_id() and public.has_employee_permission('customers.view'));

drop policy if exists "permitted users write customers" on public.customers;
create policy "permitted users write customers"
on public.customers for insert
to authenticated
with check (company_id = public.current_company_id() and public.has_employee_permission('customers.edit'));

drop policy if exists "permitted users update customers" on public.customers;
create policy "permitted users update customers"
on public.customers for update
to authenticated
using (company_id = public.current_company_id() and public.has_employee_permission('customers.edit'))
with check (company_id = public.current_company_id() and public.has_employee_permission('customers.edit'));

drop policy if exists "permitted users read inventory" on public.inventory_items;
create policy "permitted users read inventory"
on public.inventory_items for select
to authenticated
using (company_id = public.current_company_id() and public.has_employee_permission('inventory.view'));

drop policy if exists "permitted users update inventory" on public.inventory_items;
create policy "permitted users update inventory"
on public.inventory_items for update
to authenticated
using (company_id = public.current_company_id() and public.has_employee_permission('inventory.edit'))
with check (company_id = public.current_company_id() and public.has_employee_permission('inventory.edit'));

drop policy if exists "permitted users read team time entries" on public.time_entries;
create policy "permitted users read team time entries"
on public.time_entries for select
to authenticated
using (company_id = public.current_company_id() and public.has_employee_permission('time.team.view'));

drop policy if exists "permitted users update team time entries" on public.time_entries;
create policy "permitted users update team time entries"
on public.time_entries for update
to authenticated
using (company_id = public.current_company_id() and public.has_employee_permission('time.team.edit'))
with check (company_id = public.current_company_id() and public.has_employee_permission('time.team.edit'));

drop policy if exists "permitted users approve reports" on public.reports;
create policy "permitted users approve reports"
on public.reports for update
to authenticated
using (company_id = public.current_company_id() and public.has_employee_permission('reports.approve'))
with check (company_id = public.current_company_id() and public.has_employee_permission('reports.approve'));
