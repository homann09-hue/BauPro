alter table public.jobsites
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists weather_last_checked_at timestamptz;

create table if not exists public.weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  temperature_c numeric,
  precipitation_mm numeric,
  wind_kmh numeric,
  weather_code integer,
  risk_level text not null default 'green' check (risk_level in ('green', 'yellow', 'red')),
  summary text,
  source text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists jobsites_weather_location_idx on public.jobsites(company_id, latitude, longitude);
create index if not exists weather_snapshots_company_jobsite_idx on public.weather_snapshots(company_id, jobsite_id, fetched_at desc);

alter table public.weather_snapshots enable row level security;
alter table public.weather_snapshots force row level security;

drop policy if exists "managers can read weather snapshots" on public.weather_snapshots;
create policy "managers can read weather snapshots"
on public.weather_snapshots for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert weather snapshots" on public.weather_snapshots;
create policy "managers can insert weather snapshots"
on public.weather_snapshots for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update weather snapshots" on public.weather_snapshots;
create policy "managers can update weather snapshots"
on public.weather_snapshots for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete weather snapshots" on public.weather_snapshots;
create policy "managers can delete weather snapshots"
on public.weather_snapshots for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());
