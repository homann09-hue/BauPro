-- 20260712_price_permission_hardening.sql
-- Chef-/Preisrechte sind nicht an Mitarbeiter/Vorarbeiter delegierbar.
-- EK/VK/Marge/Preisvergleich, Angebote/Kalkulationen und Einstellungen bleiben Chef/Admin vorbehalten.

do $$
declare
  permission_constraint text;
begin
  if to_regclass('public.employee_permissions') is null then
    return;
  end if;

  delete from public.employee_permissions
  where permission_key in (
    'quotes.view',
    'quotes.create',
    'prices.purchase.view',
    'prices.sales.view',
    'settings.edit',
    'users.permissions.manage'
  );

  select conname
    into permission_constraint
  from pg_constraint
  where conrelid = 'public.employee_permissions'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%permission_key%'
  limit 1;

  if permission_constraint is not null then
    execute format('alter table public.employee_permissions drop constraint %I', permission_constraint);
  end if;

  alter table public.employee_permissions
    add constraint employee_permissions_permission_key_check
    check (
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
    );
end $$;

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

select pg_notify('pgrst', 'reload schema');
