-- BauPro migration: Live-Preisvergleich vorbereiten.
-- Keine Scraping-Logik. Reale Daten kommen ueber manuelle Angebote, CSV, offizielle APIs oder erlaubte Feeds.

create table if not exists public.supplier_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  type text not null default 'manual' check (type in ('api', 'csv', 'affiliate_feed', 'manual')),
  provider_key text not null check (
    provider_key in (
      'idealo', 'geizhals', 'google_shopping', 'amazon_business', 'ebay',
      'contorion', 'hornbach', 'bauhaus', 'obi', 'wuerth', 'spax', 'fischer', 'manual', 'csv'
    )
  ),
  base_url text,
  api_key_encrypted text,
  active boolean not null default true,
  supports_price boolean not null default true,
  supports_stock boolean not null default false,
  supports_delivery_time boolean not null default false,
  supports_product_url boolean not null default true,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_integration_id uuid references public.supplier_integrations(id) on delete set null,
  provider_key text not null check (
    provider_key in (
      'idealo', 'geizhals', 'google_shopping', 'amazon_business', 'ebay',
      'contorion', 'hornbach', 'bauhaus', 'obi', 'wuerth', 'spax', 'fischer', 'manual', 'csv'
    )
  ),
  supplier_name text not null,
  external_product_id text,
  product_name text not null,
  manufacturer text,
  category text,
  unit text not null default 'Stueck',
  package_size numeric(12, 2),
  price_net numeric(12, 2),
  price_gross numeric(12, 2) not null,
  currency text not null default 'EUR',
  vat_rate numeric(7, 2) not null default 19,
  shipping_cost numeric(12, 2) not null default 0,
  total_price_gross numeric(12, 2) generated always as (coalesce(price_gross, 0) + coalesce(shipping_cost, 0)) stored,
  delivery_time_text text,
  delivery_time_days_min integer,
  delivery_time_days_max integer,
  stock_status text,
  product_url text,
  image_url text,
  last_checked_at timestamptz not null default now(),
  valid_until timestamptz,
  source_type text not null default 'manual' check (source_type in ('api', 'csv', 'affiliate_feed', 'manual')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_offer_matches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  material_id uuid not null references public.inventory_items(id) on delete cascade,
  supplier_offer_id uuid not null references public.supplier_offers(id) on delete cascade,
  match_score integer not null default 0 check (match_score >= 0 and match_score <= 100),
  match_type text not null default 'manual' check (match_type in ('auto', 'manual')),
  approved_by_admin boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (material_id, supplier_offer_id)
);

create table if not exists public.supplier_price_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  material_id uuid not null references public.inventory_items(id) on delete cascade,
  supplier_name text not null,
  product_name text not null,
  price_net numeric(12, 2),
  price_gross numeric(12, 2) not null,
  total_price_gross numeric(12, 2) not null,
  checked_at timestamptz not null default now()
);

create index if not exists supplier_integrations_company_id_idx on public.supplier_integrations(company_id);
create index if not exists supplier_integrations_provider_key_idx on public.supplier_integrations(company_id, provider_key);
create index if not exists supplier_offers_company_id_idx on public.supplier_offers(company_id);
create index if not exists supplier_offers_provider_key_idx on public.supplier_offers(company_id, provider_key);
create index if not exists supplier_offers_product_name_idx on public.supplier_offers using gin(to_tsvector('simple', coalesce(product_name, '') || ' ' || coalesce(manufacturer, '') || ' ' || coalesce(category, '')));
create index if not exists supplier_offers_total_price_idx on public.supplier_offers(company_id, total_price_gross);
create index if not exists supplier_offer_matches_material_id_idx on public.supplier_offer_matches(material_id);
create index if not exists supplier_offer_matches_offer_id_idx on public.supplier_offer_matches(supplier_offer_id);
create index if not exists supplier_price_history_material_id_idx on public.supplier_price_history(material_id, checked_at desc);

drop trigger if exists set_supplier_integrations_updated_at on public.supplier_integrations;
create trigger set_supplier_integrations_updated_at
before update on public.supplier_integrations
for each row execute function public.set_updated_at();

drop trigger if exists set_supplier_offers_updated_at on public.supplier_offers;
create trigger set_supplier_offers_updated_at
before update on public.supplier_offers
for each row execute function public.set_updated_at();

alter table public.supplier_integrations enable row level security;
alter table public.supplier_offers enable row level security;
alter table public.supplier_offer_matches enable row level security;
alter table public.supplier_price_history enable row level security;

drop policy if exists "managers can read supplier integrations" on public.supplier_integrations;
create policy "managers can read supplier integrations" on public.supplier_integrations
for select to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert supplier integrations" on public.supplier_integrations;
create policy "managers can insert supplier integrations" on public.supplier_integrations
for insert to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update supplier integrations" on public.supplier_integrations;
create policy "managers can update supplier integrations" on public.supplier_integrations
for update to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete supplier integrations" on public.supplier_integrations;
create policy "managers can delete supplier integrations" on public.supplier_integrations
for delete to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can read supplier offers" on public.supplier_offers;
create policy "managers can read supplier offers" on public.supplier_offers
for select to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert supplier offers" on public.supplier_offers;
create policy "managers can insert supplier offers" on public.supplier_offers
for insert to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update supplier offers" on public.supplier_offers;
create policy "managers can update supplier offers" on public.supplier_offers
for update to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete supplier offers" on public.supplier_offers;
create policy "managers can delete supplier offers" on public.supplier_offers
for delete to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can read supplier offer matches" on public.supplier_offer_matches;
create policy "managers can read supplier offer matches" on public.supplier_offer_matches
for select to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert supplier offer matches" on public.supplier_offer_matches;
create policy "managers can insert supplier offer matches" on public.supplier_offer_matches
for insert to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update supplier offer matches" on public.supplier_offer_matches;
create policy "managers can update supplier offer matches" on public.supplier_offer_matches
for update to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete supplier offer matches" on public.supplier_offer_matches;
create policy "managers can delete supplier offer matches" on public.supplier_offer_matches
for delete to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can read supplier price history" on public.supplier_price_history;
create policy "managers can read supplier price history" on public.supplier_price_history
for select to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert supplier price history" on public.supplier_price_history;
create policy "managers can insert supplier price history" on public.supplier_price_history
for insert to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete supplier price history" on public.supplier_price_history;
create policy "managers can delete supplier price history" on public.supplier_price_history
for delete to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

select pg_notify('pgrst', 'reload schema');
