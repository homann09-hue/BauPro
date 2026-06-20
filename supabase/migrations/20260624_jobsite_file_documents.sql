-- Zentrale Baustellenakte: Dokumente, Signatur-Metadaten und Verlauf.
-- Safe to run multiple times. Run after the base schema and customer portal migrations.

create table if not exists public.jobsite_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  category text not null default 'sonstiges' check (
    category in (
      'angebot',
      'rechnung',
      'lieferschein',
      'aufmass',
      'abnahmeprotokoll',
      'regiebericht',
      'sicherheitsunterweisung',
      'sonstiges'
    )
  ),
  title text not null,
  storage_path text not null unique,
  file_name text not null,
  content_type text,
  size_bytes integer,
  visible_to_customer boolean not null default false,
  uploaded_by uuid references public.profiles(id) on delete set null,
  signed_by uuid references public.profiles(id) on delete set null,
  signed_at timestamptz,
  signature_name text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobsite_activity_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  event_type text not null default 'note' check (
    event_type in ('note', 'document', 'photo', 'task', 'time', 'material', 'report', 'order', 'weather', 'signature')
  ),
  title text not null,
  body text,
  visibility text not null default 'internal' check (visibility in ('internal', 'customer')),
  actor_id uuid references public.profiles(id) on delete set null,
  source_table text,
  source_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists jobsite_documents_jobsite_idx
  on public.jobsite_documents(company_id, jobsite_id, archived_at, created_at desc);
create index if not exists jobsite_documents_category_idx
  on public.jobsite_documents(company_id, jobsite_id, category, created_at desc);
create index if not exists jobsite_activity_events_jobsite_idx
  on public.jobsite_activity_events(company_id, jobsite_id, archived_at, created_at desc);

insert into storage.buckets (id, name, public)
values ('jobsite-documents', 'jobsite-documents', false)
on conflict (id) do nothing;

alter table public.jobsite_documents enable row level security;
alter table public.jobsite_activity_events enable row level security;
alter table public.jobsite_documents force row level security;
alter table public.jobsite_activity_events force row level security;

drop policy if exists "members read assigned jobsite documents" on public.jobsite_documents;
create policy "members read assigned jobsite documents"
on public.jobsite_documents for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and exists (
    select 1
    from public.jobsites j
    where j.id = jobsite_id
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "managers and foremen insert jobsite documents" on public.jobsite_documents;
create policy "managers and foremen insert jobsite documents"
on public.jobsite_documents for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and exists (
    select 1
    from public.jobsites j
    where j.id = jobsite_id
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or (public.current_role() = 'vorarbeiter' and auth.uid() = any(j.assigned_employee_ids))
      )
  )
);

drop policy if exists "managers update jobsite documents" on public.jobsite_documents;
create policy "managers update jobsite documents"
on public.jobsite_documents for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "members read assigned jobsite activity" on public.jobsite_activity_events;
create policy "members read assigned jobsite activity"
on public.jobsite_activity_events for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and exists (
    select 1
    from public.jobsites j
    where j.id = jobsite_id
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "members insert assigned jobsite activity" on public.jobsite_activity_events;
create policy "members insert assigned jobsite activity"
on public.jobsite_activity_events for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and exists (
    select 1
    from public.jobsites j
    where j.id = jobsite_id
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "managers archive jobsite activity" on public.jobsite_activity_events;
create policy "managers archive jobsite activity"
on public.jobsite_activity_events for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "members read assigned jobsite documents storage" on storage.objects;
create policy "members read assigned jobsite documents storage"
on storage.objects for select
to authenticated
using (
  bucket_id = 'jobsite-documents'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'jobsites'
  and exists (
    select 1
    from public.jobsites j
    where j.id::text = (storage.foldername(name))[3]
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "managers and foremen upload jobsite documents storage" on storage.objects;
create policy "managers and foremen upload jobsite documents storage"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'jobsite-documents'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'jobsites'
  and exists (
    select 1
    from public.jobsites j
    where j.id::text = (storage.foldername(name))[3]
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or (public.current_role() = 'vorarbeiter' and auth.uid() = any(j.assigned_employee_ids))
      )
  )
);

drop policy if exists "managers delete jobsite documents storage" on storage.objects;
create policy "managers delete jobsite documents storage"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'jobsite-documents'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and public.can_manage_company()
);

drop trigger if exists set_jobsite_documents_updated_at on public.jobsite_documents;
create trigger set_jobsite_documents_updated_at
before update on public.jobsite_documents
for each row execute function public.set_updated_at();

-- Falls die Redteam-Fallback-Migration bereits lief, DELETE fuer die Akten wieder entfernen.
drop policy if exists "redteam managers delete fallback" on public.jobsite_documents;
drop policy if exists "redteam managers delete fallback" on public.jobsite_activity_events;

select pg_notify('pgrst', 'reload schema');
