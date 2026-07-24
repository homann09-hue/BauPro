alter table public.companies
  add column if not exists onboarding_completed_at timestamptz;

alter table public.companies
  add column if not exists trade text not null default 'dachdecker';

alter table public.companies
  add column if not exists logo_path text;

create index if not exists companies_onboarding_idx
on public.companies(onboarding_completed_at);

alter table public.companies enable row level security;
alter table public.companies force row level security;

grant select, update on public.companies to authenticated;

drop policy if exists "company members can read own company" on public.companies;
create policy "company members can read own company"
on public.companies for select
to authenticated
using (id = public.current_company_id());

drop policy if exists "managers can update own company" on public.companies;
create policy "managers can update own company"
on public.companies for update
to authenticated
using (id = public.current_company_id() and public.can_manage_company())
with check (id = public.current_company_id() and public.can_manage_company());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-logos',
  'company-logos',
  false,
  1048576,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "company members read company logos" on storage.objects;
create policy "company members read company logos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
);

drop policy if exists "managers upload company logos" on storage.objects;
create policy "managers upload company logos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'logos'
  and public.can_manage_company()
);

drop policy if exists "managers update company logos" on storage.objects;
create policy "managers update company logos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and public.can_manage_company()
)
with check (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and public.can_manage_company()
);

drop policy if exists "managers delete company logos" on storage.objects;
create policy "managers delete company logos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and public.can_manage_company()
);

select pg_notify('pgrst', 'reload schema');
