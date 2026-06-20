-- Digitale Unterschriften fuer Arbeitsauftraege, Tagesberichte, Abnahmen und Dokumente.
-- Safe to run multiple times.

alter table public.reports add column if not exists signature_status text not null default 'draft'
  check (signature_status in ('draft', 'signed', 'rejected'));
alter table public.reports add column if not exists signature_data_url text;
alter table public.reports add column if not exists signature_signed_at timestamptz;
alter table public.reports add column if not exists signature_role text
  check (signature_role in ('kunde', 'mitarbeiter', 'vorarbeiter', 'chef', 'admin'));
alter table public.reports add column if not exists signature_content_hash text;
alter table public.reports add column if not exists source_report_id uuid references public.reports(id) on delete set null;
alter table public.reports add column if not exists document_version integer not null default 1 check (document_version > 0);

alter table public.work_orders add column if not exists signature_role text
  check (signature_role in ('kunde', 'mitarbeiter', 'vorarbeiter', 'chef', 'admin'));

alter table public.jobsite_documents add column if not exists signature_data_url text;
alter table public.jobsite_documents add column if not exists signature_role text
  check (signature_role in ('kunde', 'mitarbeiter', 'vorarbeiter', 'chef', 'admin'));
alter table public.jobsite_documents add column if not exists signature_content_hash text;

create table if not exists public.digital_document_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_type text not null check (document_type in ('work_order', 'report', 'commercial_document', 'jobsite_document', 'acceptance')),
  document_id uuid not null,
  version integer not null default 1 check (version > 0),
  snapshot jsonb not null,
  content_hash text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (company_id, document_type, document_id, version)
);

create table if not exists public.digital_signatures (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_type text not null check (document_type in ('work_order', 'report', 'commercial_document', 'jobsite_document', 'acceptance')),
  document_id uuid not null,
  document_version integer not null default 1 check (document_version > 0),
  jobsite_id uuid references public.jobsites(id) on delete set null,
  status text not null default 'signed' check (status in ('draft', 'signed', 'rejected')),
  signer_name text not null,
  signer_role text not null check (signer_role in ('kunde', 'mitarbeiter', 'vorarbeiter', 'chef', 'admin')),
  signer_user_id uuid references public.profiles(id) on delete set null,
  signer_ip text,
  signer_user_agent text,
  signature_data_url text,
  signed_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  content_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists reports_signature_status_idx
  on public.reports(company_id, signature_status, signature_signed_at desc);
create index if not exists reports_revision_idx
  on public.reports(company_id, source_report_id, document_version desc);
create index if not exists digital_signatures_document_idx
  on public.digital_signatures(company_id, document_type, document_id, document_version);
create index if not exists digital_signatures_jobsite_idx
  on public.digital_signatures(company_id, jobsite_id, created_at desc);
create index if not exists digital_document_versions_document_idx
  on public.digital_document_versions(company_id, document_type, document_id, version desc);

alter table public.digital_signatures enable row level security;
alter table public.digital_document_versions enable row level security;
alter table public.digital_signatures force row level security;
alter table public.digital_document_versions force row level security;

drop policy if exists "members read permitted digital signatures" on public.digital_signatures;
create policy "members read permitted digital signatures"
on public.digital_signatures for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or signer_user_id = auth.uid()
    or exists (
      select 1 from public.reports r
      where document_type = 'report'
        and r.id = document_id
        and r.company_id = public.current_company_id()
        and (r.created_by = auth.uid() or auth.uid() = any(r.employee_ids))
    )
    or exists (
      select 1 from public.jobsites j
      where jobsite_id = j.id
        and j.company_id = public.current_company_id()
        and auth.uid() = any(j.assigned_employee_ids)
    )
  )
);

drop policy if exists "members insert own digital signatures" on public.digital_signatures;
create policy "members insert own digital signatures"
on public.digital_signatures for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and signer_user_id = auth.uid()
  and signer_role = public.current_role()
);

drop policy if exists "managers read digital document versions" on public.digital_document_versions;
create policy "managers read digital document versions"
on public.digital_document_versions for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or created_by = auth.uid()
  )
);

drop policy if exists "members insert digital document versions" on public.digital_document_versions;
create policy "members insert digital document versions"
on public.digital_document_versions for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and (public.can_manage_company() or created_by = auth.uid())
);

create or replace function public.prevent_signed_report_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.signature_status in ('signed', 'rejected') then
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
      or new.issues is distinct from old.issues
      or new.signature_name is distinct from old.signature_name
      or new.source_report_id is distinct from old.source_report_id
      or new.document_version is distinct from old.document_version
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Signierte Tagesberichte koennen nicht geaendert werden. Bitte neue Version erzeugen.';
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

drop policy if exists "redteam managers delete fallback" on public.digital_signatures;
drop policy if exists "redteam managers delete fallback" on public.digital_document_versions;

select pg_notify('pgrst', 'reload schema');
