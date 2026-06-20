-- BauPro Stripe Billing.
-- Run after the SaaS hardening and AI feature migrations.

create table if not exists public.plans (
  id text primary key,
  name text not null,
  stripe_monthly_price_id text,
  stripe_yearly_price_id text,
  price_monthly_eur numeric(10, 2) not null default 0,
  max_users integer,
  max_ai_calls_per_month integer not null default 0,
  has_ai_features boolean not null default false,
  has_customer_portal boolean not null default false,
  has_time_reports boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (price_monthly_eur >= 0),
  check (max_users is null or max_users >= 1),
  check (max_ai_calls_per_month >= 0)
);

insert into public.plans (
  id,
  name,
  stripe_monthly_price_id,
  stripe_yearly_price_id,
  price_monthly_eur,
  max_users,
  max_ai_calls_per_month,
  has_ai_features,
  has_customer_portal,
  has_time_reports
)
values
  ('starter', 'Starter', null, null, 0, 1, 0, false, false, false),
  ('professional', 'Professional', null, null, 29, 10, 250, true, true, true),
  ('business', 'Business', null, null, 79, null, 1500, true, true, true)
on conflict (id) do update set
  name = excluded.name,
  price_monthly_eur = excluded.price_monthly_eur,
  max_users = excluded.max_users,
  max_ai_calls_per_month = excluded.max_ai_calls_per_month,
  has_ai_features = excluded.has_ai_features,
  has_customer_portal = excluded.has_customer_portal,
  has_time_reports = excluded.has_time_reports,
  updated_at = now();

alter table public.companies add column if not exists plan_id text;
alter table public.companies add column if not exists stripe_customer_id text;
alter table public.companies add column if not exists stripe_subscription_id text;
alter table public.companies add column if not exists subscription_status text not null default 'free';
alter table public.companies add column if not exists trial_ends_at timestamptz;
alter table public.companies add column if not exists current_period_end timestamptz;

update public.companies
set plan_id = 'starter'
where plan_id is null;

alter table public.companies
  alter column plan_id set default 'starter';

alter table public.companies
  drop constraint if exists companies_plan_id_fkey;

alter table public.companies
  add constraint companies_plan_id_fkey
  foreign key (plan_id) references public.plans(id) on delete restrict;

alter table public.companies
  drop constraint if exists companies_subscription_status_check;

alter table public.companies
  add constraint companies_subscription_status_check
  check (
    subscription_status in (
      'free',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'incomplete',
      'incomplete_expired',
      'paused'
    )
  );

create table if not exists public.stripe_webhook_events (
  id text primary key,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists companies_plan_idx on public.companies(plan_id);
create unique index if not exists companies_stripe_customer_idx
on public.companies(stripe_customer_id)
where stripe_customer_id is not null;

create unique index if not exists companies_stripe_subscription_idx
on public.companies(stripe_subscription_id)
where stripe_subscription_id is not null;

create index if not exists stripe_webhook_events_type_created_idx
on public.stripe_webhook_events(event_type, created_at desc);

drop trigger if exists set_plans_updated_at on public.plans;
create trigger set_plans_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

alter table public.plans enable row level security;
alter table public.companies enable row level security;
alter table public.companies force row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.stripe_webhook_events force row level security;

grant select on public.plans to anon, authenticated;
grant select, update on public.companies to authenticated;
revoke all on public.stripe_webhook_events from anon, authenticated;

drop policy if exists "plans are publicly readable" on public.plans;
create policy "plans are publicly readable"
on public.plans for select
to anon, authenticated
using (true);

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

select pg_notify('pgrst', 'reload schema');
