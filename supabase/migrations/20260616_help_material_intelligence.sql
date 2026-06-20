-- BauPro Help + Material Intelligence
-- Adds contextual help persistence, inventory movement logging and bring-list availability snapshots.

alter table public.inventory_locations add column if not exists address text;
alter table public.inventory_locations add column if not exists vehicle_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_locations_vehicle_id_fkey'
      and conrelid = 'public.inventory_locations'::regclass
  ) then
    alter table public.inventory_locations
      add constraint inventory_locations_vehicle_id_fkey
      foreign key (vehicle_id) references public.vehicles(id) on delete set null;
  end if;
end $$;

do $$
declare
  constraint_name text;
begin
  select conname
  into constraint_name
  from pg_constraint
  where conrelid = 'public.inventory_locations'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%location_type%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.inventory_locations drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.inventory_locations
  add constraint inventory_locations_location_type_check
  check (location_type in ('Hauptlager', 'Fahrzeuglager', 'Baustelle', 'Container', 'Werkstatt', 'Lieferant/offen bestellt'));

create table if not exists public.user_help_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  feature_key text not null,
  first_seen_at timestamptz not null default now(),
  dismissed_at timestamptz,
  first_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, feature_key)
);

create table if not exists public.bring_list_availability_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bring_list_id uuid not null references public.bring_lists(id) on delete cascade,
  bring_list_item_id uuid references public.bring_list_items(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  required_quantity numeric(12, 2) not null default 0 check (required_quantity >= 0),
  available_quantity numeric(12, 2) not null default 0 check (available_quantity >= 0),
  reserved_quantity numeric(12, 2) not null default 0 check (reserved_quantity >= 0),
  missing_quantity numeric(12, 2) not null default 0 check (missing_quantity >= 0),
  risk_level text not null default 'green' check (risk_level in ('green', 'yellow', 'red', 'blue')),
  status_label text not null,
  source text not null default 'availability_check',
  created_at timestamptz not null default now()
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

create index if not exists inventory_locations_vehicle_idx on public.inventory_locations(company_id, vehicle_id);
create index if not exists user_help_state_user_feature_idx on public.user_help_state(user_id, feature_key);
create index if not exists user_help_state_company_idx on public.user_help_state(company_id, user_id);
create index if not exists bring_list_availability_snapshots_list_idx on public.bring_list_availability_snapshots(company_id, bring_list_id, created_at desc);
create index if not exists bring_list_availability_snapshots_item_idx on public.bring_list_availability_snapshots(inventory_item_id, created_at desc);
create index if not exists material_movements_company_created_idx on public.material_movements(company_id, created_at desc);
create index if not exists material_movements_inventory_idx on public.material_movements(inventory_item_id, created_at desc);
create index if not exists material_movements_bring_list_idx on public.material_movements(bring_list_id, created_at desc);

drop trigger if exists set_user_help_state_updated_at on public.user_help_state;
create trigger set_user_help_state_updated_at
before update on public.user_help_state
for each row execute function public.set_updated_at();

alter table public.user_help_state enable row level security;
alter table public.user_help_state force row level security;
alter table public.bring_list_availability_snapshots enable row level security;
alter table public.bring_list_availability_snapshots force row level security;
alter table public.material_movements enable row level security;
alter table public.material_movements force row level security;

grant select, insert, update, delete on public.user_help_state to authenticated;
grant select, insert, update, delete on public.bring_list_availability_snapshots to authenticated;
grant select, insert, update, delete on public.material_movements to authenticated;

drop policy if exists "users manage own help state" on public.user_help_state;
create policy "users manage own help state"
on public.user_help_state for all
to authenticated
using (company_id = public.current_company_id() and user_id = auth.uid())
with check (company_id = public.current_company_id() and user_id = auth.uid());

drop policy if exists "read relevant availability snapshots" on public.bring_list_availability_snapshots;
create policy "read relevant availability snapshots"
on public.bring_list_availability_snapshots for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or exists (
      select 1
      from public.bring_lists bl
      where bl.id = bring_list_id
        and bl.company_id = public.current_company_id()
        and (
          bl.assigned_to = auth.uid()
          or bl.created_by = auth.uid()
          or exists (
            select 1 from public.jobsites j
            where j.id = bl.job_id
              and auth.uid() = any(j.assigned_employee_ids)
          )
        )
    )
  )
);

drop policy if exists "create relevant availability snapshots" on public.bring_list_availability_snapshots;
create policy "create relevant availability snapshots"
on public.bring_list_availability_snapshots for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and exists (
    select 1
    from public.bring_lists bl
    where bl.id = bring_list_id
      and bl.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or bl.assigned_to = auth.uid()
        or bl.created_by = auth.uid()
      )
  )
);

drop policy if exists "managers maintain availability snapshots" on public.bring_list_availability_snapshots;
create policy "managers maintain availability snapshots"
on public.bring_list_availability_snapshots for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers delete availability snapshots" on public.bring_list_availability_snapshots;
create policy "managers delete availability snapshots"
on public.bring_list_availability_snapshots for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

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

create or replace function public.record_material_movement_from_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  movement_inventory_item_id uuid;
  movement_from_location_id uuid;
  movement_to_location_id uuid;
  movement_quantity numeric;
  movement_unit text;
  movement_type text;
begin
  if new.action = 'material_reserved' then
    movement_inventory_item_id := nullif(new.new_values->>'inventory_item_id', '')::uuid;
    movement_quantity := coalesce(nullif(new.new_values->>'quantity_reserved', '')::numeric, 0);
    movement_type := 'reserve';
  elsif new.action = 'inventory_transferred' then
    movement_inventory_item_id := new.entity_id;
    movement_from_location_id := nullif(new.old_values->>'source_location_id', '')::uuid;
    movement_to_location_id := nullif(new.new_values->>'target_location_id', '')::uuid;
    movement_quantity := coalesce(nullif(new.new_values->>'amount', '')::numeric, 0);
    movement_type := 'transfer';
  elsif new.action = 'inventory_stock_adjusted' then
    movement_inventory_item_id := new.entity_id;
    movement_quantity := coalesce(nullif(new.new_values->>'amount', '')::numeric, 0);
    movement_type := 'correction';
  else
    return new;
  end if;

  if movement_inventory_item_id is null or movement_quantity <= 0 then
    return new;
  end if;

  select unit
  into movement_unit
  from public.inventory_items
  where id = movement_inventory_item_id
    and company_id = new.company_id;

  insert into public.material_movements (
    company_id,
    inventory_item_id,
    from_location_id,
    to_location_id,
    quantity,
    unit,
    movement_type,
    created_by,
    notes
  )
  values (
    new.company_id,
    movement_inventory_item_id,
    movement_from_location_id,
    movement_to_location_id,
    movement_quantity,
    coalesce(movement_unit, 'Stueck'),
    movement_type,
    new.actor_id,
    new.action
  );

  return new;
end;
$$;

drop trigger if exists record_material_movement_from_audit on public.company_audit_log;
create trigger record_material_movement_from_audit
after insert on public.company_audit_log
for each row execute function public.record_material_movement_from_audit();

create or replace function public.consume_inventory_item(
  p_company_id uuid,
  p_item_id uuid,
  p_quantity numeric,
  p_jobsite_id uuid,
  p_bring_list_id uuid,
  p_actor_id uuid,
  p_notes text
)
returns numeric
language plpgsql
set search_path = public
as $$
declare
  current_item public.inventory_items%rowtype;
  next_stock numeric;
begin
  if p_company_id <> public.current_company_id() or not public.can_manage_company() then
    raise exception 'not_authorized';
  end if;

  if p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  select *
  into current_item
  from public.inventory_items
  where id = p_item_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'inventory_item_not_found';
  end if;

  if current_item.stock < p_quantity then
    raise exception 'negative_stock_not_allowed';
  end if;

  next_stock := current_item.stock - p_quantity;

  update public.inventory_items
  set stock = next_stock,
      updated_at = now()
  where id = p_item_id
    and company_id = p_company_id;

  insert into public.material_movements (
    company_id,
    inventory_item_id,
    from_location_id,
    jobsite_id,
    bring_list_id,
    quantity,
    unit,
    movement_type,
    created_by,
    notes
  )
  values (
    p_company_id,
    p_item_id,
    current_item.location_id,
    p_jobsite_id,
    p_bring_list_id,
    p_quantity,
    current_item.unit,
    'consume',
    p_actor_id,
    p_notes
  );

  insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
  values (
    p_company_id,
    p_actor_id,
    'inventory_item',
    p_item_id,
    'inventory_consumed',
    jsonb_build_object('stock', current_item.stock),
    jsonb_build_object('stock', next_stock, 'amount', p_quantity, 'jobsite_id', p_jobsite_id, 'bring_list_id', p_bring_list_id)
  );

  return next_stock;
end;
$$;

create or replace function public.return_inventory_item(
  p_company_id uuid,
  p_item_id uuid,
  p_quantity numeric,
  p_jobsite_id uuid,
  p_bring_list_id uuid,
  p_actor_id uuid,
  p_notes text
)
returns numeric
language plpgsql
set search_path = public
as $$
declare
  current_item public.inventory_items%rowtype;
  next_stock numeric;
begin
  if p_company_id <> public.current_company_id() or not public.can_manage_company() then
    raise exception 'not_authorized';
  end if;

  if p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  select *
  into current_item
  from public.inventory_items
  where id = p_item_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'inventory_item_not_found';
  end if;

  next_stock := current_item.stock + p_quantity;

  update public.inventory_items
  set stock = next_stock,
      updated_at = now()
  where id = p_item_id
    and company_id = p_company_id;

  insert into public.material_movements (
    company_id,
    inventory_item_id,
    to_location_id,
    jobsite_id,
    bring_list_id,
    quantity,
    unit,
    movement_type,
    created_by,
    notes
  )
  values (
    p_company_id,
    p_item_id,
    current_item.location_id,
    p_jobsite_id,
    p_bring_list_id,
    p_quantity,
    current_item.unit,
    'return',
    p_actor_id,
    p_notes
  );

  insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
  values (
    p_company_id,
    p_actor_id,
    'inventory_item',
    p_item_id,
    'inventory_returned',
    jsonb_build_object('stock', current_item.stock),
    jsonb_build_object('stock', next_stock, 'amount', p_quantity, 'jobsite_id', p_jobsite_id, 'bring_list_id', p_bring_list_id)
  );

  return next_stock;
end;
$$;

create or replace function public.receive_inventory_purchase(
  p_company_id uuid,
  p_item_id uuid,
  p_quantity numeric,
  p_actor_id uuid,
  p_notes text
)
returns numeric
language plpgsql
set search_path = public
as $$
declare
  current_item public.inventory_items%rowtype;
  next_stock numeric;
begin
  if p_company_id <> public.current_company_id() or not public.can_manage_company() then
    raise exception 'not_authorized';
  end if;

  if p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  select *
  into current_item
  from public.inventory_items
  where id = p_item_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'inventory_item_not_found';
  end if;

  next_stock := current_item.stock + p_quantity;

  update public.inventory_items
  set stock = next_stock,
      updated_at = now()
  where id = p_item_id
    and company_id = p_company_id;

  insert into public.material_movements (
    company_id,
    inventory_item_id,
    to_location_id,
    quantity,
    unit,
    movement_type,
    created_by,
    notes
  )
  values (
    p_company_id,
    p_item_id,
    current_item.location_id,
    p_quantity,
    current_item.unit,
    'purchase',
    p_actor_id,
    p_notes
  );

  insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
  values (
    p_company_id,
    p_actor_id,
    'inventory_item',
    p_item_id,
    'inventory_purchase_received',
    jsonb_build_object('stock', current_item.stock),
    jsonb_build_object('stock', next_stock, 'amount', p_quantity)
  );

  return next_stock;
end;
$$;

grant execute on function public.consume_inventory_item(uuid, uuid, numeric, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.return_inventory_item(uuid, uuid, numeric, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.receive_inventory_purchase(uuid, uuid, numeric, uuid, text) to authenticated;

select pg_notify('pgrst', 'reload schema');
