-- Harden inventory RPC side effects against actor spoofing and cross-tenant references.

create table if not exists public.company_audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index if not exists company_audit_log_company_created_idx
on public.company_audit_log(company_id, created_at desc);

create index if not exists company_audit_log_entity_idx
on public.company_audit_log(company_id, entity_type, entity_id);

alter table public.company_audit_log enable row level security;
alter table public.company_audit_log force row level security;

grant select, insert on public.company_audit_log to authenticated;

drop policy if exists "managers read company audit log" on public.company_audit_log;
create policy "managers read company audit log"
on public.company_audit_log for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers create company audit log" on public.company_audit_log;
create policy "managers create company audit log"
on public.company_audit_log for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

create table if not exists public.material_reservations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid references public.jobsites(id) on delete cascade,
  bring_list_id uuid references public.bring_lists(id) on delete cascade,
  material_id uuid references public.materials(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  quantity_required numeric(12, 2) not null default 0 check (quantity_required >= 0),
  quantity_reserved numeric(12, 2) not null default 0 check (quantity_reserved >= 0),
  unit text not null default 'Stueck',
  status text not null default 'open' check (
    status in ('open', 'reserved', 'partially_reserved', 'missing', 'consumed', 'cancelled')
  ),
  reserved_by uuid references public.profiles(id) on delete set null,
  reserved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  from_location_id uuid references public.inventory_locations(id) on delete set null,
  to_location_id uuid references public.inventory_locations(id) on delete set null,
  jobsite_id uuid references public.jobsites(id) on delete set null,
  bring_list_id uuid references public.bring_lists(id) on delete set null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit text not null default 'Stueck',
  movement_type text not null check (movement_type in ('purchase', 'transfer', 'reserve', 'consume', 'return', 'correction')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  notes text
);

create index if not exists material_reservations_company_idx
on public.material_reservations(company_id, status);

create index if not exists material_reservations_inventory_idx
on public.material_reservations(inventory_item_id, status);

create index if not exists material_reservations_bring_list_idx
on public.material_reservations(bring_list_id);

create index if not exists material_movements_company_created_idx
on public.material_movements(company_id, created_at desc);

create index if not exists material_movements_inventory_idx
on public.material_movements(inventory_item_id, created_at desc);

create index if not exists material_movements_bring_list_idx
on public.material_movements(bring_list_id, created_at desc);

alter table public.material_reservations enable row level security;
alter table public.material_reservations force row level security;
alter table public.material_movements enable row level security;
alter table public.material_movements force row level security;

grant select, insert, update on public.material_reservations to authenticated;
grant select, insert, update, delete on public.material_movements to authenticated;

drop policy if exists "read relevant material reservations" on public.material_reservations;
create policy "read relevant material reservations"
on public.material_reservations for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or exists (
      select 1 from public.bring_lists bl
      where bl.id = bring_list_id
        and bl.company_id = public.current_company_id()
        and (bl.created_by = auth.uid() or bl.assigned_to = auth.uid())
    )
  )
);

drop policy if exists "managers create material reservations" on public.material_reservations;
create policy "managers create material reservations"
on public.material_reservations for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update material reservations" on public.material_reservations;
create policy "managers update material reservations"
on public.material_reservations for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers read material movements" on public.material_movements;
create policy "managers read material movements"
on public.material_movements for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers create material movements" on public.material_movements;
create policy "managers create material movements"
on public.material_movements for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update material movements" on public.material_movements;
create policy "managers update material movements"
on public.material_movements for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers delete material movements" on public.material_movements;
create policy "managers delete material movements"
on public.material_movements for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

create or replace function public.prevent_inventory_audit_actor_spoof()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
    and (
      new.action in (
        'inventory_stock_adjusted',
        'inventory_transferred',
        'inventory_consumed',
        'inventory_returned',
        'inventory_purchase_received',
        'material_reserved'
      )
      or new.entity_type in ('inventory_item', 'material_reservation')
    )
    and new.actor_id is distinct from auth.uid()
  then
    raise exception 'actor_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_inventory_audit_actor_spoof on public.company_audit_log;
create trigger prevent_inventory_audit_actor_spoof
before insert or update on public.company_audit_log
for each row execute function public.prevent_inventory_audit_actor_spoof();

create or replace function public.validate_material_reservation_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.company_id <> public.current_company_id() or not public.can_manage_company() then
    raise exception 'not_authorized';
  end if;

  if auth.uid() is not null and new.reserved_by is distinct from auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if new.inventory_item_id is not null and not exists (
    select 1 from public.inventory_items
    where id = new.inventory_item_id
      and company_id = new.company_id
  ) then
    raise exception 'inventory_item_not_found';
  end if;

  if new.job_id is not null and not exists (
    select 1 from public.jobsites
    where id = new.job_id
      and company_id = new.company_id
  ) then
    raise exception 'jobsite_not_found';
  end if;

  if new.bring_list_id is not null and not exists (
    select 1 from public.bring_lists
    where id = new.bring_list_id
      and company_id = new.company_id
  ) then
    raise exception 'bring_list_not_found';
  end if;

  if new.material_id is not null and not exists (
    select 1 from public.materials
    where id = new.material_id
      and company_id = new.company_id
  ) then
    raise exception 'material_not_found';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_material_reservation_tenant on public.material_reservations;
create trigger validate_material_reservation_tenant
before insert or update on public.material_reservations
for each row execute function public.validate_material_reservation_tenant();

create or replace function public.validate_material_movement_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.company_id <> public.current_company_id() or not public.can_manage_company() then
    raise exception 'not_authorized';
  end if;

  if auth.uid() is not null and new.created_by is distinct from auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if not exists (
    select 1 from public.inventory_items
    where id = new.inventory_item_id
      and company_id = new.company_id
  ) then
    raise exception 'inventory_item_not_found';
  end if;

  if new.from_location_id is not null and not exists (
    select 1 from public.inventory_locations
    where id = new.from_location_id
      and company_id = new.company_id
  ) then
    raise exception 'source_location_not_found';
  end if;

  if new.to_location_id is not null and not exists (
    select 1 from public.inventory_locations
    where id = new.to_location_id
      and company_id = new.company_id
  ) then
    raise exception 'target_location_not_found';
  end if;

  if new.jobsite_id is not null and not exists (
    select 1 from public.jobsites
    where id = new.jobsite_id
      and company_id = new.company_id
  ) then
    raise exception 'jobsite_not_found';
  end if;

  if new.bring_list_id is not null and not exists (
    select 1 from public.bring_lists
    where id = new.bring_list_id
      and company_id = new.company_id
  ) then
    raise exception 'bring_list_not_found';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_material_movement_tenant on public.material_movements;
create trigger validate_material_movement_tenant
before insert or update on public.material_movements
for each row execute function public.validate_material_movement_tenant();

create or replace function public.prevent_inventory_item_creator_spoof()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and new.created_by is not null then
    if tg_op = 'INSERT' and new.created_by is distinct from auth.uid() then
      raise exception 'actor_mismatch';
    end if;

    if tg_op = 'UPDATE'
      and new.created_by is distinct from old.created_by
      and new.created_by is distinct from auth.uid()
    then
      raise exception 'actor_mismatch';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_inventory_item_creator_spoof on public.inventory_items;
create trigger prevent_inventory_item_creator_spoof
before insert or update on public.inventory_items
for each row execute function public.prevent_inventory_item_creator_spoof();

select pg_notify('pgrst', 'reload schema');
