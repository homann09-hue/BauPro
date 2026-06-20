-- Sammel-Fix fuer Datenbanken, bei denen einzelne spaetere Spalten noch fehlen.
-- Idempotent: kann gefahrlos mehrfach im Supabase SQL Editor ausgefuehrt werden.

alter table public.time_entries
  add column if not exists archived_at timestamptz,
  add column if not exists weather_summary text,
  add column if not exists weather_temperature_c numeric,
  add column if not exists weather_precipitation_mm numeric,
  add column if not exists weather_wind_kmh numeric,
  add column if not exists weather_source text,
  add column if not exists weather_fetched_at timestamptz,
  add column if not exists weather_lat numeric,
  add column if not exists weather_lng numeric;

alter table public.reports
  add column if not exists archived_at timestamptz,
  add column if not exists weather_summary text,
  add column if not exists weather_temperature_c numeric,
  add column if not exists weather_precipitation_mm numeric,
  add column if not exists weather_wind_kmh numeric,
  add column if not exists weather_source text,
  add column if not exists weather_fetched_at timestamptz,
  add column if not exists weather_lat numeric,
  add column if not exists weather_lng numeric;

alter table public.customers add column if not exists archived_at timestamptz;
alter table public.jobsites add column if not exists archived_at timestamptz;
alter table public.orders add column if not exists archived_at timestamptz;
alter table public.materials add column if not exists archived_at timestamptz;
alter table public.inventory_items add column if not exists archived_at timestamptz;
alter table public.vehicles add column if not exists archived_at timestamptz;
alter table public.tasks add column if not exists archived_at timestamptz;
alter table public.report_photos add column if not exists archived_at timestamptz;
alter table public.job_dimensions add column if not exists archived_at timestamptz;
alter table public.job_material_requirements add column if not exists archived_at timestamptz;
alter table public.vehicle_materials add column if not exists archived_at timestamptz;

create index if not exists time_entries_archived_idx on public.time_entries(company_id, archived_at, date desc);
create index if not exists reports_archived_idx on public.reports(company_id, archived_at, report_date desc);
create index if not exists customers_archived_idx on public.customers(company_id, archived_at);
create index if not exists jobsites_archived_idx on public.jobsites(company_id, archived_at);
create index if not exists orders_archived_idx on public.orders(company_id, archived_at);
create index if not exists materials_archived_idx on public.materials(company_id, archived_at);
create index if not exists inventory_items_archived_idx on public.inventory_items(company_id, archived_at);
create index if not exists vehicles_archived_idx on public.vehicles(company_id, archived_at);
create index if not exists tasks_archived_idx on public.tasks(company_id, archived_at);
create index if not exists report_photos_archived_idx on public.report_photos(company_id, archived_at, report_id, created_at desc);
create index if not exists job_dimensions_archived_idx on public.job_dimensions(company_id, archived_at, order_id);
create index if not exists job_material_requirements_archived_idx on public.job_material_requirements(company_id, archived_at, order_id);
create index if not exists vehicle_materials_archived_idx on public.vehicle_materials(company_id, archived_at, vehicle_id);

select pg_notify('pgrst', 'reload schema');
