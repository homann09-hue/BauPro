-- Geraete- und Fahrzeugverwaltung fuer Plantafel, Wartung, Dokumente und QR/NFC-Vorbereitung.

alter table public.vehicles add column if not exists status text not null default 'verfuegbar';
alter table public.vehicles add column if not exists inspection_due_date date;
alter table public.vehicles add column if not exists maintenance_interval_days integer;
alter table public.vehicles add column if not exists last_maintenance_at date;
alter table public.vehicles add column if not exists next_maintenance_at date;
alter table public.vehicles add column if not exists location_text text;
alter table public.vehicles add column if not exists responsible_employee_id uuid;
alter table public.vehicles add column if not exists qr_code text;
alter table public.vehicles add column if not exists nfc_tag_id text;
alter table public.vehicles add column if not exists archived_at timestamptz;

alter table public.vehicles drop constraint if exists vehicles_status_check;
alter table public.vehicles add constraint vehicles_status_check
  check (status in ('verfuegbar', 'auf_baustelle', 'im_fahrzeug', 'defekt', 'werkstatt', 'reserviert', 'archiviert'));

alter table public.vehicles drop constraint if exists vehicles_maintenance_interval_days_check;
alter table public.vehicles add constraint vehicles_maintenance_interval_days_check
  check (maintenance_interval_days is null or (maintenance_interval_days > 0 and maintenance_interval_days <= 3650));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vehicles_responsible_employee_id_fkey'
  ) then
    alter table public.vehicles
      add constraint vehicles_responsible_employee_id_fkey
      foreign key (responsible_employee_id) references public.profiles(id) on delete set null;
  end if;
end $$;

alter table public.planning_resources add column if not exists inspection_due_date date;
alter table public.planning_resources add column if not exists maintenance_interval_days integer;
alter table public.planning_resources add column if not exists last_maintenance_at date;
alter table public.planning_resources add column if not exists next_maintenance_at date;
alter table public.planning_resources add column if not exists location_text text;
alter table public.planning_resources add column if not exists responsible_employee_id uuid;
alter table public.planning_resources add column if not exists vehicle_id uuid;
alter table public.planning_resources add column if not exists qr_code text;
alter table public.planning_resources add column if not exists nfc_tag_id text;

alter table public.planning_resources drop constraint if exists planning_resources_resource_kind_check;
alter table public.planning_resources add constraint planning_resources_resource_kind_check
  check (resource_kind in ('fahrzeug', 'anhaenger', 'maschine', 'werkzeug', 'geruest_leiter', 'geraet', 'sonstiges'));

alter table public.planning_resources drop constraint if exists planning_resources_status_check;
alter table public.planning_resources add constraint planning_resources_status_check
  check (status in ('verfuegbar', 'auf_baustelle', 'im_fahrzeug', 'defekt', 'werkstatt', 'reserviert', 'archiviert'));

alter table public.planning_resources drop constraint if exists planning_resources_maintenance_interval_days_check;
alter table public.planning_resources add constraint planning_resources_maintenance_interval_days_check
  check (maintenance_interval_days is null or (maintenance_interval_days > 0 and maintenance_interval_days <= 3650));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'planning_resources_responsible_employee_id_fkey'
  ) then
    alter table public.planning_resources
      add constraint planning_resources_responsible_employee_id_fkey
      foreign key (responsible_employee_id) references public.profiles(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'planning_resources_vehicle_id_fkey'
  ) then
    alter table public.planning_resources
      add constraint planning_resources_vehicle_id_fkey
      foreign key (vehicle_id) references public.vehicles(id) on delete set null;
  end if;
end $$;

create table if not exists public.resource_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  planning_resource_id uuid references public.planning_resources(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  document_type text not null default 'dokument'
    check (document_type in ('foto', 'dokument', 'pruefung', 'wartung', 'sonstiges')),
  title text not null,
  storage_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (
    (planning_resource_id is not null and vehicle_id is null)
    or (planning_resource_id is null and vehicle_id is not null)
  )
);

create index if not exists vehicles_resource_status_idx
  on public.vehicles(company_id, status, archived_at, name);
create index if not exists vehicles_responsible_idx
  on public.vehicles(company_id, responsible_employee_id)
  where responsible_employee_id is not null and archived_at is null;
create unique index if not exists vehicles_company_qr_code_key
  on public.vehicles(company_id, qr_code)
  where qr_code is not null and archived_at is null;
create unique index if not exists vehicles_company_nfc_tag_id_key
  on public.vehicles(company_id, nfc_tag_id)
  where nfc_tag_id is not null and archived_at is null;

create index if not exists planning_resources_responsible_idx
  on public.planning_resources(company_id, responsible_employee_id)
  where responsible_employee_id is not null and archived_at is null;
create index if not exists planning_resources_vehicle_idx
  on public.planning_resources(company_id, vehicle_id)
  where vehicle_id is not null and archived_at is null;
create unique index if not exists planning_resources_company_qr_code_key
  on public.planning_resources(company_id, qr_code)
  where qr_code is not null and archived_at is null;
create unique index if not exists planning_resources_company_nfc_tag_id_key
  on public.planning_resources(company_id, nfc_tag_id)
  where nfc_tag_id is not null and archived_at is null;

create index if not exists resource_documents_resource_idx
  on public.resource_documents(company_id, planning_resource_id, archived_at, created_at desc);
create index if not exists resource_documents_vehicle_idx
  on public.resource_documents(company_id, vehicle_id, archived_at, created_at desc);

alter table public.vehicles enable row level security;
alter table public.planning_resources enable row level security;
alter table public.resource_documents enable row level security;
alter table public.vehicles force row level security;
alter table public.planning_resources force row level security;
alter table public.resource_documents force row level security;

drop policy if exists "members read resource documents" on public.resource_documents;
create policy "members read resource documents"
on public.resource_documents for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
);

drop policy if exists "managers insert resource documents" on public.resource_documents;
create policy "managers insert resource documents"
on public.resource_documents for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update resource documents" on public.resource_documents;
create policy "managers update resource documents"
on public.resource_documents for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

create or replace function public.validate_resource_document_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.planning_resource_id is not null and not exists (
    select 1
    from public.planning_resources pr
    where pr.id = new.planning_resource_id
      and pr.company_id = new.company_id
      and pr.archived_at is null
  ) then
    raise exception 'planning_resource_not_found';
  end if;

  if new.vehicle_id is not null and not exists (
    select 1
    from public.vehicles v
    where v.id = new.vehicle_id
      and v.company_id = new.company_id
      and v.archived_at is null
  ) then
    raise exception 'vehicle_not_found';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_resource_document_tenant on public.resource_documents;
create trigger validate_resource_document_tenant
before insert or update on public.resource_documents
for each row execute function public.validate_resource_document_tenant();

drop trigger if exists set_resource_documents_updated_at on public.resource_documents;
create trigger set_resource_documents_updated_at
before update on public.resource_documents
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('resource-documents', 'resource-documents', false)
on conflict (id) do nothing;

drop policy if exists "members read resource documents storage" on storage.objects;
create policy "members read resource documents storage"
on storage.objects for select
to authenticated
using (
  bucket_id = 'resource-documents'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (
    (
      (storage.foldername(name))[2] = 'resources'
      and exists (
        select 1
        from public.planning_resources pr
        where pr.id::text = (storage.foldername(name))[3]
          and pr.company_id = public.current_company_id()
          and pr.archived_at is null
      )
    )
    or (
      (storage.foldername(name))[2] = 'vehicles'
      and exists (
        select 1
        from public.vehicles v
        where v.id::text = (storage.foldername(name))[3]
          and v.company_id = public.current_company_id()
          and v.archived_at is null
      )
    )
  )
);

drop policy if exists "managers upload resource documents storage" on storage.objects;
create policy "managers upload resource documents storage"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'resource-documents'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and public.can_manage_company()
);

drop policy if exists "managers delete resource documents storage" on storage.objects;
create policy "managers delete resource documents storage"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'resource-documents'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and public.can_manage_company()
);

select pg_notify('pgrst', 'reload schema');
