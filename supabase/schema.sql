-- BauPro schema for Supabase.
-- Run this file in the Supabase SQL editor before starting the app.

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'mitarbeiter' check (role in ('admin', 'chef', 'vorarbeiter', 'mitarbeiter')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_type text not null default 'privatkunde' check (
    customer_type in ('privatkunde', 'gewerbekunde', 'hausverwaltung', 'architekt', 'versicherung')
  ),
  company text,
  first_name text,
  last_name text,
  contact_person text,
  phone text,
  email text,
  billing_address text,
  jobsite_address text,
  notes text,
  tax_id text,
  payment_terms text,
  status text not null default 'aktiv' check (status in ('aktiv', 'inaktiv')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobsites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  customer text not null,
  address text not null,
  start_date date,
  status text not null default 'geplant' check (status in ('geplant', 'aktiv', 'abgeschlossen')),
  notes text,
  assigned_employee_ids uuid[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  jobsite_id uuid references public.jobsites(id) on delete set null,
  order_number text not null,
  title text not null,
  order_type text not null default 'steildach' check (
    order_type in ('steildach', 'flachdach', 'reparatur', 'dachrinne', 'blech', 'wartung', 'sonstiges')
  ),
  status text not null default 'anfrage' check (
    status in ('anfrage', 'angebot', 'geplant', 'in_arbeit', 'fertig', 'abgerechnet')
  ),
  priority text not null default 'normal' check (priority in ('niedrig', 'normal', 'hoch')),
  jobsite_address text not null,
  start_date date,
  end_date date,
  description text,
  internal_notes text,
  assigned_employee_ids uuid[] not null default '{}',
  has_dimensions boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, order_number)
);

create table if not exists public.job_dimensions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  length_m numeric(12, 2),
  width_m numeric(12, 2),
  area_m2 numeric(12, 2) not null default 0,
  roof_pitch numeric(7, 2),
  eaves_length_m numeric(12, 2),
  ridge_length_m numeric(12, 2),
  verge_length_m numeric(12, 2),
  valley_length_m numeric(12, 2),
  wall_connection_length_m numeric(12, 2),
  building_height_m numeric(12, 2),
  downpipe_length_m numeric(12, 2),
  roof_windows_count integer not null default 0,
  penetrations_count integer not null default 0,
  roof_drains_count integer not null default 0,
  emergency_overflows_count integer not null default 0,
  waste_percent numeric(7, 2) not null default 20,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id),
  check (waste_percent >= 0 and waste_percent <= 100)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid references public.jobsites(id) on delete set null,
  report_date date not null default current_date,
  weather text,
  work_start time,
  work_end time,
  employee_ids uuid[] not null default '{}',
  activities text not null,
  material_usage text,
  issues text,
  signature_name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade,
  jobsite_id uuid references public.jobsites(id) on delete set null,
  storage_path text not null unique,
  file_name text not null,
  content_type text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete restrict,
  job_id uuid not null references public.jobsites(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  date date not null,
  work_location text not null,
  work_address text not null,
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  gross_minutes integer not null default 0 check (gross_minutes >= 0),
  net_minutes integer not null default 0 check (net_minutes >= 0),
  activity text not null,
  weather text,
  kilometers numeric(10, 1),
  notes text,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  check (break_minutes <= gross_minutes),
  check (net_minutes = gross_minutes - break_minutes)
);

create table if not exists public.time_entry_audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  old_values jsonb,
  new_values jsonb,
  change_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.time_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid references public.profiles(id) on delete set null,
  month integer not null check (month between 1 and 12),
  year integer not null check (year between 2000 and 2100),
  date_from date not null,
  date_to date not null,
  status text not null default 'generated' check (status in ('generated', 'approved', 'archived')),
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  check (date_to >= date_from)
);

create table if not exists public.time_report_entries (
  id uuid primary key default gen_random_uuid(),
  time_report_id uuid not null references public.time_reports(id) on delete cascade,
  time_entry_id uuid not null references public.time_entries(id) on delete restrict,
  unique (time_report_id, time_entry_id)
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  category text,
  unit text not null default 'Stk.',
  stock numeric(12, 2) not null default 0,
  minimum_stock numeric(12, 2) not null default 0,
  location text not null default 'Lager' check (location in ('Lager', 'Fahrzeug', 'Baustelle')),
  purchase_price numeric(12, 2),
  sales_price numeric(12, 2),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.material_categories(id) on delete cascade,
  slug text not null,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, slug)
);

create table if not exists public.material_catalog (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.material_categories(id) on delete set null,
  subcategory_id uuid references public.material_subcategories(id) on delete set null,
  name text not null,
  unit text not null default 'Stück',
  package_unit text,
  default_minimum_stock numeric(12, 2) not null default 0,
  short_description text,
  search_terms text[] not null default '{}',
  typical_use text,
  manufacturer text,
  article_number text,
  ean text,
  purchase_price numeric(12, 2),
  sales_price numeric(12, 2),
  markup_percent numeric(7, 2) not null default 0,
  sales_unit text,
  price_per_unit numeric(12, 2),
  last_price_changed_at timestamptz,
  popularity integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, unit, package_unit)
);

create table if not exists public.material_aliases (
  id uuid primary key default gen_random_uuid(),
  catalog_item_id uuid not null references public.material_catalog(id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now(),
  unique (catalog_item_id, alias)
);

create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  location_type text not null default 'Hauptlager' check (location_type in ('Hauptlager', 'Fahrzeuglager', 'Baustelle', 'Container', 'Werkstatt')),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  catalog_item_id uuid references public.material_catalog(id) on delete set null,
  category_id uuid references public.material_categories(id) on delete set null,
  subcategory_id uuid references public.material_subcategories(id) on delete set null,
  location_id uuid references public.inventory_locations(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  name text not null,
  unit text not null default 'Stück',
  stock numeric(12, 2) not null default 0,
  minimum_stock numeric(12, 2) not null default 0,
  package_unit text,
  manufacturer text,
  article_number text,
  ean text,
  purchase_price numeric(12, 2),
  sales_price numeric(12, 2),
  markup_percent numeric(7, 2) not null default 0,
  sales_unit text,
  price_per_unit numeric(12, 2),
  last_price_changed_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, catalog_item_id, location_id),
  check (stock >= 0),
  check (minimum_stock >= 0)
);

create table if not exists public.material_import_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  columns text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  type text not null default 'manual' check (type in ('api', 'csv', 'affiliate_feed', 'manual')),
  provider_key text not null check (
    provider_key in (
      'idealo',
      'geizhals',
      'google_shopping',
      'amazon_business',
      'ebay',
      'contorion',
      'hornbach',
      'bauhaus',
      'obi',
      'wuerth',
      'spax',
      'fischer',
      'manual',
      'csv'
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
      'idealo',
      'geizhals',
      'google_shopping',
      'amazon_business',
      'ebay',
      'contorion',
      'hornbach',
      'bauhaus',
      'obi',
      'wuerth',
      'spax',
      'fischer',
      'manual',
      'csv'
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

create table if not exists public.company_pricing_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  waste_percent numeric(7, 2) not null default 20,
  default_markup_percent numeric(7, 2) not null default 35,
  auto_calculate_sales_price boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (waste_percent >= 0 and waste_percent <= 100),
  check (default_markup_percent >= 0)
);

create table if not exists public.material_calculation_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  rule_key text not null,
  roof_type text not null check (roof_type in ('steildach', 'flachdach', 'reparatur', 'entwaesserung', 'blech')),
  name text not null,
  material_name text not null,
  catalog_item_id uuid references public.material_catalog(id) on delete set null,
  unit text not null default 'm2',
  calculation_method text not null check (
    calculation_method in (
      'area',
      'area_per_spacing',
      'first_length',
      'eaves_length',
      'verge_length',
      'valley_length',
      'wall_connection_length',
      'penetrations_count',
      'roof_windows_count',
      'gutter_hangers'
    )
  ),
  factor numeric(12, 4) not null default 1,
  spacing_m numeric(12, 4),
  waste_applies boolean not null default true,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, rule_key)
);

create table if not exists public.job_material_calculations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  roof_type text not null check (roof_type in ('steildach', 'flachdach', 'reparatur', 'entwaesserung', 'blech')),
  length_m numeric(12, 2),
  width_m numeric(12, 2),
  area_m2 numeric(12, 2) not null default 0,
  roof_pitch numeric(7, 2),
  eaves_length_m numeric(12, 2),
  ridge_length_m numeric(12, 2),
  verge_length_m numeric(12, 2),
  valley_length_m numeric(12, 2),
  wall_connection_length_m numeric(12, 2),
  penetrations_count integer not null default 0,
  roof_windows_count integer not null default 0,
  waste_percent numeric(7, 2) not null default 20,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (waste_percent >= 0 and waste_percent <= 100)
);

create table if not exists public.job_material_calculation_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  calculation_id uuid not null references public.job_material_calculations(id) on delete cascade,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  rule_id uuid references public.material_calculation_rules(id) on delete set null,
  catalog_item_id uuid references public.material_catalog(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  material_name text not null,
  unit text not null,
  base_quantity numeric(12, 2) not null default 0,
  waste_percent numeric(7, 2) not null default 20,
  waste_quantity numeric(12, 2) not null default 0,
  total_quantity numeric(12, 2) not null default 0,
  purchase_price numeric(12, 2),
  sales_price numeric(12, 2),
  purchase_total numeric(12, 2),
  sales_total numeric(12, 2),
  margin_total numeric(12, 2),
  location_name text,
  stock numeric(12, 2),
  minimum_stock numeric(12, 2),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_material_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  dimension_id uuid references public.job_dimensions(id) on delete set null,
  jobsite_id uuid references public.jobsites(id) on delete set null,
  rule_id uuid references public.material_calculation_rules(id) on delete set null,
  catalog_item_id uuid references public.material_catalog(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  material_name text not null,
  unit text not null,
  base_quantity numeric(12, 2) not null default 0,
  waste_percent numeric(7, 2) not null default 20,
  waste_quantity numeric(12, 2) not null default 0,
  total_quantity numeric(12, 2) not null default 0,
  purchase_price numeric(12, 2),
  sales_price numeric(12, 2),
  purchase_total numeric(12, 2),
  sales_total numeric(12, 2),
  margin_total numeric(12, 2),
  location_name text,
  stock numeric(12, 2),
  minimum_stock numeric(12, 2),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (waste_percent >= 0 and waste_percent <= 100)
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  license_plate text not null,
  tuv_date date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  quantity numeric(12, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vehicle_id, material_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid references public.jobsites(id) on delete set null,
  title text not null,
  description text,
  assigned_to uuid references public.profiles(id) on delete set null,
  due_date date,
  status text not null default 'offen' check (status in ('offen', 'in_arbeit', 'erledigt')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.material_catalog add column if not exists markup_percent numeric(7, 2) not null default 0;
alter table public.material_catalog add column if not exists sales_unit text;
alter table public.material_catalog add column if not exists price_per_unit numeric(12, 2);
alter table public.material_catalog add column if not exists last_price_changed_at timestamptz;

alter table public.inventory_items add column if not exists markup_percent numeric(7, 2) not null default 0;
alter table public.inventory_items add column if not exists sales_unit text;
alter table public.inventory_items add column if not exists price_per_unit numeric(12, 2);
alter table public.inventory_items add column if not exists last_price_changed_at timestamptz;

create index if not exists profiles_company_id_idx on public.profiles(company_id);
create index if not exists customers_company_id_idx on public.customers(company_id);
create index if not exists customers_status_idx on public.customers(company_id, status);
create index if not exists jobsites_company_id_idx on public.jobsites(company_id);
create index if not exists orders_company_id_idx on public.orders(company_id);
create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists orders_jobsite_id_idx on public.orders(jobsite_id);
create index if not exists orders_status_idx on public.orders(company_id, status);
create index if not exists orders_assigned_employee_ids_idx on public.orders using gin(assigned_employee_ids);
create index if not exists job_dimensions_order_id_idx on public.job_dimensions(order_id);
create index if not exists reports_company_id_idx on public.reports(company_id);
create index if not exists reports_report_date_idx on public.reports(report_date desc);
create index if not exists report_photos_report_id_idx on public.report_photos(report_id);
create index if not exists time_entries_company_date_idx on public.time_entries(company_id, date desc);
create index if not exists time_entries_employee_date_idx on public.time_entries(employee_id, date desc);
create index if not exists time_entries_job_id_idx on public.time_entries(job_id);
create index if not exists time_entries_status_idx on public.time_entries(company_id, status);
create index if not exists time_entry_audit_log_entry_idx on public.time_entry_audit_log(time_entry_id, created_at desc);
create index if not exists time_reports_company_period_idx on public.time_reports(company_id, year desc, month desc);
create index if not exists time_reports_employee_period_idx on public.time_reports(employee_id, year desc, month desc);
create index if not exists time_report_entries_report_idx on public.time_report_entries(time_report_id);
create index if not exists time_report_entries_entry_idx on public.time_report_entries(time_entry_id);
create index if not exists materials_company_id_idx on public.materials(company_id);
create index if not exists material_subcategories_category_id_idx on public.material_subcategories(category_id);
create index if not exists material_catalog_category_id_idx on public.material_catalog(category_id);
create index if not exists material_catalog_subcategory_id_idx on public.material_catalog(subcategory_id);
create index if not exists material_catalog_active_name_idx on public.material_catalog(active, name);
create index if not exists material_catalog_search_terms_idx on public.material_catalog using gin(search_terms);
create index if not exists material_aliases_catalog_item_id_idx on public.material_aliases(catalog_item_id);
create index if not exists inventory_locations_company_id_idx on public.inventory_locations(company_id);
create index if not exists suppliers_company_id_idx on public.suppliers(company_id);
create index if not exists inventory_items_company_id_idx on public.inventory_items(company_id);
create index if not exists inventory_items_catalog_item_id_idx on public.inventory_items(catalog_item_id);
create index if not exists inventory_items_location_id_idx on public.inventory_items(location_id);
create index if not exists inventory_items_low_stock_idx on public.inventory_items(company_id, stock, minimum_stock);
create index if not exists supplier_integrations_company_id_idx on public.supplier_integrations(company_id);
create index if not exists supplier_integrations_provider_key_idx on public.supplier_integrations(company_id, provider_key);
create index if not exists supplier_offers_company_id_idx on public.supplier_offers(company_id);
create index if not exists supplier_offers_provider_key_idx on public.supplier_offers(company_id, provider_key);
create index if not exists supplier_offers_product_name_idx on public.supplier_offers using gin(to_tsvector('simple', coalesce(product_name, '') || ' ' || coalesce(manufacturer, '') || ' ' || coalesce(category, '')));
create index if not exists supplier_offers_total_price_idx on public.supplier_offers(company_id, total_price_gross);
create index if not exists supplier_offer_matches_material_id_idx on public.supplier_offer_matches(material_id);
create index if not exists supplier_offer_matches_offer_id_idx on public.supplier_offer_matches(supplier_offer_id);
create index if not exists supplier_price_history_material_id_idx on public.supplier_price_history(material_id, checked_at desc);
create index if not exists online_price_discoveries_company_id_idx on public.online_price_discoveries(company_id, created_at desc);
create index if not exists online_price_discoveries_material_id_idx on public.online_price_discoveries(material_id, created_at desc);
create index if not exists online_price_offers_discovery_id_idx on public.online_price_offers(discovery_id);
create index if not exists online_price_offers_material_id_idx on public.online_price_offers(material_id, total_price_gross);
create index if not exists online_price_offers_source_key_idx on public.online_price_offers(company_id, source_key);
create index if not exists material_calculation_rules_company_id_idx on public.material_calculation_rules(company_id);
create index if not exists material_calculation_rules_roof_type_idx on public.material_calculation_rules(roof_type, active);
create unique index if not exists material_calculation_rules_default_rule_key_idx
on public.material_calculation_rules(rule_key)
where company_id is null;
create unique index if not exists material_calculation_rules_company_rule_key_idx
on public.material_calculation_rules(company_id, rule_key)
where company_id is not null;
create index if not exists job_material_calculations_company_id_idx on public.job_material_calculations(company_id);
create index if not exists job_material_calculations_jobsite_id_idx on public.job_material_calculations(jobsite_id);
create index if not exists job_material_calculation_items_calculation_id_idx on public.job_material_calculation_items(calculation_id);
create index if not exists job_material_calculation_items_jobsite_id_idx on public.job_material_calculation_items(jobsite_id);
create index if not exists job_material_requirements_company_id_idx on public.job_material_requirements(company_id);
create index if not exists job_material_requirements_order_id_idx on public.job_material_requirements(order_id);
create index if not exists job_material_requirements_jobsite_id_idx on public.job_material_requirements(jobsite_id);
create index if not exists vehicles_company_id_idx on public.vehicles(company_id);
create index if not exists tasks_company_id_idx on public.tasks(company_id);
create index if not exists tasks_assigned_to_idx on public.tasks(assigned_to);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_companies_updated_at on public.companies;
create trigger set_companies_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists set_jobsites_updated_at on public.jobsites;
create trigger set_jobsites_updated_at
before update on public.jobsites
for each row execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists set_job_dimensions_updated_at on public.job_dimensions;
create trigger set_job_dimensions_updated_at
before update on public.job_dimensions
for each row execute function public.set_updated_at();

drop trigger if exists set_reports_updated_at on public.reports;
create trigger set_reports_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

drop trigger if exists set_time_entries_updated_at on public.time_entries;
create trigger set_time_entries_updated_at
before update on public.time_entries
for each row execute function public.set_updated_at();

drop trigger if exists set_materials_updated_at on public.materials;
create trigger set_materials_updated_at
before update on public.materials
for each row execute function public.set_updated_at();

drop trigger if exists set_material_categories_updated_at on public.material_categories;
create trigger set_material_categories_updated_at
before update on public.material_categories
for each row execute function public.set_updated_at();

drop trigger if exists set_material_subcategories_updated_at on public.material_subcategories;
create trigger set_material_subcategories_updated_at
before update on public.material_subcategories
for each row execute function public.set_updated_at();

drop trigger if exists set_material_catalog_updated_at on public.material_catalog;
create trigger set_material_catalog_updated_at
before update on public.material_catalog
for each row execute function public.set_updated_at();

drop trigger if exists set_inventory_locations_updated_at on public.inventory_locations;
create trigger set_inventory_locations_updated_at
before update on public.inventory_locations
for each row execute function public.set_updated_at();

drop trigger if exists set_suppliers_updated_at on public.suppliers;
create trigger set_suppliers_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

drop trigger if exists set_inventory_items_updated_at on public.inventory_items;
create trigger set_inventory_items_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

drop trigger if exists set_material_import_templates_updated_at on public.material_import_templates;
create trigger set_material_import_templates_updated_at
before update on public.material_import_templates
for each row execute function public.set_updated_at();

drop trigger if exists set_supplier_integrations_updated_at on public.supplier_integrations;
create trigger set_supplier_integrations_updated_at
before update on public.supplier_integrations
for each row execute function public.set_updated_at();

drop trigger if exists set_supplier_offers_updated_at on public.supplier_offers;
create trigger set_supplier_offers_updated_at
before update on public.supplier_offers
for each row execute function public.set_updated_at();

drop trigger if exists set_company_pricing_settings_updated_at on public.company_pricing_settings;
create trigger set_company_pricing_settings_updated_at
before update on public.company_pricing_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_material_calculation_rules_updated_at on public.material_calculation_rules;
create trigger set_material_calculation_rules_updated_at
before update on public.material_calculation_rules
for each row execute function public.set_updated_at();

drop trigger if exists set_job_material_calculations_updated_at on public.job_material_calculations;
create trigger set_job_material_calculations_updated_at
before update on public.job_material_calculations
for each row execute function public.set_updated_at();

drop trigger if exists set_job_material_calculation_items_updated_at on public.job_material_calculation_items;
create trigger set_job_material_calculation_items_updated_at
before update on public.job_material_calculation_items
for each row execute function public.set_updated_at();

drop trigger if exists set_job_material_requirements_updated_at on public.job_material_requirements;
create trigger set_job_material_requirements_updated_at
before update on public.job_material_requirements
for each row execute function public.set_updated_at();

drop trigger if exists set_vehicles_updated_at on public.vehicles;
create trigger set_vehicles_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

drop trigger if exists set_vehicle_materials_updated_at on public.vehicle_materials;
create trigger set_vehicle_materials_updated_at
before update on public.vehicle_materials
for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id
  from public.profiles
  where id = auth.uid()
    and active = true
  limit 1
$$;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and active = true
  limit 1
$$;

create or replace function public.can_manage_company()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() in ('admin', 'chef'), false)
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_company_id uuid;
  requested_role text;
begin
  target_company_id := nullif(new.raw_user_meta_data->>'company_id', '')::uuid;
  requested_role := coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'admin');

  if requested_role not in ('admin', 'chef', 'vorarbeiter', 'mitarbeiter') then
    requested_role := 'mitarbeiter';
  end if;

  if target_company_id is null then
    insert into public.companies (name, created_by)
    values (coalesce(nullif(new.raw_user_meta_data->>'company_name', ''), 'Meine Firma'), new.id)
    returning id into target_company_id;

    requested_role := 'admin';
  end if;

  insert into public.profiles (id, company_id, email, full_name, role)
  values (
    new.id,
    target_company_id,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    requested_role
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    company_id = excluded.company_id,
    role = excluded.role,
    active = true;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.bootstrap_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_profile public.profiles;
  target_company_id uuid;
  user_email text;
  user_full_name text;
  user_company_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into existing_profile
  from public.profiles
  where id = auth.uid()
  limit 1;

  if found then
    return existing_profile;
  end if;

  user_email := nullif(auth.jwt()->>'email', '');
  user_full_name := nullif(auth.jwt()->'user_metadata'->>'full_name', '');
  user_company_name := coalesce(nullif(auth.jwt()->'user_metadata'->>'company_name', ''), 'Meine Firma');

  insert into public.companies (name, created_by)
  values (user_company_name, auth.uid())
  returning id into target_company_id;

  insert into public.profiles (id, company_id, email, full_name, role, active)
  values (auth.uid(), target_company_id, user_email, user_full_name, 'admin', true)
  returning * into existing_profile;

  return existing_profile;
end;
$$;

grant execute on function public.bootstrap_my_profile() to authenticated;

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.jobsites enable row level security;
alter table public.orders enable row level security;
alter table public.job_dimensions enable row level security;
alter table public.reports enable row level security;
alter table public.report_photos enable row level security;
alter table public.time_entries enable row level security;
alter table public.time_entry_audit_log enable row level security;
alter table public.time_reports enable row level security;
alter table public.time_report_entries enable row level security;
alter table public.materials enable row level security;
alter table public.material_categories enable row level security;
alter table public.material_subcategories enable row level security;
alter table public.material_catalog enable row level security;
alter table public.material_aliases enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.suppliers enable row level security;
alter table public.inventory_items enable row level security;
alter table public.material_import_templates enable row level security;
alter table public.supplier_integrations enable row level security;
alter table public.supplier_offers enable row level security;
alter table public.supplier_offer_matches enable row level security;
alter table public.supplier_price_history enable row level security;
alter table public.online_price_discoveries enable row level security;
alter table public.online_price_offers enable row level security;
alter table public.company_pricing_settings enable row level security;
alter table public.material_calculation_rules enable row level security;
alter table public.job_material_calculations enable row level security;
alter table public.job_material_calculation_items enable row level security;
alter table public.job_material_requirements enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_materials enable row level security;
alter table public.tasks enable row level security;

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

drop policy if exists "members can read profiles in own company" on public.profiles;
create policy "members can read profiles in own company"
on public.profiles for select
to authenticated
using (company_id = public.current_company_id());

drop policy if exists "managers can insert profiles" on public.profiles;
create policy "managers can insert profiles"
on public.profiles for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update profiles" on public.profiles;
create policy "managers can update profiles"
on public.profiles for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete profiles" on public.profiles;
create policy "managers can delete profiles"
on public.profiles for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can read customers" on public.customers;
create policy "managers can read customers"
on public.customers for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert customers" on public.customers;
create policy "managers can insert customers"
on public.customers for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update customers" on public.customers;
create policy "managers can update customers"
on public.customers for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete customers" on public.customers;
create policy "managers can delete customers"
on public.customers for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "read relevant jobsites" on public.jobsites;
create policy "read relevant jobsites"
on public.jobsites for select
to authenticated
using (
  company_id = public.current_company_id()
  and (public.can_manage_company() or auth.uid() = any(assigned_employee_ids))
);

drop policy if exists "managers can insert jobsites" on public.jobsites;
create policy "managers can insert jobsites"
on public.jobsites for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update jobsites" on public.jobsites;
create policy "managers can update jobsites"
on public.jobsites for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete jobsites" on public.jobsites;
create policy "managers can delete jobsites"
on public.jobsites for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can read orders" on public.orders;
create policy "managers can read orders"
on public.orders for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert orders" on public.orders;
create policy "managers can insert orders"
on public.orders for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update orders" on public.orders;
create policy "managers can update orders"
on public.orders for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete orders" on public.orders;
create policy "managers can delete orders"
on public.orders for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "read relevant job dimensions" on public.job_dimensions;
create policy "read relevant job dimensions"
on public.job_dimensions for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or exists (
      select 1
      from public.orders o
      where o.id = order_id
        and o.company_id = public.current_company_id()
        and auth.uid() = any(o.assigned_employee_ids)
    )
  )
);

drop policy if exists "managers can insert job dimensions" on public.job_dimensions;
create policy "managers can insert job dimensions"
on public.job_dimensions for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update job dimensions" on public.job_dimensions;
create policy "managers can update job dimensions"
on public.job_dimensions for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete job dimensions" on public.job_dimensions;
create policy "managers can delete job dimensions"
on public.job_dimensions for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "read relevant reports" on public.reports;
create policy "read relevant reports"
on public.reports for select
to authenticated
using (
  company_id = public.current_company_id()
  and (public.can_manage_company() or created_by = auth.uid() or auth.uid() = any(employee_ids))
);

drop policy if exists "create own reports" on public.reports;
create policy "create own reports"
on public.reports for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and (public.can_manage_company() or (created_by = auth.uid() and auth.uid() = any(employee_ids)))
);

drop policy if exists "update relevant reports" on public.reports;
create policy "update relevant reports"
on public.reports for update
to authenticated
using (
  company_id = public.current_company_id()
  and (public.can_manage_company() or created_by = auth.uid())
)
with check (
  company_id = public.current_company_id()
  and (public.can_manage_company() or created_by = auth.uid())
);

drop policy if exists "delete relevant reports" on public.reports;
create policy "delete relevant reports"
on public.reports for delete
to authenticated
using (
  company_id = public.current_company_id()
  and (public.can_manage_company() or created_by = auth.uid())
);

drop policy if exists "read relevant report photos" on public.report_photos;
create policy "read relevant report photos"
on public.report_photos for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or created_by = auth.uid()
    or exists (
      select 1
      from public.reports r
      where r.id = report_id
        and (r.created_by = auth.uid() or auth.uid() = any(r.employee_ids))
    )
  )
);

drop policy if exists "create report photos" on public.report_photos;
create policy "create report photos"
on public.report_photos for insert
to authenticated
with check (company_id = public.current_company_id() and created_by = auth.uid());

drop policy if exists "delete report photos" on public.report_photos;
create policy "delete report photos"
on public.report_photos for delete
to authenticated
using (
  company_id = public.current_company_id()
  and (public.can_manage_company() or created_by = auth.uid())
);

drop policy if exists "read relevant time entries" on public.time_entries;
create policy "read relevant time entries"
on public.time_entries for select
to authenticated
using (
  company_id = public.current_company_id()
  and (public.can_manage_company() or employee_id = auth.uid())
);

drop policy if exists "create time entries" on public.time_entries;
create policy "create time entries"
on public.time_entries for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or (
      employee_id = auth.uid()
      and created_by = auth.uid()
      and status in ('draft', 'submitted')
    )
  )
);

drop policy if exists "update relevant time entries" on public.time_entries;
create policy "update relevant time entries"
on public.time_entries for update
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or (employee_id = auth.uid() and status <> 'approved')
  )
)
with check (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or (
      employee_id = auth.uid()
      and approved_by is null
      and approved_at is null
      and status in ('draft', 'submitted', 'rejected')
    )
  )
);

drop policy if exists "managers can delete time entries" on public.time_entries;
create policy "managers can delete time entries"
on public.time_entries for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "read relevant time audits" on public.time_entry_audit_log;
create policy "read relevant time audits"
on public.time_entry_audit_log for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or exists (
      select 1 from public.time_entries te
      where te.id = time_entry_id
        and te.employee_id = auth.uid()
    )
  )
);

drop policy if exists "create time audits" on public.time_entry_audit_log;
create policy "create time audits"
on public.time_entry_audit_log for insert
to authenticated
with check (company_id = public.current_company_id() and changed_by = auth.uid());

drop policy if exists "managers can read time reports" on public.time_reports;
create policy "managers can read time reports"
on public.time_reports for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert time reports" on public.time_reports;
create policy "managers can insert time reports"
on public.time_reports for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update time reports" on public.time_reports;
create policy "managers can update time reports"
on public.time_reports for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete time reports" on public.time_reports;
create policy "managers can delete time reports"
on public.time_reports for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can read time report entries" on public.time_report_entries;
create policy "managers can read time report entries"
on public.time_report_entries for select
to authenticated
using (
  exists (
    select 1 from public.time_reports tr
    where tr.id = time_report_id
      and tr.company_id = public.current_company_id()
      and public.can_manage_company()
  )
);

drop policy if exists "managers can insert time report entries" on public.time_report_entries;
create policy "managers can insert time report entries"
on public.time_report_entries for insert
to authenticated
with check (
  exists (
    select 1 from public.time_reports tr
    where tr.id = time_report_id
      and tr.company_id = public.current_company_id()
      and public.can_manage_company()
  )
);

drop policy if exists "managers can delete time report entries" on public.time_report_entries;
create policy "managers can delete time report entries"
on public.time_report_entries for delete
to authenticated
using (
  exists (
    select 1 from public.time_reports tr
    where tr.id = time_report_id
      and tr.company_id = public.current_company_id()
      and public.can_manage_company()
  )
);

drop policy if exists "read own company materials" on public.materials;
create policy "read own company materials"
on public.materials for select
to authenticated
using (company_id = public.current_company_id());

drop policy if exists "managers can insert materials" on public.materials;
create policy "managers can insert materials"
on public.materials for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update materials" on public.materials;
create policy "managers can update materials"
on public.materials for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete materials" on public.materials;
create policy "managers can delete materials"
on public.materials for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "authenticated can read active material categories" on public.material_categories;
create policy "authenticated can read active material categories"
on public.material_categories for select
to authenticated
using (active = true);

drop policy if exists "authenticated can read active material subcategories" on public.material_subcategories;
create policy "authenticated can read active material subcategories"
on public.material_subcategories for select
to authenticated
using (active = true);

drop policy if exists "authenticated can read active material catalog" on public.material_catalog;
create policy "authenticated can read active material catalog"
on public.material_catalog for select
to authenticated
using (active = true);

drop policy if exists "authenticated can read material aliases" on public.material_aliases;
create policy "authenticated can read material aliases"
on public.material_aliases for select
to authenticated
using (
  exists (
    select 1
    from public.material_catalog c
    where c.id = catalog_item_id
      and c.active = true
  )
);

drop policy if exists "read own company inventory locations" on public.inventory_locations;
create policy "read own company inventory locations"
on public.inventory_locations for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert inventory locations" on public.inventory_locations;
create policy "managers can insert inventory locations"
on public.inventory_locations for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update inventory locations" on public.inventory_locations;
create policy "managers can update inventory locations"
on public.inventory_locations for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete inventory locations" on public.inventory_locations;
create policy "managers can delete inventory locations"
on public.inventory_locations for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "read own company suppliers" on public.suppliers;
create policy "read own company suppliers"
on public.suppliers for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert suppliers" on public.suppliers;
create policy "managers can insert suppliers"
on public.suppliers for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update suppliers" on public.suppliers;
create policy "managers can update suppliers"
on public.suppliers for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete suppliers" on public.suppliers;
create policy "managers can delete suppliers"
on public.suppliers for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "read own company inventory items" on public.inventory_items;
create policy "read own company inventory items"
on public.inventory_items for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert inventory items" on public.inventory_items;
create policy "managers can insert inventory items"
on public.inventory_items for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update inventory items" on public.inventory_items;
create policy "managers can update inventory items"
on public.inventory_items for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete inventory items" on public.inventory_items;
create policy "managers can delete inventory items"
on public.inventory_items for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "authenticated can read material import templates" on public.material_import_templates;
create policy "authenticated can read material import templates"
on public.material_import_templates for select
to authenticated
using (active = true);

drop policy if exists "managers can read supplier integrations" on public.supplier_integrations;
create policy "managers can read supplier integrations"
on public.supplier_integrations for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert supplier integrations" on public.supplier_integrations;
create policy "managers can insert supplier integrations"
on public.supplier_integrations for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update supplier integrations" on public.supplier_integrations;
create policy "managers can update supplier integrations"
on public.supplier_integrations for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete supplier integrations" on public.supplier_integrations;
create policy "managers can delete supplier integrations"
on public.supplier_integrations for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can read supplier offers" on public.supplier_offers;
create policy "managers can read supplier offers"
on public.supplier_offers for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert supplier offers" on public.supplier_offers;
create policy "managers can insert supplier offers"
on public.supplier_offers for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update supplier offers" on public.supplier_offers;
create policy "managers can update supplier offers"
on public.supplier_offers for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete supplier offers" on public.supplier_offers;
create policy "managers can delete supplier offers"
on public.supplier_offers for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can read supplier offer matches" on public.supplier_offer_matches;
create policy "managers can read supplier offer matches"
on public.supplier_offer_matches for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert supplier offer matches" on public.supplier_offer_matches;
create policy "managers can insert supplier offer matches"
on public.supplier_offer_matches for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update supplier offer matches" on public.supplier_offer_matches;
create policy "managers can update supplier offer matches"
on public.supplier_offer_matches for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete supplier offer matches" on public.supplier_offer_matches;
create policy "managers can delete supplier offer matches"
on public.supplier_offer_matches for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can read supplier price history" on public.supplier_price_history;
create policy "managers can read supplier price history"
on public.supplier_price_history for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert supplier price history" on public.supplier_price_history;
create policy "managers can insert supplier price history"
on public.supplier_price_history for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete supplier price history" on public.supplier_price_history;
create policy "managers can delete supplier price history"
on public.supplier_price_history for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

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

drop policy if exists "managers can read pricing settings" on public.company_pricing_settings;
create policy "managers can read pricing settings"
on public.company_pricing_settings for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert pricing settings" on public.company_pricing_settings;
create policy "managers can insert pricing settings"
on public.company_pricing_settings for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update pricing settings" on public.company_pricing_settings;
create policy "managers can update pricing settings"
on public.company_pricing_settings for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "members can read calculation rules" on public.material_calculation_rules;
create policy "members can read calculation rules"
on public.material_calculation_rules for select
to authenticated
using (
  active = true
  and (company_id is null or company_id = public.current_company_id())
);

drop policy if exists "managers can insert calculation rules" on public.material_calculation_rules;
create policy "managers can insert calculation rules"
on public.material_calculation_rules for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update calculation rules" on public.material_calculation_rules;
create policy "managers can update calculation rules"
on public.material_calculation_rules for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete calculation rules" on public.material_calculation_rules;
create policy "managers can delete calculation rules"
on public.material_calculation_rules for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "read relevant job material calculations" on public.job_material_calculations;
create policy "read relevant job material calculations"
on public.job_material_calculations for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or exists (
      select 1
      from public.jobsites j
      where j.id = jobsite_id
        and j.company_id = public.current_company_id()
        and auth.uid() = any(j.assigned_employee_ids)
    )
  )
);

drop policy if exists "managers can insert job material calculations" on public.job_material_calculations;
create policy "managers can insert job material calculations"
on public.job_material_calculations for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update job material calculations" on public.job_material_calculations;
create policy "managers can update job material calculations"
on public.job_material_calculations for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete job material calculations" on public.job_material_calculations;
create policy "managers can delete job material calculations"
on public.job_material_calculations for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can read priced calculation items" on public.job_material_calculation_items;
create policy "managers can read priced calculation items"
on public.job_material_calculation_items for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert calculation items" on public.job_material_calculation_items;
create policy "managers can insert calculation items"
on public.job_material_calculation_items for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update calculation items" on public.job_material_calculation_items;
create policy "managers can update calculation items"
on public.job_material_calculation_items for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete calculation items" on public.job_material_calculation_items;
create policy "managers can delete calculation items"
on public.job_material_calculation_items for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can read priced order requirements" on public.job_material_requirements;
create policy "managers can read priced order requirements"
on public.job_material_requirements for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert order requirements" on public.job_material_requirements;
create policy "managers can insert order requirements"
on public.job_material_requirements for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update order requirements" on public.job_material_requirements;
create policy "managers can update order requirements"
on public.job_material_requirements for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete order requirements" on public.job_material_requirements;
create policy "managers can delete order requirements"
on public.job_material_requirements for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

create or replace view public.orders_public as
select
  o.id,
  o.company_id,
  o.customer_id,
  o.jobsite_id,
  o.order_number,
  o.title,
  o.order_type,
  o.status,
  o.priority,
  o.jobsite_address,
  o.start_date,
  o.end_date,
  o.description,
  o.assigned_employee_ids,
  o.has_dimensions,
  o.created_by,
  o.created_at,
  o.updated_at,
  coalesce(
    nullif(trim(coalesce(nullif(c.company, ''), '') || ' ' || coalesce(nullif(c.first_name, ''), '') || ' ' || coalesce(nullif(c.last_name, ''), '')), ''),
    'Kunde'
  ) as customer_name
from public.orders o
join public.customers c on c.id = o.customer_id
where o.company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or auth.uid() = any(o.assigned_employee_ids)
  );

grant select on public.orders_public to authenticated;

create or replace view public.inventory_items_public as
select
  i.id,
  i.company_id,
  i.catalog_item_id,
  i.category_id,
  i.subcategory_id,
  i.location_id,
  i.name,
  i.unit,
  i.stock,
  i.minimum_stock,
  i.package_unit,
  i.manufacturer,
  i.article_number,
  i.notes,
  i.created_at,
  i.updated_at,
  l.name as location_name,
  l.location_type,
  c.name as category_name,
  s.name as subcategory_name
from public.inventory_items i
left join public.inventory_locations l on l.id = i.location_id
left join public.material_categories c on c.id = i.category_id
left join public.material_subcategories s on s.id = i.subcategory_id
where i.company_id = public.current_company_id();

grant select on public.inventory_items_public to authenticated;

create or replace view public.job_material_calculation_items_public as
select
  item.id,
  item.company_id,
  item.calculation_id,
  item.jobsite_id,
  item.rule_id,
  item.catalog_item_id,
  item.inventory_item_id,
  item.material_name,
  item.unit,
  item.base_quantity,
  item.waste_percent,
  item.waste_quantity,
  item.total_quantity,
  item.location_name,
  item.stock,
  item.minimum_stock,
  item.created_at,
  item.updated_at
from public.job_material_calculation_items item
join public.job_material_calculations calculation on calculation.id = item.calculation_id
join public.jobsites jobsite on jobsite.id = item.jobsite_id
where item.company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or auth.uid() = any(jobsite.assigned_employee_ids)
  );

grant select on public.job_material_calculation_items_public to authenticated;

create or replace view public.job_material_requirements_public as
select
  item.id,
  item.company_id,
  item.order_id,
  item.dimension_id,
  item.jobsite_id,
  item.rule_id,
  item.catalog_item_id,
  item.inventory_item_id,
  item.material_name,
  item.unit,
  item.base_quantity,
  item.waste_percent,
  item.waste_quantity,
  item.total_quantity,
  item.location_name,
  item.stock,
  item.minimum_stock,
  item.created_at,
  item.updated_at
from public.job_material_requirements item
join public.orders o on o.id = item.order_id
where item.company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or auth.uid() = any(o.assigned_employee_ids)
  );

grant select on public.job_material_requirements_public to authenticated;

drop policy if exists "read own company vehicles" on public.vehicles;
create policy "read own company vehicles"
on public.vehicles for select
to authenticated
using (company_id = public.current_company_id());

drop policy if exists "managers can insert vehicles" on public.vehicles;
create policy "managers can insert vehicles"
on public.vehicles for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update vehicles" on public.vehicles;
create policy "managers can update vehicles"
on public.vehicles for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete vehicles" on public.vehicles;
create policy "managers can delete vehicles"
on public.vehicles for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "read own company vehicle materials" on public.vehicle_materials;
create policy "read own company vehicle materials"
on public.vehicle_materials for select
to authenticated
using (company_id = public.current_company_id());

drop policy if exists "managers can insert vehicle materials" on public.vehicle_materials;
create policy "managers can insert vehicle materials"
on public.vehicle_materials for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update vehicle materials" on public.vehicle_materials;
create policy "managers can update vehicle materials"
on public.vehicle_materials for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete vehicle materials" on public.vehicle_materials;
create policy "managers can delete vehicle materials"
on public.vehicle_materials for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "read relevant tasks" on public.tasks;
create policy "read relevant tasks"
on public.tasks for select
to authenticated
using (
  company_id = public.current_company_id()
  and (public.can_manage_company() or assigned_to = auth.uid())
);

drop policy if exists "managers can insert tasks" on public.tasks;
create policy "managers can insert tasks"
on public.tasks for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "update relevant tasks" on public.tasks;
create policy "update relevant tasks"
on public.tasks for update
to authenticated
using (
  company_id = public.current_company_id()
  and (public.can_manage_company() or assigned_to = auth.uid())
)
with check (
  company_id = public.current_company_id()
  and (public.can_manage_company() or assigned_to = auth.uid())
);

drop policy if exists "managers can delete tasks" on public.tasks;
create policy "managers can delete tasks"
on public.tasks for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', false)
on conflict (id) do nothing;

drop policy if exists "members can read company report photos" on storage.objects;
create policy "members can read company report photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'report-photos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
);

drop policy if exists "members can upload company report photos" on storage.objects;
create policy "members can upload company report photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'report-photos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
);

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

-- BauPro AI job wizard: draft extraction, rule-based estimate and confirmation workflow.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.calculation_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade unique,
  default_waste_percent numeric(7, 2) not null default 20,
  default_vat_rate numeric(7, 2) not null default 19,
  default_labor_rate_net numeric(12, 2) not null default 65,
  default_internal_hourly_cost numeric(12, 2) not null default 38,
  default_profit_markup_percent numeric(7, 2) not null default 10,
  default_overhead_percent numeric(7, 2) not null default 12,
  default_travel_flat_rate numeric(12, 2) not null default 0,
  allow_ai_job_creation boolean not null default true,
  require_admin_confirmation boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_job_drafts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  raw_input text not null,
  parsed_json jsonb not null default '{}'::jsonb,
  preview_json jsonb not null default '{}'::jsonb,
  confidence numeric(4, 3) not null default 0 check (confidence >= 0 and confidence <= 1),
  status text not null default 'proposed' check (status in ('proposed', 'incomplete', 'confirmed', 'rejected', 'converted_to_job')),
  missing_fields jsonb not null default '[]'::jsonb,
  converted_order_id uuid,
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
end $$;

create index if not exists calculation_settings_company_idx on public.calculation_settings(company_id);
create index if not exists ai_job_drafts_company_status_idx on public.ai_job_drafts(company_id, status, created_at desc);
create index if not exists ai_job_drafts_created_by_idx on public.ai_job_drafts(created_by, created_at desc);
create index if not exists job_estimates_company_created_idx on public.job_estimates(company_id, created_at desc);
create index if not exists job_estimates_job_idx on public.job_estimates(job_id);
create index if not exists job_estimate_items_estimate_idx on public.job_estimate_items(estimate_id);

drop trigger if exists set_calculation_settings_updated_at on public.calculation_settings;
create trigger set_calculation_settings_updated_at
before update on public.calculation_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_ai_job_drafts_updated_at on public.ai_job_drafts;
create trigger set_ai_job_drafts_updated_at
before update on public.ai_job_drafts
for each row execute function public.set_updated_at();

drop trigger if exists set_job_estimates_updated_at on public.job_estimates;
create trigger set_job_estimates_updated_at
before update on public.job_estimates
for each row execute function public.set_updated_at();

alter table public.calculation_settings enable row level security;
alter table public.ai_job_drafts enable row level security;
alter table public.job_estimates enable row level security;
alter table public.job_estimate_items enable row level security;

grant select, insert, update on public.calculation_settings to authenticated;
grant select, insert, update on public.ai_job_drafts to authenticated;
grant select, insert, update on public.job_estimates to authenticated;
grant select, insert on public.job_estimate_items to authenticated;

drop policy if exists "managers read calculation settings" on public.calculation_settings;
create policy "managers read calculation settings"
on public.calculation_settings for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers manage calculation settings" on public.calculation_settings;
create policy "managers manage calculation settings"
on public.calculation_settings for all
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

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

-- BauPro AI features: settings, action proposals and usage logging.

create table if not exists public.ai_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade unique,
  enabled boolean not null default true,
  default_model text not null default 'gpt-4.1-mini',
  allow_employee_ai boolean not null default true,
  allow_ai_daily_reports boolean not null default true,
  allow_ai_time_tracking boolean not null default true,
  allow_ai_material_matching boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  status text not null default 'success' check (status in ('success', 'disabled', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null,
  raw_input text not null,
  parsed_json jsonb not null default '{}'::jsonb,
  confidence numeric(4, 3) not null default 0 check (confidence >= 0 and confidence <= 1),
  status text not null default 'proposed' check (status in ('proposed', 'confirmed', 'rejected', 'executed')),
  linked_customer_id uuid,
  linked_job_id uuid,
  linked_time_entry_id uuid,
  linked_bring_list_id uuid,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

do $$
begin
  if to_regclass('public.customers') is not null then
    alter table public.ai_actions drop constraint if exists ai_actions_linked_customer_id_fkey;
    alter table public.ai_actions
    add constraint ai_actions_linked_customer_id_fkey
    foreign key (linked_customer_id) references public.customers(id) on delete set null;
  end if;

  if to_regclass('public.jobsites') is not null then
    alter table public.ai_actions drop constraint if exists ai_actions_linked_job_id_fkey;
    alter table public.ai_actions
    add constraint ai_actions_linked_job_id_fkey
    foreign key (linked_job_id) references public.jobsites(id) on delete set null;
  end if;

  if to_regclass('public.time_entries') is not null then
    alter table public.ai_actions drop constraint if exists ai_actions_linked_time_entry_id_fkey;
    alter table public.ai_actions
    add constraint ai_actions_linked_time_entry_id_fkey
    foreign key (linked_time_entry_id) references public.time_entries(id) on delete set null;
  end if;

  if to_regclass('public.bring_lists') is not null then
    alter table public.ai_actions drop constraint if exists ai_actions_linked_bring_list_id_fkey;
    alter table public.ai_actions
    add constraint ai_actions_linked_bring_list_id_fkey
    foreign key (linked_bring_list_id) references public.bring_lists(id) on delete set null;
  end if;
end $$;

create index if not exists ai_settings_company_idx on public.ai_settings(company_id);
create index if not exists ai_usage_logs_company_created_idx on public.ai_usage_logs(company_id, created_at desc);
create index if not exists ai_usage_logs_user_created_idx on public.ai_usage_logs(user_id, created_at desc);
create index if not exists ai_actions_company_status_idx on public.ai_actions(company_id, status, created_at desc);
create index if not exists ai_actions_user_status_idx on public.ai_actions(user_id, status, created_at desc);

drop trigger if exists set_ai_settings_updated_at on public.ai_settings;
create trigger set_ai_settings_updated_at
before update on public.ai_settings
for each row execute function public.set_updated_at();

alter table public.ai_settings enable row level security;
alter table public.ai_usage_logs enable row level security;
alter table public.ai_actions enable row level security;

grant select, insert, update on public.ai_settings to authenticated;
grant select, insert on public.ai_usage_logs to authenticated;
grant select, insert, update on public.ai_actions to authenticated;

drop policy if exists "company members read ai settings" on public.ai_settings;
create policy "company members read ai settings"
on public.ai_settings for select
to authenticated
using (company_id = public.current_company_id());

drop policy if exists "managers insert ai settings" on public.ai_settings;
create policy "managers insert ai settings"
on public.ai_settings for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update ai settings" on public.ai_settings;
create policy "managers update ai settings"
on public.ai_settings for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers read ai usage logs" on public.ai_usage_logs;
create policy "managers read ai usage logs"
on public.ai_usage_logs for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "company members create own ai usage logs" on public.ai_usage_logs;
create policy "company members create own ai usage logs"
on public.ai_usage_logs for insert
to authenticated
with check (company_id = public.current_company_id() and user_id = auth.uid());

drop policy if exists "read relevant ai actions" on public.ai_actions;
create policy "read relevant ai actions"
on public.ai_actions for select
to authenticated
using (company_id = public.current_company_id() and (public.can_manage_company() or user_id = auth.uid()));

drop policy if exists "create own ai actions" on public.ai_actions;
create policy "create own ai actions"
on public.ai_actions for insert
to authenticated
with check (company_id = public.current_company_id() and user_id = auth.uid());

drop policy if exists "update own proposed ai actions" on public.ai_actions;
create policy "update own proposed ai actions"
on public.ai_actions for update
to authenticated
using (company_id = public.current_company_id() and (public.can_manage_company() or user_id = auth.uid()))
with check (company_id = public.current_company_id() and (public.can_manage_company() or user_id = auth.uid()));

select pg_notify('pgrst', 'reload schema');

-- SaaS hardening: Firmenprofil, Archivierung und Audit-Grundlage.

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

create index if not exists companies_onboarding_idx on public.companies(onboarding_completed_at);
create index if not exists customers_archived_idx on public.customers(company_id, archived_at);
create index if not exists jobsites_archived_idx on public.jobsites(company_id, archived_at);
create index if not exists orders_archived_idx on public.orders(company_id, archived_at);
create index if not exists inventory_items_archived_idx on public.inventory_items(company_id, archived_at);
create index if not exists company_audit_log_company_created_idx on public.company_audit_log(company_id, created_at desc);
create index if not exists company_audit_log_entity_idx on public.company_audit_log(company_id, entity_type, entity_id);
create index if not exists privacy_requests_company_created_idx on public.privacy_requests(company_id, created_at desc);
create index if not exists privacy_requests_requester_idx on public.privacy_requests(requester_id, created_at desc);

alter table public.company_audit_log enable row level security;
alter table public.privacy_requests enable row level security;

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

select pg_notify('pgrst', 'reload schema');

-- Voice-Diktat, Mitbringlisten, Lagerabgleich, Chef-Meldungen und Einkaufsvorschlaege.

create table if not exists public.voice_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  raw_text text not null,
  detected_intent text not null default 'unknown' check (
    detected_intent in ('bring_list', 'time_tracking', 'material_alert', 'job_note', 'unknown')
  ),
  detected_entities jsonb not null default '{}'::jsonb,
  linked_customer_id uuid references public.customers(id) on delete set null,
  linked_job_id uuid references public.jobsites(id) on delete set null,
  linked_time_entry_id uuid references public.time_entries(id) on delete set null,
  linked_bring_list_id uuid,
  linked_material_alert_id uuid,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'discarded')),
  created_at timestamptz not null default now()
);

create table if not exists public.voice_routing_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  keyword text not null,
  intent text not null check (intent in ('bring_list', 'time_tracking', 'material_alert', 'job_note', 'unknown')),
  priority integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bring_lists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobsites(id) on delete cascade,
  date date not null,
  title text not null,
  notes text,
  status text not null default 'draft' check (status in ('draft', 'ready', 'packed', 'delivered')),
  created_by uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bring_list_items (
  id uuid primary key default gen_random_uuid(),
  bring_list_id uuid not null references public.bring_lists(id) on delete cascade,
  material_id uuid references public.materials(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  custom_item_name text not null,
  item_type text not null default 'material' check (item_type in ('material', 'tool', 'document', 'safety', 'other')),
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit text not null default 'Stueck',
  storage_location text,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  packed boolean not null default false,
  packed_by uuid references public.profiles(id) on delete set null,
  packed_at timestamptz,
  missing_reported boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.voice_notes
drop constraint if exists voice_notes_linked_bring_list_id_fkey;
alter table public.voice_notes
add constraint voice_notes_linked_bring_list_id_fkey
foreign key (linked_bring_list_id) references public.bring_lists(id) on delete set null;

create table if not exists public.material_reservations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid references public.jobsites(id) on delete cascade,
  bring_list_id uuid references public.bring_lists(id) on delete cascade,
  material_id uuid references public.materials(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  quantity_required numeric(12, 2) not null default 0 check (quantity_required >= 0),
  quantity_reserved numeric(12, 2) not null default 0 check (quantity_reserved >= 0),
  unit text not null default 'Stueck',
  status text not null default 'open' check (
    status in ('open', 'reserved', 'partially_reserved', 'missing', 'consumed', 'cancelled')
  ),
  reserved_by uuid references public.profiles(id) on delete set null,
  reserved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  material_id uuid references public.materials(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  job_id uuid references public.jobsites(id) on delete cascade,
  bring_list_id uuid references public.bring_lists(id) on delete cascade,
  alert_type text not null check (
    alert_type in ('low_stock', 'out_of_stock', 'missing_for_job', 'below_minimum_after_reservation')
  ),
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  message text not null,
  required_quantity numeric(12, 2),
  available_quantity numeric(12, 2),
  missing_quantity numeric(12, 2),
  unit text,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  created_by_system boolean not null default true,
  assigned_to_admin uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);

alter table public.voice_notes
drop constraint if exists voice_notes_linked_material_alert_id_fkey;
alter table public.voice_notes
add constraint voice_notes_linked_material_alert_id_fkey
foreign key (linked_material_alert_id) references public.material_alerts(id) on delete set null;

create table if not exists public.purchase_suggestions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  material_id uuid references public.materials(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  job_id uuid references public.jobsites(id) on delete cascade,
  bring_list_id uuid references public.bring_lists(id) on delete cascade,
  quantity_needed numeric(12, 2) not null default 0 check (quantity_needed > 0),
  unit text not null default 'Stueck',
  reason text not null,
  status text not null default 'open' check (status in ('open', 'ordered', 'ignored', 'received')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists voice_notes_company_created_idx on public.voice_notes(company_id, created_at desc);
create index if not exists voice_notes_user_idx on public.voice_notes(user_id, created_at desc);
create index if not exists voice_routing_rules_company_idx on public.voice_routing_rules(company_id, priority);
create index if not exists bring_lists_company_date_idx on public.bring_lists(company_id, date);
create index if not exists bring_lists_job_idx on public.bring_lists(job_id, date);
create index if not exists bring_lists_assigned_to_idx on public.bring_lists(assigned_to, date);
create index if not exists bring_list_items_list_idx on public.bring_list_items(bring_list_id);
create index if not exists bring_list_items_inventory_idx on public.bring_list_items(inventory_item_id);
create index if not exists material_reservations_company_idx on public.material_reservations(company_id, status);
create index if not exists material_reservations_inventory_idx on public.material_reservations(inventory_item_id, status);
create index if not exists material_reservations_bring_list_idx on public.material_reservations(bring_list_id);
create index if not exists material_alerts_company_status_idx on public.material_alerts(company_id, status, severity);
create index if not exists material_alerts_inventory_idx on public.material_alerts(inventory_item_id, status);
create index if not exists material_alerts_bring_list_idx on public.material_alerts(bring_list_id, status);
create index if not exists purchase_suggestions_company_status_idx on public.purchase_suggestions(company_id, status);
create index if not exists purchase_suggestions_inventory_idx on public.purchase_suggestions(inventory_item_id, status);

drop trigger if exists set_bring_lists_updated_at on public.bring_lists;
create trigger set_bring_lists_updated_at
before update on public.bring_lists
for each row execute function public.set_updated_at();

drop trigger if exists set_material_reservations_updated_at on public.material_reservations;
create trigger set_material_reservations_updated_at
before update on public.material_reservations
for each row execute function public.set_updated_at();

drop trigger if exists set_purchase_suggestions_updated_at on public.purchase_suggestions;
create trigger set_purchase_suggestions_updated_at
before update on public.purchase_suggestions
for each row execute function public.set_updated_at();

alter table public.voice_notes enable row level security;
alter table public.voice_routing_rules enable row level security;
alter table public.bring_lists enable row level security;
alter table public.bring_list_items enable row level security;
alter table public.material_reservations enable row level security;
alter table public.material_alerts enable row level security;
alter table public.purchase_suggestions enable row level security;

drop policy if exists "read own voice notes" on public.voice_notes;
create policy "read own voice notes"
on public.voice_notes for select
to authenticated
using (company_id = public.current_company_id() and (public.can_manage_company() or user_id = auth.uid()));

drop policy if exists "create own voice notes" on public.voice_notes;
create policy "create own voice notes"
on public.voice_notes for insert
to authenticated
with check (company_id = public.current_company_id() and user_id = auth.uid());

drop policy if exists "read active voice routing rules" on public.voice_routing_rules;
create policy "read active voice routing rules"
on public.voice_routing_rules for select
to authenticated
using (active = true and (company_id is null or company_id = public.current_company_id()));

drop policy if exists "managers manage voice routing rules" on public.voice_routing_rules;
create policy "managers manage voice routing rules"
on public.voice_routing_rules for all
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "read relevant bring lists" on public.bring_lists;
create policy "read relevant bring lists"
on public.bring_lists for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or assigned_to = auth.uid()
    or created_by = auth.uid()
    or exists (
      select 1 from public.jobsites j
      where j.id = job_id and auth.uid() = any(j.assigned_employee_ids)
    )
  )
);

drop policy if exists "create bring lists" on public.bring_lists;
create policy "create bring lists"
on public.bring_lists for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and (public.can_manage_company() or created_by = auth.uid())
);

drop policy if exists "update relevant bring lists" on public.bring_lists;
create policy "update relevant bring lists"
on public.bring_lists for update
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or assigned_to = auth.uid()
    or created_by = auth.uid()
    or exists (
      select 1 from public.jobsites j
      where j.id = job_id and auth.uid() = any(j.assigned_employee_ids)
    )
  )
)
with check (company_id = public.current_company_id());

drop policy if exists "managers delete bring lists" on public.bring_lists;
create policy "managers delete bring lists"
on public.bring_lists for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "read relevant bring list items" on public.bring_list_items;
create policy "read relevant bring list items"
on public.bring_list_items for select
to authenticated
using (
  exists (
    select 1 from public.bring_lists bl
    where bl.id = bring_list_id
      and bl.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or bl.assigned_to = auth.uid()
        or bl.created_by = auth.uid()
        or exists (
          select 1 from public.jobsites j
          where j.id = bl.job_id and auth.uid() = any(j.assigned_employee_ids)
        )
      )
  )
);

drop policy if exists "create relevant bring list items" on public.bring_list_items;
create policy "create relevant bring list items"
on public.bring_list_items for insert
to authenticated
with check (
  exists (
    select 1 from public.bring_lists bl
    where bl.id = bring_list_id
      and bl.company_id = public.current_company_id()
      and (public.can_manage_company() or bl.created_by = auth.uid())
  )
);

drop policy if exists "update relevant bring list items" on public.bring_list_items;
create policy "update relevant bring list items"
on public.bring_list_items for update
to authenticated
using (
  exists (
    select 1 from public.bring_lists bl
    where bl.id = bring_list_id
      and bl.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or bl.assigned_to = auth.uid()
        or bl.created_by = auth.uid()
        or exists (
          select 1 from public.jobsites j
          where j.id = bl.job_id and auth.uid() = any(j.assigned_employee_ids)
        )
      )
  )
)
with check (
  exists (
    select 1 from public.bring_lists bl
    where bl.id = bring_list_id
      and bl.company_id = public.current_company_id()
  )
);

drop policy if exists "managers delete bring list items" on public.bring_list_items;
create policy "managers delete bring list items"
on public.bring_list_items for delete
to authenticated
using (
  exists (
    select 1 from public.bring_lists bl
    where bl.id = bring_list_id
      and bl.company_id = public.current_company_id()
      and public.can_manage_company()
  )
);

drop policy if exists "read relevant material reservations" on public.material_reservations;
create policy "read relevant material reservations"
on public.material_reservations for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or exists (
      select 1 from public.bring_lists bl
      where bl.id = bring_list_id
        and (bl.assigned_to = auth.uid() or bl.created_by = auth.uid())
    )
  )
);

drop policy if exists "managers create material reservations" on public.material_reservations;
create policy "managers create material reservations"
on public.material_reservations for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update material reservations" on public.material_reservations;
create policy "managers update material reservations"
on public.material_reservations for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "read relevant material alerts" on public.material_alerts;
create policy "read relevant material alerts"
on public.material_alerts for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or exists (
      select 1 from public.bring_lists bl
      where bl.id = bring_list_id
        and (bl.assigned_to = auth.uid() or bl.created_by = auth.uid())
    )
  )
);

drop policy if exists "create material alerts" on public.material_alerts;
create policy "create material alerts"
on public.material_alerts for insert
to authenticated
with check (company_id = public.current_company_id());

drop policy if exists "managers update material alerts" on public.material_alerts;
create policy "managers update material alerts"
on public.material_alerts for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers read purchase suggestions" on public.purchase_suggestions;
create policy "managers read purchase suggestions"
on public.purchase_suggestions for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers create purchase suggestions" on public.purchase_suggestions;
drop policy if exists "company members create purchase suggestions" on public.purchase_suggestions;
create policy "company members create purchase suggestions"
on public.purchase_suggestions for insert
to authenticated
with check (company_id = public.current_company_id());

drop policy if exists "managers update purchase suggestions" on public.purchase_suggestions;
create policy "managers update purchase suggestions"
on public.purchase_suggestions for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

insert into public.voice_routing_rules (keyword, intent, priority)
select keyword, intent, priority
from (
  values
    ('mitnehmen', 'bring_list', 10),
    ('mitbringliste', 'bring_list', 10),
    ('einpacken', 'bring_list', 20),
    ('gearbeitet', 'time_tracking', 10),
    ('arbeitszeit', 'time_tracking', 10),
    ('pause', 'time_tracking', 30),
    ('fehlt', 'material_alert', 10),
    ('fehlen', 'material_alert', 10),
    ('knapp', 'material_alert', 20)
) as defaults(keyword, intent, priority)
where not exists (
  select 1 from public.voice_routing_rules existing
  where existing.company_id is null
    and existing.keyword = defaults.keyword
    and existing.intent = defaults.intent
);

select pg_notify('pgrst', 'reload schema');
