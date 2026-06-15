-- BauPro SaaS hardening: Firmenprofil, Archivierung und Audit-Grundlage.

alter table public.companies add column if not exists contact_email text;
alter table public.companies add column if not exists phone text;
alter table public.companies add column if not exists address text;
alter table public.companies add column if not exists website text;
alter table public.companies add column if not exists tax_id text;
alter table public.companies add column if not exists payment_terms text;
alter table public.companies add column if not exists onboarding_completed_at timestamptz;

alter table public.customers add column if not exists archived_at timestamptz;
alter table public.jobsites add column if not exists archived_at timestamptz;
alter table public.orders add column if not exists archived_at timestamptz;
alter table public.inventory_items add column if not exists archived_at timestamptz;
alter table public.vehicles add column if not exists archived_at timestamptz;
alter table public.tasks add column if not exists archived_at timestamptz;

create table if not exists public.company_audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index if not exists companies_onboarding_idx on public.companies(onboarding_completed_at);
create index if not exists customers_archived_idx on public.customers(company_id, archived_at);
create index if not exists jobsites_archived_idx on public.jobsites(company_id, archived_at);
create index if not exists orders_archived_idx on public.orders(company_id, archived_at);
create index if not exists inventory_items_archived_idx on public.inventory_items(company_id, archived_at);
create index if not exists company_audit_log_company_created_idx on public.company_audit_log(company_id, created_at desc);
create index if not exists company_audit_log_entity_idx on public.company_audit_log(company_id, entity_type, entity_id);

alter table public.company_audit_log enable row level security;

drop policy if exists "managers read company audit log" on public.company_audit_log;
create policy "managers read company audit log"
on public.company_audit_log for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers create company audit log" on public.company_audit_log;
create policy "managers create company audit log"
on public.company_audit_log for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

select pg_notify('pgrst', 'reload schema');
