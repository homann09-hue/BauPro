-- Customer portal, released photos and digital work orders.
-- Run after the existing BauPro migrations. Safe to run multiple times.

do $$
declare
  role_constraint text;
begin
  select conname
  into role_constraint
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%role%'
  limit 1;

  if role_constraint is not null then
    execute format('alter table public.profiles drop constraint %I', role_constraint);
  end if;

  alter table public.profiles
    add constraint profiles_role_check
    check (role in ('admin', 'chef', 'vorarbeiter', 'mitarbeiter', 'kunde'));
end $$;

alter table public.report_photos add column if not exists visible_to_customer boolean not null default false;
alter table public.report_photos add column if not exists customer_caption text;
alter table public.report_photos add column if not exists thumbnail_path text;
alter table public.report_photos add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.report_photos add column if not exists approved_at timestamptz;

create table if not exists public.customer_portal_tokens (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  jobsite_id uuid references public.jobsites(id) on delete cascade,
  token_hash text not null unique,
  label text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists public.customer_portal_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  jobsite_id uuid references public.jobsites(id) on delete cascade,
  event_type text not null default 'update' check (event_type in ('update', 'status', 'photo', 'document', 'appointment', 'work_order')),
  title text not null,
  body text,
  visible_to_customer boolean not null default true,
  event_date timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  jobsite_id uuid references public.jobsites(id) on delete cascade,
  title text not null,
  storage_path text not null unique,
  file_name text not null,
  content_type text,
  visible_to_customer boolean not null default false,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  jobsite_id uuid references public.jobsites(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  title text not null,
  description text,
  scope_of_work text not null,
  price_note text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'signed', 'rejected')),
  version integer not null default 1 check (version > 0),
  content_hash text,
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  rejected_at timestamptz,
  signer_name text,
  signer_ip text,
  signer_user_agent text,
  signature_data_url text,
  rejection_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_order_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  content_hash text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (work_order_id, version)
);

create index if not exists report_photos_customer_release_idx
  on public.report_photos(company_id, jobsite_id, visible_to_customer, created_at desc);
create index if not exists customer_portal_tokens_hash_idx on public.customer_portal_tokens(token_hash);
create index if not exists customer_portal_tokens_customer_idx on public.customer_portal_tokens(company_id, customer_id, jobsite_id);
create index if not exists customer_portal_events_customer_idx
  on public.customer_portal_events(company_id, customer_id, jobsite_id, event_date desc);
create index if not exists customer_documents_customer_idx
  on public.customer_documents(company_id, customer_id, jobsite_id, created_at desc);
create index if not exists work_orders_customer_idx on public.work_orders(company_id, customer_id, jobsite_id, created_at desc);
create index if not exists work_orders_order_idx on public.work_orders(order_id);
create index if not exists work_order_versions_work_order_idx on public.work_order_versions(work_order_id, version desc);

insert into storage.buckets (id, name, public)
values ('customer-documents', 'customer-documents', false)
on conflict (id) do nothing;

drop policy if exists "managers can read customer documents storage" on storage.objects;
create policy "managers can read customer documents storage"
on storage.objects for select
to authenticated
using (
  bucket_id = 'customer-documents'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and public.can_manage_company()
);

drop policy if exists "managers can upload customer documents storage" on storage.objects;
create policy "managers can upload customer documents storage"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'customer-documents'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'customers'
  and exists (
    select 1
    from public.customers c
    where c.company_id = public.current_company_id()
      and c.id::text = (storage.foldername(name))[3]
      and public.can_manage_company()
  )
);

drop policy if exists "managers can delete customer documents storage" on storage.objects;
create policy "managers can delete customer documents storage"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'customer-documents'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and public.can_manage_company()
);

alter table public.customer_portal_tokens enable row level security;
alter table public.customer_portal_events enable row level security;
alter table public.customer_documents enable row level security;
alter table public.work_orders enable row level security;
alter table public.work_order_versions enable row level security;
alter table public.customer_portal_tokens force row level security;
alter table public.customer_portal_events force row level security;
alter table public.customer_documents force row level security;
alter table public.work_orders force row level security;
alter table public.work_order_versions force row level security;

drop policy if exists "managers update report photo release" on public.report_photos;
create policy "managers update report photo release"
on public.report_photos for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers read customer portal tokens" on public.customer_portal_tokens;
create policy "managers read customer portal tokens"
on public.customer_portal_tokens for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers insert customer portal tokens" on public.customer_portal_tokens;
create policy "managers insert customer portal tokens"
on public.customer_portal_tokens for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update customer portal tokens" on public.customer_portal_tokens;
create policy "managers update customer portal tokens"
on public.customer_portal_tokens for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers delete customer portal tokens" on public.customer_portal_tokens;
create policy "managers delete customer portal tokens"
on public.customer_portal_tokens for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers read customer portal events" on public.customer_portal_events;
create policy "managers read customer portal events"
on public.customer_portal_events for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers write customer portal events" on public.customer_portal_events;
create policy "managers write customer portal events"
on public.customer_portal_events for all
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers read customer documents" on public.customer_documents;
create policy "managers read customer documents"
on public.customer_documents for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers write customer documents" on public.customer_documents;
create policy "managers write customer documents"
on public.customer_documents for all
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers read work orders" on public.work_orders;
create policy "managers read work orders"
on public.work_orders for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers insert work orders" on public.work_orders;
create policy "managers insert work orders"
on public.work_orders for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update work orders" on public.work_orders;
create policy "managers update work orders"
on public.work_orders for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers delete unsigned work orders" on public.work_orders;
create policy "managers delete unsigned work orders"
on public.work_orders for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company() and status in ('draft', 'sent'));

drop policy if exists "managers read work order versions" on public.work_order_versions;
create policy "managers read work order versions"
on public.work_order_versions for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers insert work order versions" on public.work_order_versions;
create policy "managers insert work order versions"
on public.work_order_versions for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

create or replace function public.prevent_final_work_order_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('signed', 'rejected') then
    raise exception 'Finalisierte Arbeitsauftraege koennen nicht geaendert werden.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_final_work_order_mutation on public.work_orders;
create trigger prevent_final_work_order_mutation
before update on public.work_orders
for each row execute function public.prevent_final_work_order_mutation();

drop trigger if exists set_work_orders_updated_at on public.work_orders;
create trigger set_work_orders_updated_at
before update on public.work_orders
for each row execute function public.set_updated_at();

select pg_notify('pgrst', 'reload schema');
