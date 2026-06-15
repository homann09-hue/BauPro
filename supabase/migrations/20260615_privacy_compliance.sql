-- Datenschutz-/DSGVO-Grundlagen: Betroffenenanfragen, Export-Audit und strengere Foto-Storage-Policy.

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  requester_id uuid references public.profiles(id) on delete set null,
  request_type text not null check (
    request_type in ('access', 'rectification', 'erasure', 'restriction', 'portability', 'objection', 'contract_end_export')
  ),
  status text not null default 'open' check (status in ('open', 'in_review', 'completed', 'rejected')),
  description text,
  response_notes text,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists privacy_requests_company_created_idx on public.privacy_requests(company_id, created_at desc);
create index if not exists privacy_requests_requester_idx on public.privacy_requests(requester_id, created_at desc);

alter table public.privacy_requests enable row level security;

drop policy if exists "read own or managed privacy requests" on public.privacy_requests;
create policy "read own or managed privacy requests"
on public.privacy_requests for select
to authenticated
using (
  company_id = public.current_company_id()
  and (public.can_manage_company() or requester_id = auth.uid())
);

drop policy if exists "create own privacy requests" on public.privacy_requests;
create policy "create own privacy requests"
on public.privacy_requests for insert
to authenticated
with check (company_id = public.current_company_id() and requester_id = auth.uid());

drop policy if exists "managers update privacy requests" on public.privacy_requests;
create policy "managers update privacy requests"
on public.privacy_requests for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop trigger if exists set_privacy_requests_updated_at on public.privacy_requests;
create trigger set_privacy_requests_updated_at
before update on public.privacy_requests
for each row execute function public.set_updated_at();

drop policy if exists "members can delete own report photos" on storage.objects;
create policy "members can delete own report photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'report-photos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (public.can_manage_company() or owner = auth.uid())
);

select pg_notify('pgrst', 'reload schema');
