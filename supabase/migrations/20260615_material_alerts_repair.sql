-- Repair migration for projects where the app already references bring lists,
-- material alerts and purchase suggestions, but the remote Supabase database
-- does not have the full feature table chain in its schema cache yet.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.voice_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  raw_text text not null,
  detected_intent text not null default 'unknown' check (
    detected_intent in ('bring_list', 'time_tracking', 'material_alert', 'job_note', 'unknown')
  ),
  detected_entities jsonb not null default '{}'::jsonb,
  linked_customer_id uuid,
  linked_job_id uuid,
  linked_time_entry_id uuid,
  linked_bring_list_id uuid,
  linked_material_alert_id uuid,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'discarded')),
  created_at timestamptz not null default now()
);

create table if not exists public.voice_routing_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  keyword text not null,
  intent text not null check (intent in ('bring_list', 'time_tracking', 'material_alert', 'job_note', 'unknown')),
  priority integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bring_lists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobsites(id) on delete cascade,
  date date not null,
  title text not null,
  notes text,
  status text not null default 'draft' check (status in ('draft', 'ready', 'packed', 'delivered')),
  created_by uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bring_list_items (
  id uuid primary key default gen_random_uuid(),
  bring_list_id uuid not null references public.bring_lists(id) on delete cascade,
  material_id uuid references public.materials(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  custom_item_name text not null,
  item_type text not null default 'material' check (item_type in ('material', 'tool', 'document', 'safety', 'other')),
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit text not null default 'Stueck',
  storage_location text,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  packed boolean not null default false,
  packed_by uuid references public.profiles(id) on delete set null,
  packed_at timestamptz,
  missing_reported boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

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

create table if not exists public.material_alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  material_id uuid references public.materials(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  job_id uuid references public.jobsites(id) on delete cascade,
  bring_list_id uuid references public.bring_lists(id) on delete cascade,
  alert_type text not null check (
    alert_type in ('low_stock', 'out_of_stock', 'missing_for_job', 'below_minimum_after_reservation')
  ),
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  message text not null,
  required_quantity numeric(12, 2),
  available_quantity numeric(12, 2),
  missing_quantity numeric(12, 2),
  unit text,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  created_by_system boolean not null default true,
  assigned_to_admin uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);

create table if not exists public.purchase_suggestions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  material_id uuid references public.materials(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  job_id uuid references public.jobsites(id) on delete cascade,
  bring_list_id uuid references public.bring_lists(id) on delete cascade,
  quantity_needed numeric(12, 2) not null default 0 check (quantity_needed > 0),
  unit text not null default 'Stueck',
  reason text not null,
  status text not null default 'open' check (status in ('open', 'ordered', 'ignored', 'received')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.customers') is not null then
    alter table public.voice_notes
    drop constraint if exists voice_notes_linked_customer_id_fkey;

    alter table public.voice_notes
    add constraint voice_notes_linked_customer_id_fkey
    foreign key (linked_customer_id) references public.customers(id) on delete set null;
  end if;

  if to_regclass('public.jobsites') is not null then
    alter table public.voice_notes
    drop constraint if exists voice_notes_linked_job_id_fkey;

    alter table public.voice_notes
    add constraint voice_notes_linked_job_id_fkey
    foreign key (linked_job_id) references public.jobsites(id) on delete set null;
  end if;

  if to_regclass('public.time_entries') is not null then
    alter table public.voice_notes
    drop constraint if exists voice_notes_linked_time_entry_id_fkey;

    alter table public.voice_notes
    add constraint voice_notes_linked_time_entry_id_fkey
    foreign key (linked_time_entry_id) references public.time_entries(id) on delete set null;
  end if;

  alter table public.voice_notes
  drop constraint if exists voice_notes_linked_bring_list_id_fkey;

  alter table public.voice_notes
  add constraint voice_notes_linked_bring_list_id_fkey
  foreign key (linked_bring_list_id) references public.bring_lists(id) on delete set null;

  if to_regclass('public.voice_notes') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'voice_notes'
        and column_name = 'linked_material_alert_id'
    )
  then
    alter table public.voice_notes
    drop constraint if exists voice_notes_linked_material_alert_id_fkey;

    alter table public.voice_notes
    add constraint voice_notes_linked_material_alert_id_fkey
    foreign key (linked_material_alert_id) references public.material_alerts(id) on delete set null;
  end if;
end $$;

create index if not exists voice_notes_company_created_idx on public.voice_notes(company_id, created_at desc);
create index if not exists voice_notes_user_idx on public.voice_notes(user_id, created_at desc);
create index if not exists voice_routing_rules_company_idx on public.voice_routing_rules(company_id, priority);
create index if not exists bring_lists_company_date_idx on public.bring_lists(company_id, date);
create index if not exists bring_lists_job_idx on public.bring_lists(job_id, date);
create index if not exists bring_lists_assigned_to_idx on public.bring_lists(assigned_to, date);
create index if not exists bring_list_items_list_idx on public.bring_list_items(bring_list_id);
create index if not exists bring_list_items_inventory_idx on public.bring_list_items(inventory_item_id);
create index if not exists material_reservations_company_idx on public.material_reservations(company_id, status);
create index if not exists material_reservations_inventory_idx on public.material_reservations(inventory_item_id, status);
create index if not exists material_reservations_bring_list_idx on public.material_reservations(bring_list_id);
create index if not exists material_alerts_company_status_idx on public.material_alerts(company_id, status, severity);
create index if not exists material_alerts_inventory_idx on public.material_alerts(inventory_item_id, status);
create index if not exists material_alerts_bring_list_idx on public.material_alerts(bring_list_id, status);
create index if not exists purchase_suggestions_company_status_idx on public.purchase_suggestions(company_id, status);
create index if not exists purchase_suggestions_inventory_idx on public.purchase_suggestions(inventory_item_id, status);

drop trigger if exists set_bring_lists_updated_at on public.bring_lists;
create trigger set_bring_lists_updated_at
before update on public.bring_lists
for each row execute function public.set_updated_at();

drop trigger if exists set_material_reservations_updated_at on public.material_reservations;
create trigger set_material_reservations_updated_at
before update on public.material_reservations
for each row execute function public.set_updated_at();

drop trigger if exists set_purchase_suggestions_updated_at on public.purchase_suggestions;
create trigger set_purchase_suggestions_updated_at
before update on public.purchase_suggestions
for each row execute function public.set_updated_at();

alter table public.voice_notes enable row level security;
alter table public.voice_routing_rules enable row level security;
alter table public.bring_lists enable row level security;
alter table public.bring_list_items enable row level security;
alter table public.material_reservations enable row level security;
alter table public.material_alerts enable row level security;
alter table public.purchase_suggestions enable row level security;

grant select, insert, update on public.voice_notes to authenticated;
grant select on public.voice_routing_rules to authenticated;
grant select, insert, update, delete on public.bring_lists to authenticated;
grant select, insert, update, delete on public.bring_list_items to authenticated;
grant select, insert, update on public.material_reservations to authenticated;
grant select, insert, update on public.material_alerts to authenticated;
grant select, insert, update on public.purchase_suggestions to authenticated;

drop policy if exists "read own voice notes" on public.voice_notes;
create policy "read own voice notes"
on public.voice_notes for select
to authenticated
using (company_id = public.current_company_id() and (public.can_manage_company() or user_id = auth.uid()));

drop policy if exists "create own voice notes" on public.voice_notes;
create policy "create own voice notes"
on public.voice_notes for insert
to authenticated
with check (company_id = public.current_company_id() and user_id = auth.uid());

drop policy if exists "read active voice routing rules" on public.voice_routing_rules;
create policy "read active voice routing rules"
on public.voice_routing_rules for select
to authenticated
using (active = true and (company_id is null or company_id = public.current_company_id()));

drop policy if exists "read relevant bring lists" on public.bring_lists;
create policy "read relevant bring lists"
on public.bring_lists for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or assigned_to = auth.uid()
    or created_by = auth.uid()
  )
);

drop policy if exists "create bring lists" on public.bring_lists;
create policy "create bring lists"
on public.bring_lists for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and (public.can_manage_company() or created_by = auth.uid())
);

drop policy if exists "update relevant bring lists" on public.bring_lists;
create policy "update relevant bring lists"
on public.bring_lists for update
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or assigned_to = auth.uid()
    or created_by = auth.uid()
  )
)
with check (company_id = public.current_company_id());

drop policy if exists "managers delete bring lists" on public.bring_lists;
create policy "managers delete bring lists"
on public.bring_lists for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "read relevant bring list items" on public.bring_list_items;
create policy "read relevant bring list items"
on public.bring_list_items for select
to authenticated
using (
  exists (
    select 1 from public.bring_lists bl
    where bl.id = bring_list_id
      and bl.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or bl.assigned_to = auth.uid()
        or bl.created_by = auth.uid()
      )
  )
);

drop policy if exists "create relevant bring list items" on public.bring_list_items;
create policy "create relevant bring list items"
on public.bring_list_items for insert
to authenticated
with check (
  exists (
    select 1 from public.bring_lists bl
    where bl.id = bring_list_id
      and bl.company_id = public.current_company_id()
      and (public.can_manage_company() or bl.created_by = auth.uid())
  )
);

drop policy if exists "update relevant bring list items" on public.bring_list_items;
create policy "update relevant bring list items"
on public.bring_list_items for update
to authenticated
using (
  exists (
    select 1 from public.bring_lists bl
    where bl.id = bring_list_id
      and bl.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or bl.assigned_to = auth.uid()
        or bl.created_by = auth.uid()
      )
  )
)
with check (
  exists (
    select 1 from public.bring_lists bl
    where bl.id = bring_list_id
      and bl.company_id = public.current_company_id()
  )
);

drop policy if exists "managers delete bring list items" on public.bring_list_items;
create policy "managers delete bring list items"
on public.bring_list_items for delete
to authenticated
using (
  exists (
    select 1 from public.bring_lists bl
    where bl.id = bring_list_id
      and bl.company_id = public.current_company_id()
      and public.can_manage_company()
  )
);

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
        and (bl.assigned_to = auth.uid() or bl.created_by = auth.uid())
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

drop policy if exists "read relevant material alerts" on public.material_alerts;
create policy "read relevant material alerts"
on public.material_alerts for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or exists (
      select 1 from public.bring_lists bl
      where bl.id = bring_list_id
        and (bl.assigned_to = auth.uid() or bl.created_by = auth.uid())
    )
  )
);

drop policy if exists "create material alerts" on public.material_alerts;
create policy "create material alerts"
on public.material_alerts for insert
to authenticated
with check (company_id = public.current_company_id());

drop policy if exists "managers update material alerts" on public.material_alerts;
create policy "managers update material alerts"
on public.material_alerts for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers read purchase suggestions" on public.purchase_suggestions;
create policy "managers read purchase suggestions"
on public.purchase_suggestions for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "company members create purchase suggestions" on public.purchase_suggestions;
create policy "company members create purchase suggestions"
on public.purchase_suggestions for insert
to authenticated
with check (company_id = public.current_company_id());

drop policy if exists "managers update purchase suggestions" on public.purchase_suggestions;
create policy "managers update purchase suggestions"
on public.purchase_suggestions for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

insert into public.voice_routing_rules (keyword, intent, priority)
select keyword, intent, priority
from (
  values
    ('mitnehmen', 'bring_list', 10),
    ('mitbringliste', 'bring_list', 10),
    ('einpacken', 'bring_list', 20),
    ('gearbeitet', 'time_tracking', 10),
    ('arbeitszeit', 'time_tracking', 10),
    ('pause', 'time_tracking', 30),
    ('fehlt', 'material_alert', 10),
    ('fehlen', 'material_alert', 10),
    ('knapp', 'material_alert', 20)
) as defaults(keyword, intent, priority)
where not exists (
  select 1 from public.voice_routing_rules existing
  where existing.company_id is null
    and existing.keyword = defaults.keyword
    and existing.intent = defaults.intent
);

notify pgrst, 'reload schema';
