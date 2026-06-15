-- BauPro migration: Online Price Discovery.
-- Optionaler Preisindikator fuer Chef/Admin. Keine Scraping-Logik.

create table if not exists public.online_price_discoveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  material_id uuid references public.inventory_items(id) on delete cascade,
  query text not null,
  status text not null default 'completed' check (status in ('completed', 'no_results', 'partial_error')),
  source_statuses jsonb not null default '[]'::jsonb,
  cheapest_price_gross numeric(12, 2),
  average_price_gross numeric(12, 2),
  offer_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.online_price_offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  discovery_id uuid not null references public.online_price_discoveries(id) on delete cascade,
  material_id uuid references public.inventory_items(id) on delete cascade,
  source_key text not null check (
    source_key in (
      'idealo',
      'geizhals',
      'ebay',
      'amazon',
      'contorion',
      'toolineo',
      'custom_feed',
      'priceapi',
      'dataforseo_google_shopping',
      'searchapi_google_shopping',
      'wuerth_catalog_csv',
      'manual_csv',
      'market_reference'
    )
  ),
  supplier_name text not null,
  product_name text not null,
  product_url text,
  price_gross numeric(12, 2) not null,
  shipping_cost numeric(12, 2) not null default 0,
  total_price_gross numeric(12, 2) generated always as (coalesce(price_gross, 0) + coalesce(shipping_cost, 0)) stored,
  delivery_time_text text,
  checked_at timestamptz not null default now(),
  source_note text,
  created_at timestamptz not null default now()
);

create index if not exists online_price_discoveries_company_id_idx on public.online_price_discoveries(company_id, created_at desc);
create index if not exists online_price_discoveries_material_id_idx on public.online_price_discoveries(material_id, created_at desc);
create index if not exists online_price_offers_discovery_id_idx on public.online_price_offers(discovery_id);
create index if not exists online_price_offers_material_id_idx on public.online_price_offers(material_id, total_price_gross);
create index if not exists online_price_offers_source_key_idx on public.online_price_offers(company_id, source_key);

alter table public.online_price_discoveries enable row level security;
alter table public.online_price_offers enable row level security;

drop policy if exists "managers can read online price discoveries" on public.online_price_discoveries;
create policy "managers can read online price discoveries"
on public.online_price_discoveries for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert online price discoveries" on public.online_price_discoveries;
create policy "managers can insert online price discoveries"
on public.online_price_discoveries for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete online price discoveries" on public.online_price_discoveries;
create policy "managers can delete online price discoveries"
on public.online_price_discoveries for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can read online price offers" on public.online_price_offers;
create policy "managers can read online price offers"
on public.online_price_offers for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert online price offers" on public.online_price_offers;
create policy "managers can insert online price offers"
on public.online_price_offers for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete online price offers" on public.online_price_offers;
create policy "managers can delete online price offers"
on public.online_price_offers for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

select pg_notify('pgrst', 'reload schema');
