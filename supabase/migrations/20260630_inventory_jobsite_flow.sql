-- Verknuepft Lager, Material und Baustellen ueber einen kontrollierten Melde-/Bestaetigungsprozess.
-- Mitarbeiter melden Verbrauch/Rueckgabe/Verlust, Vorarbeiter oder Chef bestaetigen atomar gegen den Bestand.

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.material_movements'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%movement_type%'
  loop
    execute format('alter table public.material_movements drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.material_movements
  add constraint material_movements_movement_type_check
  check (movement_type in ('purchase', 'transfer', 'reserve', 'consume', 'return', 'correction', 'loss', 'break'));

drop policy if exists "managers delete material movements" on public.material_movements;
revoke delete on public.material_movements from authenticated;

drop policy if exists "managers read material movements" on public.material_movements;
drop policy if exists "read relevant material movements" on public.material_movements;
create policy "read relevant material movements"
on public.material_movements for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or created_by = auth.uid()
    or exists (
      select 1
      from public.jobsites j
      where j.id = jobsite_id
        and j.company_id = public.current_company_id()
        and auth.uid() = any(j.assigned_employee_ids)
    )
  )
);

create table if not exists public.material_usage_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  bring_list_id uuid references public.bring_lists(id) on delete set null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit text not null default 'Stueck',
  booking_type text not null check (booking_type in ('consume', 'return', 'loss', 'break')),
  status text not null default 'reported' check (status in ('reported', 'confirmed', 'rejected', 'corrected')),
  movement_id uuid references public.material_movements(id) on delete set null,
  reported_by uuid references public.profiles(id) on delete set null,
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  notes text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists material_usage_reports_company_status_idx
on public.material_usage_reports(company_id, status, created_at desc);

create index if not exists material_usage_reports_jobsite_idx
on public.material_usage_reports(company_id, jobsite_id, status);

create index if not exists material_usage_reports_inventory_idx
on public.material_usage_reports(inventory_item_id, created_at desc);

drop trigger if exists set_material_usage_reports_updated_at on public.material_usage_reports;
create trigger set_material_usage_reports_updated_at
before update on public.material_usage_reports
for each row execute function public.set_updated_at();

alter table public.material_usage_reports enable row level security;
alter table public.material_usage_reports force row level security;

grant select, insert, update on public.material_usage_reports to authenticated;

drop policy if exists "read relevant material usage reports" on public.material_usage_reports;
create policy "read relevant material usage reports"
on public.material_usage_reports for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or reported_by = auth.uid()
    or exists (
      select 1
      from public.jobsites j
      where j.id = jobsite_id
        and j.company_id = public.current_company_id()
        and auth.uid() = any(j.assigned_employee_ids)
    )
  )
);

drop policy if exists "members create material usage reports" on public.material_usage_reports;
create policy "members create material usage reports"
on public.material_usage_reports for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and reported_by = auth.uid()
  and (
    public.can_manage_company()
    or exists (
      select 1
      from public.jobsites j
      where j.id = jobsite_id
        and j.company_id = public.current_company_id()
        and auth.uid() = any(j.assigned_employee_ids)
    )
  )
);

drop policy if exists "operators update material usage reports" on public.material_usage_reports;
create policy "operators update material usage reports"
on public.material_usage_reports for update
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or (
      public.current_role() = 'vorarbeiter'
      and exists (
        select 1
        from public.jobsites j
        where j.id = jobsite_id
          and j.company_id = public.current_company_id()
          and auth.uid() = any(j.assigned_employee_ids)
      )
    )
  )
)
with check (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or (
      public.current_role() = 'vorarbeiter'
      and exists (
        select 1
        from public.jobsites j
        where j.id = jobsite_id
          and j.company_id = public.current_company_id()
          and auth.uid() = any(j.assigned_employee_ids)
      )
    )
  )
);

create or replace function public.prevent_direct_material_usage_status_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.company_id is distinct from old.company_id
    or new.inventory_item_id is distinct from old.inventory_item_id
    or new.jobsite_id is distinct from old.jobsite_id
    or new.reported_by is distinct from old.reported_by
  then
    raise exception 'protected_usage_report_fields';
  end if;

  if (
    new.status is distinct from old.status
    or new.movement_id is distinct from old.movement_id
    or new.confirmed_by is distinct from old.confirmed_by
    or new.confirmed_at is distinct from old.confirmed_at
    or new.rejection_reason is distinct from old.rejection_reason
  ) and coalesce(current_setting('app.material_usage_confirmation', true), '') <> '1' then
    raise exception 'use_material_usage_confirmation_rpc';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_direct_material_usage_status_update on public.material_usage_reports;
create trigger prevent_direct_material_usage_status_update
before update on public.material_usage_reports
for each row execute function public.prevent_direct_material_usage_status_update();

create or replace function public.validate_material_movement_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  actor_can_book boolean;
begin
  actor_can_book := public.can_manage_company()
    or (
      public.current_role() = 'vorarbeiter'
      and new.movement_type in ('consume', 'return', 'loss', 'break')
      and new.jobsite_id is not null
      and exists (
        select 1
        from public.jobsites j
        where j.id = new.jobsite_id
          and j.company_id = new.company_id
          and auth.uid() = any(j.assigned_employee_ids)
      )
    );

  if new.company_id <> public.current_company_id() or not actor_can_book then
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

create or replace function public.confirm_material_usage_report(
  p_company_id uuid,
  p_report_id uuid,
  p_actor_id uuid,
  p_decision text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  report_row public.material_usage_reports%rowtype;
  current_item public.inventory_items%rowtype;
  next_stock numeric;
  movement_id uuid;
  existing_alert_id uuid;
  actor_can_confirm boolean;
begin
  if p_company_id <> public.current_company_id() then
    raise exception 'not_authorized';
  end if;

  if p_actor_id is distinct from auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if p_decision not in ('confirmed', 'rejected') then
    raise exception 'invalid_decision';
  end if;

  select *
  into report_row
  from public.material_usage_reports
  where id = p_report_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'usage_report_not_found';
  end if;

  if report_row.status <> 'reported' then
    raise exception 'usage_report_already_processed';
  end if;

  perform set_config('app.material_usage_confirmation', '1', true);

  actor_can_confirm := public.can_manage_company()
    or (
      public.current_role() = 'vorarbeiter'
      and exists (
        select 1
        from public.jobsites j
        where j.id = report_row.jobsite_id
          and j.company_id = p_company_id
          and auth.uid() = any(j.assigned_employee_ids)
      )
    );

  if not actor_can_confirm then
    raise exception 'not_authorized';
  end if;

  if p_decision = 'rejected' then
    update public.material_usage_reports
    set status = 'rejected',
        rejection_reason = nullif(p_note, ''),
        confirmed_by = p_actor_id,
        confirmed_at = now(),
        updated_at = now()
    where id = report_row.id
      and company_id = p_company_id;

    insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
    values (
      p_company_id,
      p_actor_id,
      'material_usage_report',
      report_row.id,
      'material_usage_rejected',
      jsonb_build_object('status', report_row.status),
      jsonb_build_object('status', 'rejected', 'reason', nullif(p_note, ''))
    );

    return null;
  end if;

  select *
  into current_item
  from public.inventory_items
  where id = report_row.inventory_item_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'inventory_item_not_found';
  end if;

  if report_row.booking_type in ('consume', 'loss', 'break') then
    if current_item.stock < report_row.quantity then
      raise exception 'negative_stock_not_allowed';
    end if;

    next_stock := current_item.stock - report_row.quantity;
  else
    next_stock := current_item.stock + report_row.quantity;
  end if;

  update public.inventory_items
  set stock = next_stock,
      updated_at = now()
  where id = current_item.id
    and company_id = p_company_id;

  insert into public.material_movements (
    company_id,
    inventory_item_id,
    from_location_id,
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
    current_item.id,
    case when report_row.booking_type in ('consume', 'loss', 'break') then current_item.location_id else null end,
    case when report_row.booking_type = 'return' then current_item.location_id else null end,
    report_row.jobsite_id,
    report_row.bring_list_id,
    report_row.quantity,
    report_row.unit,
    report_row.booking_type,
    p_actor_id,
    coalesce(nullif(p_note, ''), report_row.notes)
  )
  returning id into movement_id;

  update public.material_usage_reports
  set status = 'confirmed',
      movement_id = movement_id,
      confirmed_by = p_actor_id,
      confirmed_at = now(),
      notes = coalesce(nullif(p_note, ''), notes),
      updated_at = now()
  where id = report_row.id
    and company_id = p_company_id;

  if current_item.minimum_stock > 0 and next_stock <= current_item.minimum_stock then
    update public.material_alerts
    set status = 'open',
        severity = case when next_stock <= 0 then 'critical' else 'warning' end,
        alert_type = case when next_stock <= 0 then 'out_of_stock' else 'low_stock' end,
        message = current_item.name || ' ist knapp: ' || next_stock || ' ' || current_item.unit || ' verfuegbar.',
        available_quantity = next_stock,
        missing_quantity = greatest(current_item.minimum_stock - next_stock, 0),
        unit = current_item.unit,
        resolved_at = null
    where id = (
      select id
      from public.material_alerts
      where company_id = p_company_id
        and inventory_item_id = current_item.id
        and status in ('open', 'acknowledged')
        and alert_type in ('low_stock', 'out_of_stock')
      order by created_at desc
      limit 1
    )
    returning id into existing_alert_id;

    if existing_alert_id is null then
      insert into public.material_alerts (
        company_id,
        inventory_item_id,
        job_id,
        alert_type,
        severity,
        message,
        required_quantity,
        available_quantity,
        missing_quantity,
        unit,
        created_by_system
      )
      values (
        p_company_id,
        current_item.id,
        report_row.jobsite_id,
        case when next_stock <= 0 then 'out_of_stock' else 'low_stock' end,
        case when next_stock <= 0 then 'critical' else 'warning' end,
        current_item.name || ' ist knapp: ' || next_stock || ' ' || current_item.unit || ' verfuegbar.',
        current_item.minimum_stock,
        next_stock,
        greatest(current_item.minimum_stock - next_stock, 0),
        current_item.unit,
        true
      );
    end if;
  elsif current_item.minimum_stock > 0 and next_stock > current_item.minimum_stock then
    update public.material_alerts
    set status = 'resolved',
        resolved_at = now()
    where company_id = p_company_id
      and inventory_item_id = current_item.id
      and status in ('open', 'acknowledged')
      and alert_type in ('low_stock', 'out_of_stock');
  end if;

  insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
  values (
    p_company_id,
    p_actor_id,
    'material_usage_report',
    report_row.id,
    'material_usage_confirmed',
    jsonb_build_object('stock', current_item.stock, 'status', report_row.status),
    jsonb_build_object(
      'stock', next_stock,
      'status', 'confirmed',
      'movement_id', movement_id,
      'inventory_item_id', current_item.id,
      'jobsite_id', report_row.jobsite_id,
      'booking_type', report_row.booking_type,
      'quantity', report_row.quantity
    )
  );

  return movement_id;
end;
$$;

create or replace function public.reserve_inventory_for_jobsite(
  p_company_id uuid,
  p_jobsite_id uuid,
  p_inventory_item_id uuid,
  p_quantity_required numeric,
  p_quantity_requested numeric,
  p_unit text,
  p_reserved_by uuid,
  p_notes text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  current_item public.inventory_items%rowtype;
  existing_reservation_id uuid;
  existing_reserved numeric := 0;
  active_reserved numeric := 0;
  available_quantity numeric;
  reserved_quantity numeric;
  reservation_status text;
begin
  if p_company_id <> public.current_company_id() or not public.can_manage_company() then
    raise exception 'not_authorized';
  end if;

  if p_reserved_by is distinct from auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if p_quantity_required < 0 or p_quantity_requested < 0 then
    raise exception 'invalid_reservation_quantity';
  end if;

  if not exists (
    select 1 from public.jobsites
    where id = p_jobsite_id
      and company_id = p_company_id
  ) then
    raise exception 'jobsite_not_found';
  end if;

  select *
  into current_item
  from public.inventory_items
  where id = p_inventory_item_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'inventory_item_not_found';
  end if;

  select id, quantity_reserved
  into existing_reservation_id, existing_reserved
  from public.material_reservations
  where company_id = p_company_id
    and job_id = p_jobsite_id
    and bring_list_id is null
    and inventory_item_id = p_inventory_item_id
    and status in ('open', 'reserved', 'partially_reserved')
  order by created_at asc
  limit 1
  for update;

  select coalesce(sum(quantity_reserved), 0)
  into active_reserved
  from public.material_reservations
  where company_id = p_company_id
    and inventory_item_id = p_inventory_item_id
    and status in ('open', 'reserved', 'partially_reserved');

  available_quantity := greatest(current_item.stock - active_reserved + coalesce(existing_reserved, 0), 0);
  reserved_quantity := least(p_quantity_requested, available_quantity);
  reservation_status := case
    when reserved_quantity <= 0 then 'missing'
    when reserved_quantity < p_quantity_required then 'partially_reserved'
    else 'reserved'
  end;

  if existing_reservation_id is not null then
    update public.material_reservations
    set quantity_required = p_quantity_required,
        quantity_reserved = reserved_quantity,
        unit = p_unit,
        status = reservation_status,
        reserved_by = p_reserved_by,
        reserved_at = now(),
        updated_at = now()
    where id = existing_reservation_id
      and company_id = p_company_id
    returning id into existing_reservation_id;
  else
    insert into public.material_reservations (
      company_id,
      job_id,
      inventory_item_id,
      quantity_required,
      quantity_reserved,
      unit,
      status,
      reserved_by,
      reserved_at
    )
    values (
      p_company_id,
      p_jobsite_id,
      p_inventory_item_id,
      p_quantity_required,
      reserved_quantity,
      p_unit,
      reservation_status,
      p_reserved_by,
      now()
    )
    returning id into existing_reservation_id;
  end if;

  insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, new_values)
  values (
    p_company_id,
    p_reserved_by,
    'material_reservation',
    existing_reservation_id,
    'material_reserved',
    jsonb_build_object(
      'inventory_item_id', p_inventory_item_id,
      'jobsite_id', p_jobsite_id,
      'quantity_required', p_quantity_required,
      'quantity_reserved', reserved_quantity,
      'available_before_reservation', available_quantity,
      'notes', nullif(p_notes, '')
    )
  );

  return existing_reservation_id;
end;
$$;

grant execute on function public.confirm_material_usage_report(uuid, uuid, uuid, text, text) to authenticated;
grant execute on function public.reserve_inventory_for_jobsite(uuid, uuid, uuid, numeric, numeric, text, uuid, text) to authenticated;

select pg_notify('pgrst', 'reload schema');
