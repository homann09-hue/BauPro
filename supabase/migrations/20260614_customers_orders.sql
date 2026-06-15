-- BauPro migration: Kundenkartei, Auftraege, Masse und automatischer Materialbedarf.
-- Voraussetzung: supabase/schema.sql ist bereits eingespielt.

create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_type text not null default 'privatkunde' check (
    customer_type in ('privatkunde', 'gewerbekunde', 'hausverwaltung', 'architekt', 'versicherung')
  ),
  company text,
  first_name text,
  last_name text,
  contact_person text,
  phone text,
  email text,
  billing_address text,
  jobsite_address text,
  notes text,
  tax_id text,
  payment_terms text,
  status text not null default 'aktiv' check (status in ('aktiv', 'inaktiv')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  jobsite_id uuid references public.jobsites(id) on delete set null,
  order_number text not null,
  title text not null,
  order_type text not null default 'steildach' check (
    order_type in ('steildach', 'flachdach', 'reparatur', 'dachrinne', 'blech', 'wartung', 'sonstiges')
  ),
  status text not null default 'anfrage' check (
    status in ('anfrage', 'angebot', 'geplant', 'in_arbeit', 'fertig', 'abgerechnet')
  ),
  priority text not null default 'normal' check (priority in ('niedrig', 'normal', 'hoch')),
  jobsite_address text not null,
  start_date date,
  end_date date,
  description text,
  internal_notes text,
  assigned_employee_ids uuid[] not null default '{}',
  has_dimensions boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, order_number)
);

create table if not exists public.job_dimensions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  length_m numeric(12, 2),
  width_m numeric(12, 2),
  area_m2 numeric(12, 2) not null default 0,
  roof_pitch numeric(7, 2),
  eaves_length_m numeric(12, 2),
  ridge_length_m numeric(12, 2),
  verge_length_m numeric(12, 2),
  valley_length_m numeric(12, 2),
  wall_connection_length_m numeric(12, 2),
  building_height_m numeric(12, 2),
  downpipe_length_m numeric(12, 2),
  roof_windows_count integer not null default 0,
  penetrations_count integer not null default 0,
  roof_drains_count integer not null default 0,
  emergency_overflows_count integer not null default 0,
  waste_percent numeric(7, 2) not null default 20,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id),
  check (waste_percent >= 0 and waste_percent <= 100)
);

create table if not exists public.job_material_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  dimension_id uuid references public.job_dimensions(id) on delete set null,
  jobsite_id uuid references public.jobsites(id) on delete set null,
  rule_id uuid references public.material_calculation_rules(id) on delete set null,
  catalog_item_id uuid references public.material_catalog(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  material_name text not null,
  unit text not null,
  base_quantity numeric(12, 2) not null default 0,
  waste_percent numeric(7, 2) not null default 20,
  waste_quantity numeric(12, 2) not null default 0,
  total_quantity numeric(12, 2) not null default 0,
  purchase_price numeric(12, 2),
  sales_price numeric(12, 2),
  purchase_total numeric(12, 2),
  sales_total numeric(12, 2),
  margin_total numeric(12, 2),
  location_name text,
  stock numeric(12, 2),
  minimum_stock numeric(12, 2),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (waste_percent >= 0 and waste_percent <= 100)
);

create index if not exists customers_company_id_idx on public.customers(company_id);
create index if not exists customers_status_idx on public.customers(company_id, status);
create index if not exists orders_company_id_idx on public.orders(company_id);
create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists orders_jobsite_id_idx on public.orders(jobsite_id);
create index if not exists orders_status_idx on public.orders(company_id, status);
create index if not exists orders_assigned_employee_ids_idx on public.orders using gin(assigned_employee_ids);
create index if not exists job_dimensions_order_id_idx on public.job_dimensions(order_id);
create index if not exists job_material_requirements_company_id_idx on public.job_material_requirements(company_id);
create index if not exists job_material_requirements_order_id_idx on public.job_material_requirements(order_id);
create index if not exists job_material_requirements_jobsite_id_idx on public.job_material_requirements(jobsite_id);

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists set_job_dimensions_updated_at on public.job_dimensions;
create trigger set_job_dimensions_updated_at
before update on public.job_dimensions
for each row execute function public.set_updated_at();

drop trigger if exists set_job_material_requirements_updated_at on public.job_material_requirements;
create trigger set_job_material_requirements_updated_at
before update on public.job_material_requirements
for each row execute function public.set_updated_at();

alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.job_dimensions enable row level security;
alter table public.job_material_requirements enable row level security;

drop policy if exists "managers can read customers" on public.customers;
create policy "managers can read customers"
on public.customers for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert customers" on public.customers;
create policy "managers can insert customers"
on public.customers for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update customers" on public.customers;
create policy "managers can update customers"
on public.customers for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete customers" on public.customers;
create policy "managers can delete customers"
on public.customers for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can read orders" on public.orders;
create policy "managers can read orders"
on public.orders for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert orders" on public.orders;
create policy "managers can insert orders"
on public.orders for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update orders" on public.orders;
create policy "managers can update orders"
on public.orders for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete orders" on public.orders;
create policy "managers can delete orders"
on public.orders for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "read relevant job dimensions" on public.job_dimensions;
create policy "read relevant job dimensions"
on public.job_dimensions for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or exists (
      select 1
      from public.orders o
      where o.id = order_id
        and o.company_id = public.current_company_id()
        and auth.uid() = any(o.assigned_employee_ids)
    )
  )
);

drop policy if exists "managers can insert job dimensions" on public.job_dimensions;
create policy "managers can insert job dimensions"
on public.job_dimensions for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update job dimensions" on public.job_dimensions;
create policy "managers can update job dimensions"
on public.job_dimensions for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete job dimensions" on public.job_dimensions;
create policy "managers can delete job dimensions"
on public.job_dimensions for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can read priced order requirements" on public.job_material_requirements;
create policy "managers can read priced order requirements"
on public.job_material_requirements for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert order requirements" on public.job_material_requirements;
create policy "managers can insert order requirements"
on public.job_material_requirements for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update order requirements" on public.job_material_requirements;
create policy "managers can update order requirements"
on public.job_material_requirements for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete order requirements" on public.job_material_requirements;
create policy "managers can delete order requirements"
on public.job_material_requirements for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

create or replace view public.orders_public as
select
  o.id,
  o.company_id,
  o.customer_id,
  o.jobsite_id,
  o.order_number,
  o.title,
  o.order_type,
  o.status,
  o.priority,
  o.jobsite_address,
  o.start_date,
  o.end_date,
  o.description,
  o.assigned_employee_ids,
  o.has_dimensions,
  o.created_by,
  o.created_at,
  o.updated_at,
  coalesce(
    nullif(trim(coalesce(nullif(c.company, ''), '') || ' ' || coalesce(nullif(c.first_name, ''), '') || ' ' || coalesce(nullif(c.last_name, ''), '')), ''),
    'Kunde'
  ) as customer_name
from public.orders o
join public.customers c on c.id = o.customer_id
where o.company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or auth.uid() = any(o.assigned_employee_ids)
  );

grant select on public.orders_public to authenticated;

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
  item.updated_at
from public.job_material_requirements item
join public.orders o on o.id = item.order_id
where item.company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or auth.uid() = any(o.assigned_employee_ids)
  );

grant select on public.job_material_requirements_public to authenticated;

select pg_notify('pgrst', 'reload schema');
