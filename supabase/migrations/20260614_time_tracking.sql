-- BauPro migration: Mitarbeiter-Zeiterfassung und Stundenzettel.

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete restrict,
  job_id uuid not null references public.jobsites(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  date date not null,
  work_location text not null,
  work_address text not null,
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  gross_minutes integer not null default 0 check (gross_minutes >= 0),
  net_minutes integer not null default 0 check (net_minutes >= 0),
  activity text not null,
  weather text,
  kilometers numeric(10, 1),
  notes text,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  check (break_minutes <= gross_minutes),
  check (net_minutes = gross_minutes - break_minutes)
);

create table if not exists public.time_entry_audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  old_values jsonb,
  new_values jsonb,
  change_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.time_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid references public.profiles(id) on delete set null,
  month integer not null check (month between 1 and 12),
  year integer not null check (year between 2000 and 2100),
  date_from date not null,
  date_to date not null,
  status text not null default 'generated' check (status in ('generated', 'approved', 'archived')),
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  check (date_to >= date_from)
);

create table if not exists public.time_report_entries (
  id uuid primary key default gen_random_uuid(),
  time_report_id uuid not null references public.time_reports(id) on delete cascade,
  time_entry_id uuid not null references public.time_entries(id) on delete restrict,
  unique (time_report_id, time_entry_id)
);

create index if not exists time_entries_company_date_idx on public.time_entries(company_id, date desc);
create index if not exists time_entries_employee_date_idx on public.time_entries(employee_id, date desc);
create index if not exists time_entries_job_id_idx on public.time_entries(job_id);
create index if not exists time_entries_status_idx on public.time_entries(company_id, status);
create index if not exists time_entry_audit_log_entry_idx on public.time_entry_audit_log(time_entry_id, created_at desc);
create index if not exists time_reports_company_period_idx on public.time_reports(company_id, year desc, month desc);
create index if not exists time_reports_employee_period_idx on public.time_reports(employee_id, year desc, month desc);
create index if not exists time_report_entries_report_idx on public.time_report_entries(time_report_id);
create index if not exists time_report_entries_entry_idx on public.time_report_entries(time_entry_id);

drop trigger if exists set_time_entries_updated_at on public.time_entries;
create trigger set_time_entries_updated_at
before update on public.time_entries
for each row execute function public.set_updated_at();

alter table public.time_entries enable row level security;
alter table public.time_entry_audit_log enable row level security;
alter table public.time_reports enable row level security;
alter table public.time_report_entries enable row level security;

drop policy if exists "read relevant time entries" on public.time_entries;
create policy "read relevant time entries"
on public.time_entries for select
to authenticated
using (
  company_id = public.current_company_id()
  and (public.can_manage_company() or employee_id = auth.uid())
);

drop policy if exists "create time entries" on public.time_entries;
create policy "create time entries"
on public.time_entries for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or (
      employee_id = auth.uid()
      and created_by = auth.uid()
      and status in ('draft', 'submitted')
    )
  )
);

drop policy if exists "update relevant time entries" on public.time_entries;
create policy "update relevant time entries"
on public.time_entries for update
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or (employee_id = auth.uid() and status <> 'approved')
  )
)
with check (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or (
      employee_id = auth.uid()
      and approved_by is null
      and approved_at is null
      and status in ('draft', 'submitted', 'rejected')
    )
  )
);

drop policy if exists "managers can delete time entries" on public.time_entries;
create policy "managers can delete time entries"
on public.time_entries for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "read relevant time audits" on public.time_entry_audit_log;
create policy "read relevant time audits"
on public.time_entry_audit_log for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or exists (
      select 1 from public.time_entries te
      where te.id = time_entry_id
        and te.employee_id = auth.uid()
    )
  )
);

drop policy if exists "create time audits" on public.time_entry_audit_log;
create policy "create time audits"
on public.time_entry_audit_log for insert
to authenticated
with check (company_id = public.current_company_id() and changed_by = auth.uid());

drop policy if exists "managers can read time reports" on public.time_reports;
create policy "managers can read time reports"
on public.time_reports for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert time reports" on public.time_reports;
create policy "managers can insert time reports"
on public.time_reports for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update time reports" on public.time_reports;
create policy "managers can update time reports"
on public.time_reports for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete time reports" on public.time_reports;
create policy "managers can delete time reports"
on public.time_reports for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can read time report entries" on public.time_report_entries;
create policy "managers can read time report entries"
on public.time_report_entries for select
to authenticated
using (
  exists (
    select 1 from public.time_reports tr
    where tr.id = time_report_id
      and tr.company_id = public.current_company_id()
      and public.can_manage_company()
  )
);

drop policy if exists "managers can insert time report entries" on public.time_report_entries;
create policy "managers can insert time report entries"
on public.time_report_entries for insert
to authenticated
with check (
  exists (
    select 1 from public.time_reports tr
    where tr.id = time_report_id
      and tr.company_id = public.current_company_id()
      and public.can_manage_company()
  )
);

drop policy if exists "managers can delete time report entries" on public.time_report_entries;
create policy "managers can delete time report entries"
on public.time_report_entries for delete
to authenticated
using (
  exists (
    select 1 from public.time_reports tr
    where tr.id = time_report_id
      and tr.company_id = public.current_company_id()
      and public.can_manage_company()
  )
);

select pg_notify('pgrst', 'reload schema');
