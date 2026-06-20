-- Plantafel-Wetter: Cache, Risikoauswertung und Chef-Entscheidung je Planung.
-- Open-Meteo wird serverseitig genutzt; Frontend erhaelt keine API-Keys.

create table if not exists public.planning_weather_checks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  planning_assignment_id uuid not null references public.planning_assignments(id) on delete cascade,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  risk_level text not null default 'green' check (risk_level in ('green', 'yellow', 'red')),
  summary text not null,
  rule_codes text[] not null default '{}',
  temperature_min_c numeric,
  temperature_max_c numeric,
  precipitation_mm numeric,
  precipitation_probability numeric,
  wind_kmh numeric,
  wind_gust_kmh numeric,
  weather_code integer,
  source text not null default 'Open-Meteo Forecast',
  fetched_at timestamptz not null default now(),
  acknowledged_action text check (acknowledged_action in ('confirmed', 'ignored')),
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  acknowledgment_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (planning_assignment_id),
  check (period_end >= period_start)
);

create index if not exists planning_weather_checks_company_risk_idx
  on public.planning_weather_checks(company_id, risk_level, fetched_at desc);
create index if not exists planning_weather_checks_jobsite_period_idx
  on public.planning_weather_checks(company_id, jobsite_id, period_start, period_end);
create index if not exists planning_weather_checks_ack_idx
  on public.planning_weather_checks(company_id, acknowledged_action, acknowledged_at);

alter table public.planning_weather_checks enable row level security;
alter table public.planning_weather_checks force row level security;

drop policy if exists "read relevant planning weather checks" on public.planning_weather_checks;
create policy "read relevant planning weather checks"
on public.planning_weather_checks for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = public.current_company_id()
        and p.role = 'vorarbeiter'
        and p.active
    )
    or exists (
      select 1
      from public.planning_assignments pa
      where pa.id = planning_assignment_id
        and pa.company_id = public.current_company_id()
        and pa.resource_type = 'employee'
        and pa.employee_id = auth.uid()
        and pa.archived_at is null
    )
  )
);

drop policy if exists "managers insert planning weather checks" on public.planning_weather_checks;
create policy "managers insert planning weather checks"
on public.planning_weather_checks for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update planning weather checks" on public.planning_weather_checks;
create policy "managers update planning weather checks"
on public.planning_weather_checks for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop trigger if exists set_planning_weather_checks_updated_at on public.planning_weather_checks;
create trigger set_planning_weather_checks_updated_at
before update on public.planning_weather_checks
for each row execute function public.set_updated_at();

select pg_notify('pgrst', 'reload schema');
