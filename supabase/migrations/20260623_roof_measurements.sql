-- Position-based roof measurement / Aufmass for orders.

create table if not exists public.order_measurement_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  item_type text not null default 'roof_area' check (
    item_type in ('roof_area', 'deduction_area', 'eaves_length', 'ridge_length', 'verge_length', 'valley_length', 'wall_connection_length', 'downpipe_length', 'roof_window', 'penetration', 'roof_drain', 'emergency_overflow')
  ),
  label text not null,
  length_m numeric(12, 2),
  width_m numeric(12, 2),
  quantity numeric(12, 2) not null default 1,
  pitch_deg numeric(7, 2),
  calculated_area_m2 numeric(12, 2) not null default 0,
  calculated_length_m numeric(12, 2) not null default 0,
  count_value integer not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity >= 0),
  check (count_value >= 0)
);

create index if not exists order_measurement_items_order_idx
  on public.order_measurement_items(company_id, order_id, archived_at, created_at desc);

alter table public.order_measurement_items enable row level security;
alter table public.order_measurement_items force row level security;

drop policy if exists "managers read order measurement items" on public.order_measurement_items;
create policy "managers read order measurement items"
on public.order_measurement_items for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers insert order measurement items" on public.order_measurement_items;
create policy "managers insert order measurement items"
on public.order_measurement_items for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update order measurement items" on public.order_measurement_items;
create policy "managers update order measurement items"
on public.order_measurement_items for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop trigger if exists set_order_measurement_items_updated_at on public.order_measurement_items;
create trigger set_order_measurement_items_updated_at
before update on public.order_measurement_items
for each row execute function public.set_updated_at();

drop policy if exists "redteam managers delete fallback" on public.order_measurement_items;
drop policy if exists "managers can delete order measurement items" on public.order_measurement_items;

select pg_notify('pgrst', 'reload schema');
