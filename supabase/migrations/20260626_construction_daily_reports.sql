-- Bautagesbericht-Workflow, Arbeitszeit-/Fahrzeug-Verknuepfung und Freigabe.
-- Safe to run multiple times.

alter table public.reports add column if not exists report_status text not null default 'draft'
  check (report_status in ('draft', 'submitted', 'reviewed', 'approved'));
alter table public.reports add column if not exists submitted_at timestamptz;
alter table public.reports add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.reports add column if not exists reviewed_at timestamptz;
alter table public.reports add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.reports add column if not exists approved_at timestamptz;
alter table public.reports add column if not exists machine_usage text;
alter table public.reports add column if not exists vehicle_ids uuid[] not null default '{}';
alter table public.reports add column if not exists linked_time_entry_ids uuid[] not null default '{}';

create index if not exists reports_workflow_idx
  on public.reports(company_id, report_status, report_date desc)
  where archived_at is null;
create index if not exists reports_time_link_idx
  on public.reports(company_id, report_date desc)
  where cardinality(linked_time_entry_ids) > 0 and archived_at is null;

create or replace function public.prevent_signed_report_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.signature_status in ('signed', 'rejected') or old.report_status = 'approved' then
    if new.company_id is distinct from old.company_id
      or new.jobsite_id is distinct from old.jobsite_id
      or new.report_date is distinct from old.report_date
      or new.weather is distinct from old.weather
      or new.weather_summary is distinct from old.weather_summary
      or new.weather_temperature_c is distinct from old.weather_temperature_c
      or new.weather_precipitation_mm is distinct from old.weather_precipitation_mm
      or new.weather_wind_kmh is distinct from old.weather_wind_kmh
      or new.weather_source is distinct from old.weather_source
      or new.weather_fetched_at is distinct from old.weather_fetched_at
      or new.weather_lat is distinct from old.weather_lat
      or new.weather_lng is distinct from old.weather_lng
      or new.work_start is distinct from old.work_start
      or new.work_end is distinct from old.work_end
      or new.employee_ids is distinct from old.employee_ids
      or new.activities is distinct from old.activities
      or new.material_usage is distinct from old.material_usage
      or new.machine_usage is distinct from old.machine_usage
      or new.vehicle_ids is distinct from old.vehicle_ids
      or new.linked_time_entry_ids is distinct from old.linked_time_entry_ids
      or new.issues is distinct from old.issues
      or new.signature_name is distinct from old.signature_name
      or new.source_report_id is distinct from old.source_report_id
      or new.document_version is distinct from old.document_version
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      -- Signierte Tagesberichte koennen nicht geaendert werden; freigegebene Berichte sind ebenfalls gesperrt.
      raise exception 'Freigegebene oder signierte Bautagesberichte koennen nicht geaendert werden. Bitte neue Version erzeugen.';
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_signed_report_mutation on public.reports;
create trigger prevent_signed_report_mutation
before update on public.reports
for each row execute function public.prevent_signed_report_mutation();

drop policy if exists "update relevant reports" on public.reports;
create policy "update relevant reports"
on public.reports for update
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and (
    public.can_manage_company()
    or (
      created_by = auth.uid()
      and report_status in ('draft', 'submitted')
    )
  )
)
with check (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or (
      created_by = auth.uid()
      and report_status in ('draft', 'submitted')
    )
  )
);

select pg_notify('pgrst', 'reload schema');
