create or replace function public.validate_vehicle_material_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.company_id <> public.current_company_id() or not public.can_manage_company() then
    raise exception 'not_authorized';
  end if;

  if not exists (
    select 1 from public.vehicles
    where id = new.vehicle_id
      and company_id = new.company_id
  ) then
    raise exception 'vehicle_not_found';
  end if;

  if not exists (
    select 1 from public.materials
    where id = new.material_id
      and company_id = new.company_id
  ) then
    raise exception 'material_not_found';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_vehicle_material_tenant on public.vehicle_materials;
create trigger validate_vehicle_material_tenant
before insert or update on public.vehicle_materials
for each row execute function public.validate_vehicle_material_tenant();

select pg_notify('pgrst', 'reload schema');
