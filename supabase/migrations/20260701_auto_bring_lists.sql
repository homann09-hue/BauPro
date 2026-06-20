-- Automatische Mitbringlisten aus Auftrag, Materialplanung, Lager und Plantafel.
-- Manuelle Positionen bleiben erhalten; automatisch erzeugte Positionen tragen Quelle und Sync-Zeit.

alter table public.bring_lists add column if not exists auto_generated boolean not null default false;
alter table public.bring_lists add column if not exists generation_source text not null default 'manual';
alter table public.bring_lists add column if not exists last_auto_synced_at timestamptz;
alter table public.bring_lists add column if not exists source_hash text;

alter table public.bring_list_items add column if not exists auto_generated boolean not null default false;
alter table public.bring_list_items add column if not exists source_type text;
alter table public.bring_list_items add column if not exists source_ref text;
alter table public.bring_list_items add column if not exists required_vehicle_id uuid references public.vehicles(id) on delete set null;
alter table public.bring_list_items add column if not exists updated_at timestamptz not null default now();

create table if not exists public.bring_list_audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bring_list_id uuid not null references public.bring_lists(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bring_lists_auto_date_idx
on public.bring_lists(company_id, date, auto_generated, last_auto_synced_at desc);

create index if not exists bring_list_items_source_idx
on public.bring_list_items(bring_list_id, source_type, source_ref);

create index if not exists bring_list_items_required_vehicle_idx
on public.bring_list_items(required_vehicle_id)
where required_vehicle_id is not null;

create index if not exists bring_list_audit_log_list_idx
on public.bring_list_audit_log(bring_list_id, created_at desc);

drop trigger if exists set_bring_list_items_updated_at on public.bring_list_items;
create trigger set_bring_list_items_updated_at
before update on public.bring_list_items
for each row execute function public.set_updated_at();

create or replace function public.prevent_bring_list_auto_field_spoof()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.can_manage_company() then
    if tg_op = 'INSERT' then
      if new.auto_generated
        or new.generation_source <> 'manual'
        or new.last_auto_synced_at is not null
        or new.source_hash is not null
      then
        raise exception 'restricted_bring_list_auto_insert';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.auto_generated is distinct from old.auto_generated
        or new.generation_source is distinct from old.generation_source
        or new.last_auto_synced_at is distinct from old.last_auto_synced_at
        or new.source_hash is distinct from old.source_hash
      then
        raise exception 'restricted_bring_list_auto_update';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_bring_list_auto_field_spoof on public.bring_lists;
create trigger prevent_bring_list_auto_field_spoof
before insert or update on public.bring_lists
for each row execute function public.prevent_bring_list_auto_field_spoof();

create or replace function public.validate_bring_list_item_auto_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  list_company_id uuid;
begin
  select company_id
  into list_company_id
  from public.bring_lists
  where id = new.bring_list_id;

  if list_company_id is null then
    raise exception 'bring_list_not_found';
  end if;

  if new.required_vehicle_id is not null and not exists (
    select 1
    from public.vehicles
    where id = new.required_vehicle_id
      and company_id = list_company_id
  ) then
    raise exception 'required_vehicle_not_found';
  end if;

  if auth.uid() is not null and not public.can_manage_company() then
    if tg_op = 'INSERT' then
      if new.auto_generated
        or coalesce(new.source_type, 'manual') <> 'manual'
        or new.source_ref is not null
        or new.required_vehicle_id is not null
      then
        raise exception 'restricted_bring_list_item_source_insert';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.auto_generated is distinct from old.auto_generated
        or new.source_type is distinct from old.source_type
        or new.source_ref is distinct from old.source_ref
        or new.required_vehicle_id is distinct from old.required_vehicle_id
      then
        raise exception 'restricted_bring_list_item_source_update';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_bring_list_item_auto_fields on public.bring_list_items;
create trigger validate_bring_list_item_auto_fields
before insert or update on public.bring_list_items
for each row execute function public.validate_bring_list_item_auto_fields();

create or replace function public.validate_bring_list_item_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  list_company_id uuid;
begin
  select company_id
  into list_company_id
  from public.bring_lists
  where id = new.bring_list_id;

  if list_company_id is null then
    raise exception 'bring_list_not_found';
  end if;

  if auth.uid() is not null and list_company_id <> public.current_company_id() then
    raise exception 'not_authorized';
  end if;

  if new.material_id is not null and not exists (
    select 1
    from public.materials
    where id = new.material_id
      and company_id = list_company_id
  ) then
    raise exception 'material_not_found';
  end if;

  if new.inventory_item_id is not null and not exists (
    select 1
    from public.inventory_items
    where id = new.inventory_item_id
      and company_id = list_company_id
  ) then
    raise exception 'inventory_item_not_found';
  end if;

  if new.vehicle_id is not null and not exists (
    select 1
    from public.vehicles
    where id = new.vehicle_id
      and company_id = list_company_id
  ) then
    raise exception 'vehicle_not_found';
  end if;

  if auth.uid() is not null and not public.can_manage_company() then
    if tg_op = 'INSERT' then
      if not exists (
        select 1
        from public.bring_lists bl
        where bl.id = new.bring_list_id
          and public.can_access_bring_list(bl.company_id, bl.job_id, bl.assigned_to, bl.created_by)
      ) then
        raise exception 'not_authorized';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.bring_list_id is distinct from old.bring_list_id
        or new.material_id is distinct from old.material_id
        or new.inventory_item_id is distinct from old.inventory_item_id
        or new.custom_item_name is distinct from old.custom_item_name
        or new.item_type is distinct from old.item_type
        or new.quantity is distinct from old.quantity
        or new.unit is distinct from old.unit
        or new.storage_location is distinct from old.storage_location
        or new.vehicle_id is distinct from old.vehicle_id
        or new.notes is distinct from old.notes
        or new.created_at is distinct from old.created_at
      then
        raise exception 'restricted_bring_list_item_update';
      end if;

      if old.missing_reported and not new.missing_reported then
        raise exception 'restricted_missing_report_reset';
      end if;

      if new.packed and new.packed_by is distinct from auth.uid() then
        raise exception 'actor_mismatch';
      end if;

      if not new.packed and new.packed_by is not null then
        raise exception 'actor_mismatch';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_bring_list_item_tenant on public.bring_list_items;
create trigger validate_bring_list_item_tenant
before insert or update on public.bring_list_items
for each row execute function public.validate_bring_list_item_tenant();

drop policy if exists "create relevant bring list items" on public.bring_list_items;
create policy "create relevant bring list items"
on public.bring_list_items for insert
to authenticated
with check (
  exists (
    select 1
    from public.bring_lists bl
    where bl.id = bring_list_id
      and public.can_access_bring_list(bl.company_id, bl.job_id, bl.assigned_to, bl.created_by)
  )
);

alter table public.bring_list_audit_log enable row level security;
alter table public.bring_list_audit_log force row level security;

grant select, insert on public.bring_list_audit_log to authenticated;
revoke delete on public.bring_list_audit_log from authenticated;

drop policy if exists "read relevant bring list audit log" on public.bring_list_audit_log;
create policy "read relevant bring list audit log"
on public.bring_list_audit_log for select
to authenticated
using (
  exists (
    select 1
    from public.bring_lists bl
    where bl.id = bring_list_id
      and public.can_access_bring_list(bl.company_id, bl.job_id, bl.assigned_to, bl.created_by)
  )
);

drop policy if exists "create relevant bring list audit log" on public.bring_list_audit_log;
create policy "create relevant bring list audit log"
on public.bring_list_audit_log for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and actor_id = auth.uid()
  and exists (
    select 1
    from public.bring_lists bl
    where bl.id = bring_list_id
      and public.can_access_bring_list(bl.company_id, bl.job_id, bl.assigned_to, bl.created_by)
  )
);

drop policy if exists "redteam managers delete fallback" on public.bring_list_audit_log;

select pg_notify('pgrst', 'reload schema');
