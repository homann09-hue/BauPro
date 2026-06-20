-- Plantafel: Ressourcen und Einsaetze fuer Mitarbeiter, Fahrzeuge und Geraete.
-- Schreibrechte bleiben bei Chef/Admin; Vorarbeiter duerfen die Firmenplanung lesen.

create table if not exists public.planning_resources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  resource_kind text not null default 'geraet'
    check (resource_kind in ('geraet', 'maschine', 'werkzeug', 'sonstiges')),
  status text not null default 'verfuegbar'
    check (status in ('verfuegbar', 'werkstatt', 'defekt', 'reserviert', 'archiviert')),
  notes text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.planning_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid references public.jobsites(id) on delete set null,
  title text not null,
  resource_type text not null check (resource_type in ('employee', 'vehicle', 'equipment')),
  employee_id uuid references public.profiles(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  planning_resource_id uuid references public.planning_resources(id) on delete set null,
  start_date date not null,
  end_date date not null,
  status text not null default 'geplant'
    check (status in ('geplant', 'aktiv', 'erledigt', 'verschoben', 'krank', 'urlaub', 'werkstatt', 'defekt', 'weiterbildung')),
  color text not null default '#2E7D32',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (end_date >= start_date),
  check (
    (resource_type = 'employee' and employee_id is not null and vehicle_id is null and planning_resource_id is null)
    or (resource_type = 'vehicle' and vehicle_id is not null and employee_id is null and planning_resource_id is null)
    or (resource_type = 'equipment' and planning_resource_id is not null and employee_id is null and vehicle_id is null)
  )
);

create index if not exists planning_resources_company_idx
  on public.planning_resources(company_id, resource_kind, active, archived_at, name);
create index if not exists planning_assignments_company_period_idx
  on public.planning_assignments(company_id, start_date, end_date, archived_at);
create index if not exists planning_assignments_employee_idx
  on public.planning_assignments(company_id, employee_id, start_date, end_date)
  where archived_at is null and employee_id is not null;
create index if not exists planning_assignments_vehicle_idx
  on public.planning_assignments(company_id, vehicle_id, start_date, end_date)
  where archived_at is null and vehicle_id is not null;
create index if not exists planning_assignments_resource_idx
  on public.planning_assignments(company_id, planning_resource_id, start_date, end_date)
  where archived_at is null and planning_resource_id is not null;
create index if not exists planning_assignments_jobsite_idx
  on public.planning_assignments(company_id, jobsite_id, start_date, end_date)
  where archived_at is null and jobsite_id is not null;

alter table public.planning_resources enable row level security;
alter table public.planning_assignments enable row level security;
alter table public.planning_resources force row level security;
alter table public.planning_assignments force row level security;

drop policy if exists "members read planning resources" on public.planning_resources;
create policy "members read planning resources"
on public.planning_resources for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and (
    public.can_manage_company()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = public.current_company_id()
        and p.role in ('vorarbeiter', 'mitarbeiter')
        and p.active
    )
  )
);

drop policy if exists "managers write planning resources" on public.planning_resources;
drop policy if exists "managers insert planning resources" on public.planning_resources;
create policy "managers insert planning resources"
on public.planning_resources for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update planning resources" on public.planning_resources;
create policy "managers update planning resources"
on public.planning_resources for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "members read planning assignments" on public.planning_assignments;
create policy "members read planning assignments"
on public.planning_assignments for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
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
    or (resource_type = 'employee' and employee_id = auth.uid())
  )
);

drop policy if exists "managers write planning assignments" on public.planning_assignments;
drop policy if exists "managers insert planning assignments" on public.planning_assignments;
create policy "managers insert planning assignments"
on public.planning_assignments for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update planning assignments" on public.planning_assignments;
create policy "managers update planning assignments"
on public.planning_assignments for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop trigger if exists set_planning_resources_updated_at on public.planning_resources;
create trigger set_planning_resources_updated_at
before update on public.planning_resources
for each row execute function public.set_updated_at();

drop trigger if exists set_planning_assignments_updated_at on public.planning_assignments;
create trigger set_planning_assignments_updated_at
before update on public.planning_assignments
for each row execute function public.set_updated_at();

select pg_notify('pgrst', 'reload schema');
