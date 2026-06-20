-- Kundenportal fuer Baustellen: freigegebene Tagesberichte und Kundenfragen.
-- Idempotent, damit bestehende Installationen und frische Setups denselben Stand erreichen.

alter table public.reports add column if not exists visible_to_customer boolean not null default false;
alter table public.reports add column if not exists customer_summary text;
alter table public.reports add column if not exists customer_released_at timestamptz;
alter table public.reports add column if not exists customer_released_by uuid references public.profiles(id) on delete set null;

create table if not exists public.customer_portal_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  jobsite_id uuid references public.jobsites(id) on delete cascade,
  portal_token_id uuid references public.customer_portal_tokens(id) on delete set null,
  sender_name text not null,
  sender_email text,
  message text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'archived')),
  answered_at timestamptz,
  answered_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists reports_customer_release_idx
  on public.reports(company_id, jobsite_id, visible_to_customer, report_status, report_date desc)
  where archived_at is null;

create index if not exists customer_portal_messages_company_idx
  on public.customer_portal_messages(company_id, customer_id, jobsite_id, status, created_at desc);

alter table public.customer_portal_messages enable row level security;
alter table public.customer_portal_messages force row level security;

drop policy if exists "managers read customer portal messages" on public.customer_portal_messages;
create policy "managers read customer portal messages"
on public.customer_portal_messages for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update customer portal messages" on public.customer_portal_messages;
create policy "managers update customer portal messages"
on public.customer_portal_messages for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers delete customer portal messages" on public.customer_portal_messages;
create policy "managers delete customer portal messages"
on public.customer_portal_messages for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers insert customer portal messages" on public.customer_portal_messages;
create policy "managers insert customer portal messages"
on public.customer_portal_messages for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop trigger if exists touch_customer_portal_messages_updated_at on public.customer_portal_messages;

select pg_notify('pgrst', 'reload schema');
