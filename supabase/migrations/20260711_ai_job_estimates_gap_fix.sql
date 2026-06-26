-- Gap-Fix fuer Bestandsdatenbanken, bei denen die KI-Auftrags- und
-- Kostenkalkulations-Tabellen aus 20260615_ai_job_wizard.sql noch fehlen.
-- Idempotent: kann auf frischen und bestehenden Datenbanken erneut laufen.

alter table if exists public.inventory_locations
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null;

create index if not exists inventory_locations_vehicle_id_idx
on public.inventory_locations(vehicle_id);

create table if not exists public.ai_job_drafts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  jobsite_id uuid references public.jobsites(id) on delete set null,
  converted_order_id uuid,
  raw_input text not null,
  parsed_payload jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'converted', 'archived')),
  confidence numeric(5, 2) not null default 0,
  missing_fields text[] not null default '{}'::text[],
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_estimates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid references public.orders(id) on delete cascade,
  ai_job_draft_id uuid references public.ai_job_drafts(id) on delete set null,
  material_ek_total numeric(12, 2) not null default 0,
  material_vk_total numeric(12, 2) not null default 0,
  labor_hours_estimated numeric(12, 2) not null default 0,
  labor_rate_net numeric(12, 2) not null default 0,
  labor_total_net numeric(12, 2) not null default 0,
  overhead_percent numeric(7, 2) not null default 0,
  overhead_total numeric(12, 2) not null default 0,
  profit_markup_percent numeric(7, 2) not null default 0,
  profit_total numeric(12, 2) not null default 0,
  subtotal_net numeric(12, 2) not null default 0,
  vat_rate numeric(7, 2) not null default 19,
  vat_total numeric(12, 2) not null default 0,
  total_gross numeric(12, 2) not null default 0,
  price_source_summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_estimate_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.job_estimates(id) on delete cascade,
  material_id uuid,
  description text not null,
  quantity numeric(12, 2) not null default 0,
  unit text not null default 'Stueck',
  ek_unit_price numeric(12, 2),
  vk_unit_price numeric(12, 2),
  ek_total numeric(12, 2),
  vk_total numeric(12, 2),
  price_source text not null default 'kein Preis vorhanden',
  notes text
);

do $$
begin
  if to_regclass('public.orders') is not null then
    alter table public.ai_job_drafts drop constraint if exists ai_job_drafts_converted_order_id_fkey;
    alter table public.ai_job_drafts
      add constraint ai_job_drafts_converted_order_id_fkey
      foreign key (converted_order_id) references public.orders(id) on delete set null;
  end if;

  if to_regclass('public.inventory_items') is not null then
    alter table public.job_estimate_items drop constraint if exists job_estimate_items_material_id_fkey;
    alter table public.job_estimate_items
      add constraint job_estimate_items_material_id_fkey
      foreign key (material_id) references public.inventory_items(id) on delete set null;
  end if;

  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists set_ai_job_drafts_updated_at on public.ai_job_drafts;
    create trigger set_ai_job_drafts_updated_at
      before update on public.ai_job_drafts
      for each row execute function public.set_updated_at();

    drop trigger if exists set_job_estimates_updated_at on public.job_estimates;
    create trigger set_job_estimates_updated_at
      before update on public.job_estimates
      for each row execute function public.set_updated_at();
  end if;
end $$;

create index if not exists ai_job_drafts_company_status_idx
on public.ai_job_drafts(company_id, status, created_at desc);

create index if not exists ai_job_drafts_created_by_idx
on public.ai_job_drafts(created_by, created_at desc);

create index if not exists job_estimates_company_created_idx
on public.job_estimates(company_id, created_at desc);

create index if not exists job_estimates_job_idx
on public.job_estimates(job_id);

create index if not exists job_estimate_items_estimate_idx
on public.job_estimate_items(estimate_id);

alter table public.ai_job_drafts enable row level security;
alter table public.job_estimates enable row level security;
alter table public.job_estimate_items enable row level security;
alter table public.ai_job_drafts force row level security;
alter table public.job_estimates force row level security;
alter table public.job_estimate_items force row level security;

grant select, insert, update on public.ai_job_drafts to authenticated;
grant select, insert, update on public.job_estimates to authenticated;
grant select, insert on public.job_estimate_items to authenticated;

drop policy if exists "managers read ai job drafts" on public.ai_job_drafts;
create policy "managers read ai job drafts"
on public.ai_job_drafts for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers create ai job drafts" on public.ai_job_drafts;
create policy "managers create ai job drafts"
on public.ai_job_drafts for insert
to authenticated
with check (company_id = public.current_company_id() and created_by = auth.uid() and public.can_manage_company());

drop policy if exists "managers update ai job drafts" on public.ai_job_drafts;
create policy "managers update ai job drafts"
on public.ai_job_drafts for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers read job estimates" on public.job_estimates;
create policy "managers read job estimates"
on public.job_estimates for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers create job estimates" on public.job_estimates;
create policy "managers create job estimates"
on public.job_estimates for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers read job estimate items" on public.job_estimate_items;
create policy "managers read job estimate items"
on public.job_estimate_items for select
to authenticated
using (
  exists (
    select 1 from public.job_estimates e
    where e.id = estimate_id
      and e.company_id = public.current_company_id()
      and public.can_manage_company()
  )
);

drop policy if exists "managers create job estimate items" on public.job_estimate_items;
create policy "managers create job estimate items"
on public.job_estimate_items for insert
to authenticated
with check (
  exists (
    select 1 from public.job_estimates e
    where e.id = estimate_id
      and e.company_id = public.current_company_id()
      and public.can_manage_company()
  )
);

notify pgrst, 'reload schema';
