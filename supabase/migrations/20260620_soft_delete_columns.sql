-- Soft-delete hardening for business-critical records.
-- Critical operating data must be archived, not hard-deleted, from authenticated clients.

alter table public.time_entries add column if not exists archived_at timestamptz;
alter table public.report_photos add column if not exists archived_at timestamptz;
alter table public.job_dimensions add column if not exists archived_at timestamptz;
alter table public.job_material_requirements add column if not exists archived_at timestamptz;
alter table public.vehicle_materials add column if not exists archived_at timestamptz;

create index if not exists time_entries_archived_idx on public.time_entries(company_id, archived_at, date desc);
create index if not exists report_photos_archived_idx on public.report_photos(company_id, archived_at, report_id, created_at desc);
create index if not exists job_dimensions_archived_idx on public.job_dimensions(company_id, archived_at, order_id);
create index if not exists job_material_requirements_archived_idx on public.job_material_requirements(company_id, archived_at, order_id);
create index if not exists vehicle_materials_archived_idx on public.vehicle_materials(company_id, archived_at, vehicle_id);

create or replace view public.job_material_requirements_public as
select
  item.id,
  item.company_id,
  item.order_id,
  item.dimension_id,
  item.jobsite_id,
  item.rule_id,
  item.catalog_item_id,
  item.inventory_item_id,
  item.material_name,
  item.unit,
  item.base_quantity,
  item.waste_percent,
  item.waste_quantity,
  item.total_quantity,
  item.location_name,
  item.stock,
  item.minimum_stock,
  item.created_at,
  item.updated_at,
  item.archived_at
from public.job_material_requirements item
join public.orders o on o.id = item.order_id
where item.company_id = public.current_company_id()
  and item.archived_at is null
  and (
    public.can_manage_company()
    or auth.uid() = any(o.assigned_employee_ids)
  );

grant select on public.job_material_requirements_public to authenticated;

create or replace function public.archive_report_photo(p_photo_id uuid, p_report_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  archived_id uuid;
begin
  update public.report_photos
  set archived_at = now()
  where id = p_photo_id
    and report_id = p_report_id
    and company_id = public.current_company_id()
    and archived_at is null
    and (public.can_manage_company() or created_by = auth.uid())
  returning id into archived_id;

  if archived_id is null then
    raise exception 'not_authorized';
  end if;

  return archived_id;
end;
$$;

grant execute on function public.archive_report_photo(uuid, uuid) to authenticated;

-- Remove direct DELETE capability from protected business tables. Server actions use archived_at.
drop policy if exists "managers can delete customers" on public.customers;
drop policy if exists "managers can delete jobsites" on public.jobsites;
drop policy if exists "managers can delete orders" on public.orders;
drop policy if exists "managers can delete job dimensions" on public.job_dimensions;
drop policy if exists "delete relevant reports" on public.reports;
drop policy if exists "delete report photos" on public.report_photos;
drop policy if exists "managers can delete time entries" on public.time_entries;
drop policy if exists "managers can delete materials" on public.materials;
drop policy if exists "managers can delete inventory items" on public.inventory_items;
drop policy if exists "managers can delete vehicles" on public.vehicles;
drop policy if exists "managers can delete vehicle materials" on public.vehicle_materials;
drop policy if exists "managers can delete tasks" on public.tasks;
drop policy if exists "managers can delete order requirements" on public.job_material_requirements;

drop policy if exists "redteam managers delete fallback" on public.customers;
drop policy if exists "redteam managers delete fallback" on public.jobsites;
drop policy if exists "redteam managers delete fallback" on public.orders;
drop policy if exists "redteam managers delete fallback" on public.job_dimensions;
drop policy if exists "redteam managers delete fallback" on public.reports;
drop policy if exists "redteam managers delete fallback" on public.report_photos;
drop policy if exists "redteam managers delete fallback" on public.time_entries;
drop policy if exists "redteam managers delete fallback" on public.materials;
drop policy if exists "redteam managers delete fallback" on public.inventory_items;
drop policy if exists "redteam managers delete fallback" on public.vehicles;
drop policy if exists "redteam managers delete fallback" on public.vehicle_materials;
drop policy if exists "redteam managers delete fallback" on public.tasks;
drop policy if exists "redteam managers delete fallback" on public.job_material_requirements;

select pg_notify('pgrst', 'reload schema');
