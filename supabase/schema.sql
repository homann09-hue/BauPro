-- BauPro schema for Supabase.
-- Run this file in the Supabase SQL editor before starting the app.

create extension if not exists pgcrypto;

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

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan_id text not null default 'starter' references public.plans(id) on delete restrict,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text not null default 'free' check (
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
  ),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  session_timeout_minutes integer not null default 30 constraint companies_session_timeout_minutes_check check (session_timeout_minutes between 0 and 1440),
  trade text not null default 'dachdecker',
  logo_path text,
  onboarding_completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'mitarbeiter' check (role in ('admin', 'chef', 'vorarbeiter', 'mitarbeiter', 'kunde')),
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
  latitude numeric,
  longitude numeric,
  weather_last_checked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  temperature_c numeric,
  precipitation_mm numeric,
  wind_kmh numeric,
  weather_code integer,
  risk_level text not null default 'green' check (risk_level in ('green', 'yellow', 'red')),
  summary text,
  source text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
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
  archived_at timestamptz,
  unique (order_id),
  check (waste_percent >= 0 and waste_percent <= 100)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid references public.jobsites(id) on delete set null,
  report_date date not null default current_date,
  weather text,
  weather_summary text,
  weather_temperature_c numeric,
  weather_precipitation_mm numeric,
  weather_wind_kmh numeric,
  weather_source text,
  weather_fetched_at timestamptz,
  weather_lat numeric,
  weather_lng numeric,
  work_start time,
  work_end time,
  employee_ids uuid[] not null default '{}',
  activities text not null,
  material_usage text,
  machine_usage text,
  vehicle_ids uuid[] not null default '{}',
  linked_time_entry_ids uuid[] not null default '{}',
  issues text,
  report_status text not null default 'draft' check (report_status in ('draft', 'submitted', 'reviewed', 'approved')),
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  visible_to_customer boolean not null default false,
  customer_summary text,
  customer_released_at timestamptz,
  customer_released_by uuid references public.profiles(id) on delete set null,
  signature_name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
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
  created_at timestamptz not null default now(),
  archived_at timestamptz
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
  weather_summary text,
  weather_temperature_c numeric,
  weather_precipitation_mm numeric,
  weather_wind_kmh numeric,
  weather_source text,
  weather_fetched_at timestamptz,
  weather_lat numeric,
  weather_lng numeric,
  kilometers numeric(10, 1),
  notes text,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
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
  archived_at timestamptz,
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
      'dormers_count',
      'chimneys_count',
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
  roof_form text,
  material_type text,
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
  dormers_count integer not null default 0 check (dormers_count >= 0),
  chimneys_count integer not null default 0 check (chimneys_count >= 0),
  waste_percent numeric(7, 2) not null default 20,
  ai_enabled boolean not null default false,
  ai_model text,
  ai_confidence numeric(5, 2),
  ai_notes text,
  review_notice text not null default 'Materialberechnung ist ein Vorschlag und muss fachlich geprueft werden.',
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
  missing_quantity numeric(12, 2) not null default 0 check (missing_quantity >= 0),
  source text not null default 'rule' check (source in ('rule', 'ai', 'manual')),
  ai_reason text,
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
  archived_at timestamptz,
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
  archived_at timestamptz,
  unique (vehicle_id, material_id)
);

create table if not exists public.planning_resources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  resource_kind text not null default 'geraet'
    check (resource_kind in ('geraet', 'maschine', 'werkzeug', 'sonstiges')),
  status text not null default 'verfuegbar'
    check (status in ('verfuegbar', 'werkstatt', 'defekt', 'reserviert', 'archiviert')),
  notes text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.planning_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid references public.jobsites(id) on delete set null,
  title text not null,
  resource_type text not null check (resource_type in ('employee', 'vehicle', 'equipment')),
  employee_id uuid references public.profiles(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  planning_resource_id uuid references public.planning_resources(id) on delete set null,
  start_date date not null,
  end_date date not null,
  status text not null default 'geplant'
    check (status in ('geplant', 'aktiv', 'erledigt', 'verschoben', 'krank', 'urlaub', 'werkstatt', 'defekt', 'weiterbildung')),
  color text not null default '#2E7D32',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (end_date >= start_date),
  check (
    (resource_type = 'employee' and employee_id is not null and vehicle_id is null and planning_resource_id is null)
    or (resource_type = 'vehicle' and vehicle_id is not null and employee_id is null and planning_resource_id is null)
    or (resource_type = 'equipment' and planning_resource_id is not null and employee_id is null and vehicle_id is null)
  )
);

create table if not exists public.planning_weather_checks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  planning_assignment_id uuid not null references public.planning_assignments(id) on delete cascade,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  risk_level text not null default 'green' check (risk_level in ('green', 'yellow', 'red')),
  summary text not null,
  rule_codes text[] not null default '{}',
  temperature_min_c numeric,
  temperature_max_c numeric,
  precipitation_mm numeric,
  precipitation_probability numeric,
  wind_kmh numeric,
  wind_gust_kmh numeric,
  weather_code integer,
  source text not null default 'Open-Meteo Forecast',
  fetched_at timestamptz not null default now(),
  acknowledged_action text check (acknowledged_action in ('confirmed', 'ignored')),
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  acknowledgment_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (planning_assignment_id),
  check (period_end >= period_start)
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
create index if not exists jobsites_weather_location_idx on public.jobsites(company_id, latitude, longitude);
create index if not exists weather_snapshots_company_jobsite_idx on public.weather_snapshots(company_id, jobsite_id, fetched_at desc);
create index if not exists orders_company_id_idx on public.orders(company_id);
create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists orders_jobsite_id_idx on public.orders(jobsite_id);
create index if not exists orders_status_idx on public.orders(company_id, status);
create index if not exists orders_assigned_employee_ids_idx on public.orders using gin(assigned_employee_ids);
create index if not exists job_dimensions_order_id_idx on public.job_dimensions(order_id);
create index if not exists reports_company_id_idx on public.reports(company_id);
create index if not exists reports_report_date_idx on public.reports(report_date desc);
create index if not exists reports_archived_idx on public.reports(company_id, archived_at, report_date desc);
create index if not exists reports_workflow_idx on public.reports(company_id, report_status, report_date desc) where archived_at is null;
create index if not exists reports_time_link_idx on public.reports(company_id, report_date desc) where cardinality(linked_time_entry_ids) > 0 and archived_at is null;
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
create index if not exists job_material_calculations_ai_idx on public.job_material_calculations(company_id, ai_enabled, created_at desc);
create index if not exists job_material_calculation_items_calculation_id_idx on public.job_material_calculation_items(calculation_id);
create index if not exists job_material_calculation_items_jobsite_id_idx on public.job_material_calculation_items(jobsite_id);
create index if not exists job_material_requirements_company_id_idx on public.job_material_requirements(company_id);
create index if not exists job_material_requirements_order_id_idx on public.job_material_requirements(order_id);
create index if not exists job_material_requirements_jobsite_id_idx on public.job_material_requirements(jobsite_id);
create index if not exists vehicles_company_id_idx on public.vehicles(company_id);
create index if not exists planning_resources_company_idx
  on public.planning_resources(company_id, resource_kind, active, archived_at, name);
create index if not exists planning_assignments_company_period_idx
  on public.planning_assignments(company_id, start_date, end_date, archived_at);
create index if not exists planning_assignments_employee_idx
  on public.planning_assignments(company_id, employee_id, start_date, end_date)
  where archived_at is null and employee_id is not null;
create index if not exists planning_assignments_vehicle_idx
  on public.planning_assignments(company_id, vehicle_id, start_date, end_date)
  where archived_at is null and vehicle_id is not null;
create index if not exists planning_assignments_resource_idx
  on public.planning_assignments(company_id, planning_resource_id, start_date, end_date)
  where archived_at is null and planning_resource_id is not null;
create index if not exists planning_assignments_jobsite_idx
  on public.planning_assignments(company_id, jobsite_id, start_date, end_date)
  where archived_at is null and jobsite_id is not null;
create index if not exists planning_weather_checks_company_risk_idx
  on public.planning_weather_checks(company_id, risk_level, fetched_at desc);
create index if not exists planning_weather_checks_jobsite_period_idx
  on public.planning_weather_checks(company_id, jobsite_id, period_start, period_end);
create index if not exists planning_weather_checks_ack_idx
  on public.planning_weather_checks(company_id, acknowledged_action, acknowledged_at);
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

drop trigger if exists set_planning_resources_updated_at on public.planning_resources;
create trigger set_planning_resources_updated_at
before update on public.planning_resources
for each row execute function public.set_updated_at();

drop trigger if exists set_planning_assignments_updated_at on public.planning_assignments;
create trigger set_planning_assignments_updated_at
before update on public.planning_assignments
for each row execute function public.set_updated_at();

drop trigger if exists set_planning_weather_checks_updated_at on public.planning_weather_checks;
create trigger set_planning_weather_checks_updated_at
before update on public.planning_weather_checks
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
  select coalesce(public.current_role() = 'chef', false)
$$;

create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = 'admin', false)
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
  requested_role := coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'chef');

  if requested_role not in ('admin', 'chef', 'vorarbeiter', 'mitarbeiter', 'kunde') then
    requested_role := 'mitarbeiter';
  end if;

  if target_company_id is null then
    insert into public.companies (name, created_by)
    values (coalesce(nullif(new.raw_user_meta_data->>'company_name', ''), 'Meine Firma'), new.id)
    returning id into target_company_id;

    requested_role := 'chef';
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
alter table public.weather_snapshots enable row level security;
alter table public.weather_snapshots force row level security;
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
alter table public.planning_resources enable row level security;
alter table public.planning_assignments enable row level security;
alter table public.planning_weather_checks enable row level security;
alter table public.planning_resources force row level security;
alter table public.planning_assignments force row level security;
alter table public.planning_weather_checks force row level security;
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

drop policy if exists "managers can read weather snapshots" on public.weather_snapshots;
create policy "managers can read weather snapshots"
on public.weather_snapshots for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can insert weather snapshots" on public.weather_snapshots;
create policy "managers can insert weather snapshots"
on public.weather_snapshots for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can update weather snapshots" on public.weather_snapshots;
create policy "managers can update weather snapshots"
on public.weather_snapshots for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers can delete weather snapshots" on public.weather_snapshots;
create policy "managers can delete weather snapshots"
on public.weather_snapshots for delete
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
  and archived_at is null
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
  and archived_at is null
  and (
    public.can_manage_company()
    or (
      created_by = auth.uid()
      and report_status in ('draft', 'submitted')
    )
  )
)
with check (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or (
      created_by = auth.uid()
      and report_status in ('draft', 'submitted')
    )
  )
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
        and r.archived_at is null
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
  item.updated_at,
  item.missing_quantity,
  item.source,
  item.ai_reason
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
  item.updated_at,
  item.archived_at
from public.job_material_requirements item
join public.orders o on o.id = item.order_id
where item.company_id = public.current_company_id()
  and item.archived_at is null
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

drop policy if exists "members read planning resources" on public.planning_resources;
create policy "members read planning resources"
on public.planning_resources for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and (
    public.can_manage_company()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = public.current_company_id()
        and p.role in ('vorarbeiter', 'mitarbeiter')
        and p.active
    )
  )
);

drop policy if exists "managers write planning resources" on public.planning_resources;
drop policy if exists "managers insert planning resources" on public.planning_resources;
create policy "managers insert planning resources"
on public.planning_resources for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update planning resources" on public.planning_resources;
create policy "managers update planning resources"
on public.planning_resources for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "members read planning assignments" on public.planning_assignments;
create policy "members read planning assignments"
on public.planning_assignments for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and (
    public.can_manage_company()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = public.current_company_id()
        and p.role = 'vorarbeiter'
        and p.active
    )
    or (resource_type = 'employee' and employee_id = auth.uid())
  )
);

drop policy if exists "managers write planning assignments" on public.planning_assignments;
drop policy if exists "managers insert planning assignments" on public.planning_assignments;
create policy "managers insert planning assignments"
on public.planning_assignments for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update planning assignments" on public.planning_assignments;
create policy "managers update planning assignments"
on public.planning_assignments for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "read relevant planning weather checks" on public.planning_weather_checks;
create policy "read relevant planning weather checks"
on public.planning_weather_checks for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = public.current_company_id()
        and p.role = 'vorarbeiter'
        and p.active
    )
    or exists (
      select 1
      from public.planning_assignments pa
      where pa.id = planning_assignment_id
        and pa.company_id = public.current_company_id()
        and pa.resource_type = 'employee'
        and pa.employee_id = auth.uid()
        and pa.archived_at is null
    )
  )
);

drop policy if exists "managers insert planning weather checks" on public.planning_weather_checks;
create policy "managers insert planning weather checks"
on public.planning_weather_checks for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update planning weather checks" on public.planning_weather_checks;
create policy "managers update planning weather checks"
on public.planning_weather_checks for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "read relevant tasks" on public.tasks;
create policy "read relevant tasks"
on public.tasks for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
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
  and archived_at is null
  and (public.can_manage_company() or assigned_to = auth.uid())
)
with check (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or (assigned_to = auth.uid() and archived_at is null)
  )
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
  and (storage.foldername(name))[2] = 'reports'
  and exists (
    select 1
    from public.report_photos rp
    join public.reports r on r.id = rp.report_id
    where rp.company_id = public.current_company_id()
      and rp.storage_path = storage.objects.name
      and rp.archived_at is null
      and r.company_id = public.current_company_id()
      and r.archived_at is null
      and r.id::text = (storage.foldername(name))[3]
      and (
        public.can_manage_company()
        or rp.created_by = auth.uid()
        or r.created_by = auth.uid()
        or auth.uid() = any(r.employee_ids)
      )
  )
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

-- Final hard-delete deny-list for checklist business data.
drop policy if exists "redteam managers delete fallback" on public.checklist_templates;
drop policy if exists "redteam managers delete fallback" on public.checklist_template_items;
drop policy if exists "redteam managers delete fallback" on public.jobsite_checklists;
drop policy if exists "redteam managers delete fallback" on public.jobsite_checklist_items;
drop policy if exists "redteam managers delete fallback" on public.checklist_item_photos;

select pg_notify('pgrst', 'reload schema');

-- Geraete- und Fahrzeugverwaltung: aktueller Zielzustand fuer frische Setups.

alter table public.vehicles add column if not exists status text not null default 'verfuegbar';
alter table public.vehicles add column if not exists inspection_due_date date;
alter table public.vehicles add column if not exists maintenance_interval_days integer;
alter table public.vehicles add column if not exists last_maintenance_at date;
alter table public.vehicles add column if not exists next_maintenance_at date;
alter table public.vehicles add column if not exists location_text text;
alter table public.vehicles add column if not exists responsible_employee_id uuid;
alter table public.vehicles add column if not exists qr_code text;
alter table public.vehicles add column if not exists nfc_tag_id text;
alter table public.vehicles add column if not exists archived_at timestamptz;

alter table public.vehicles drop constraint if exists vehicles_status_check;
alter table public.vehicles add constraint vehicles_status_check
  check (status in ('verfuegbar', 'auf_baustelle', 'im_fahrzeug', 'defekt', 'werkstatt', 'reserviert', 'archiviert'));

alter table public.vehicles drop constraint if exists vehicles_maintenance_interval_days_check;
alter table public.vehicles add constraint vehicles_maintenance_interval_days_check
  check (maintenance_interval_days is null or (maintenance_interval_days > 0 and maintenance_interval_days <= 3650));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vehicles_responsible_employee_id_fkey'
  ) then
    alter table public.vehicles
      add constraint vehicles_responsible_employee_id_fkey
      foreign key (responsible_employee_id) references public.profiles(id) on delete set null;
  end if;
end $$;

alter table public.planning_resources add column if not exists inspection_due_date date;
alter table public.planning_resources add column if not exists maintenance_interval_days integer;
alter table public.planning_resources add column if not exists last_maintenance_at date;
alter table public.planning_resources add column if not exists next_maintenance_at date;
alter table public.planning_resources add column if not exists location_text text;
alter table public.planning_resources add column if not exists responsible_employee_id uuid;
alter table public.planning_resources add column if not exists vehicle_id uuid;
alter table public.planning_resources add column if not exists qr_code text;
alter table public.planning_resources add column if not exists nfc_tag_id text;

alter table public.planning_resources drop constraint if exists planning_resources_resource_kind_check;
alter table public.planning_resources add constraint planning_resources_resource_kind_check
  check (resource_kind in ('fahrzeug', 'anhaenger', 'maschine', 'werkzeug', 'geruest_leiter', 'geraet', 'sonstiges'));

alter table public.planning_resources drop constraint if exists planning_resources_status_check;
alter table public.planning_resources add constraint planning_resources_status_check
  check (status in ('verfuegbar', 'auf_baustelle', 'im_fahrzeug', 'defekt', 'werkstatt', 'reserviert', 'archiviert'));

alter table public.planning_resources drop constraint if exists planning_resources_maintenance_interval_days_check;
alter table public.planning_resources add constraint planning_resources_maintenance_interval_days_check
  check (maintenance_interval_days is null or (maintenance_interval_days > 0 and maintenance_interval_days <= 3650));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'planning_resources_responsible_employee_id_fkey'
  ) then
    alter table public.planning_resources
      add constraint planning_resources_responsible_employee_id_fkey
      foreign key (responsible_employee_id) references public.profiles(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'planning_resources_vehicle_id_fkey'
  ) then
    alter table public.planning_resources
      add constraint planning_resources_vehicle_id_fkey
      foreign key (vehicle_id) references public.vehicles(id) on delete set null;
  end if;
end $$;

create table if not exists public.resource_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  planning_resource_id uuid references public.planning_resources(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  document_type text not null default 'dokument'
    check (document_type in ('foto', 'dokument', 'pruefung', 'wartung', 'sonstiges')),
  title text not null,
  storage_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (
    (planning_resource_id is not null and vehicle_id is null)
    or (planning_resource_id is null and vehicle_id is not null)
  )
);

create index if not exists vehicles_resource_status_idx
  on public.vehicles(company_id, status, archived_at, name);
create index if not exists vehicles_responsible_idx
  on public.vehicles(company_id, responsible_employee_id)
  where responsible_employee_id is not null and archived_at is null;
create unique index if not exists vehicles_company_qr_code_key
  on public.vehicles(company_id, qr_code)
  where qr_code is not null and archived_at is null;
create unique index if not exists vehicles_company_nfc_tag_id_key
  on public.vehicles(company_id, nfc_tag_id)
  where nfc_tag_id is not null and archived_at is null;
create index if not exists planning_resources_responsible_idx
  on public.planning_resources(company_id, responsible_employee_id)
  where responsible_employee_id is not null and archived_at is null;
create index if not exists planning_resources_vehicle_idx
  on public.planning_resources(company_id, vehicle_id)
  where vehicle_id is not null and archived_at is null;
create unique index if not exists planning_resources_company_qr_code_key
  on public.planning_resources(company_id, qr_code)
  where qr_code is not null and archived_at is null;
create unique index if not exists planning_resources_company_nfc_tag_id_key
  on public.planning_resources(company_id, nfc_tag_id)
  where nfc_tag_id is not null and archived_at is null;
create index if not exists resource_documents_resource_idx
  on public.resource_documents(company_id, planning_resource_id, archived_at, created_at desc);
create index if not exists resource_documents_vehicle_idx
  on public.resource_documents(company_id, vehicle_id, archived_at, created_at desc);

alter table public.vehicles enable row level security;
alter table public.planning_resources enable row level security;
alter table public.resource_documents enable row level security;
alter table public.vehicles force row level security;
alter table public.planning_resources force row level security;
alter table public.resource_documents force row level security;

drop policy if exists "members read resource documents" on public.resource_documents;
create policy "members read resource documents"
on public.resource_documents for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
);

drop policy if exists "managers insert resource documents" on public.resource_documents;
create policy "managers insert resource documents"
on public.resource_documents for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update resource documents" on public.resource_documents;
create policy "managers update resource documents"
on public.resource_documents for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

create or replace function public.validate_resource_document_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.planning_resource_id is not null and not exists (
    select 1
    from public.planning_resources pr
    where pr.id = new.planning_resource_id
      and pr.company_id = new.company_id
      and pr.archived_at is null
  ) then
    raise exception 'planning_resource_not_found';
  end if;

  if new.vehicle_id is not null and not exists (
    select 1
    from public.vehicles v
    where v.id = new.vehicle_id
      and v.company_id = new.company_id
      and v.archived_at is null
  ) then
    raise exception 'vehicle_not_found';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_resource_document_tenant on public.resource_documents;
create trigger validate_resource_document_tenant
before insert or update on public.resource_documents
for each row execute function public.validate_resource_document_tenant();

drop trigger if exists set_resource_documents_updated_at on public.resource_documents;
create trigger set_resource_documents_updated_at
before update on public.resource_documents
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('resource-documents', 'resource-documents', false)
on conflict (id) do nothing;

drop policy if exists "members read resource documents storage" on storage.objects;
create policy "members read resource documents storage"
on storage.objects for select
to authenticated
using (
  bucket_id = 'resource-documents'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (
    (
      (storage.foldername(name))[2] = 'resources'
      and exists (
        select 1
        from public.planning_resources pr
        where pr.id::text = (storage.foldername(name))[3]
          and pr.company_id = public.current_company_id()
          and pr.archived_at is null
      )
    )
    or (
      (storage.foldername(name))[2] = 'vehicles'
      and exists (
        select 1
        from public.vehicles v
        where v.id::text = (storage.foldername(name))[3]
          and v.company_id = public.current_company_id()
          and v.archived_at is null
      )
    )
  )
);

drop policy if exists "managers upload resource documents storage" on storage.objects;
create policy "managers upload resource documents storage"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'resource-documents'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and public.can_manage_company()
);

drop policy if exists "managers delete resource documents storage" on storage.objects;
create policy "managers delete resource documents storage"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'resource-documents'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and public.can_manage_company()
);

select pg_notify('pgrst', 'reload schema');

-- Zentrale Baustellenakte: Dokumente, Signatur-Metadaten und Verlauf.
-- Denselben Stand liefert auch supabase/migrations/20260624_jobsite_file_documents.sql.

create table if not exists public.jobsite_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  category text not null default 'sonstiges' check (
    category in (
      'angebot',
      'rechnung',
      'lieferschein',
      'aufmass',
      'abnahmeprotokoll',
      'regiebericht',
      'sicherheitsunterweisung',
      'sonstiges'
    )
  ),
  title text not null,
  storage_path text not null unique,
  file_name text not null,
  content_type text,
  size_bytes integer,
  visible_to_customer boolean not null default false,
  uploaded_by uuid references public.profiles(id) on delete set null,
  signed_by uuid references public.profiles(id) on delete set null,
  signed_at timestamptz,
  signature_name text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobsite_activity_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  event_type text not null default 'note' check (
    event_type in ('note', 'document', 'photo', 'task', 'time', 'material', 'report', 'order', 'weather', 'signature')
  ),
  title text not null,
  body text,
  visibility text not null default 'internal' check (visibility in ('internal', 'customer')),
  actor_id uuid references public.profiles(id) on delete set null,
  source_table text,
  source_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists jobsite_documents_jobsite_idx
  on public.jobsite_documents(company_id, jobsite_id, archived_at, created_at desc);
create index if not exists jobsite_documents_category_idx
  on public.jobsite_documents(company_id, jobsite_id, category, created_at desc);
create index if not exists jobsite_activity_events_jobsite_idx
  on public.jobsite_activity_events(company_id, jobsite_id, archived_at, created_at desc);

insert into storage.buckets (id, name, public)
values ('jobsite-documents', 'jobsite-documents', false)
on conflict (id) do nothing;

alter table public.jobsite_documents enable row level security;
alter table public.jobsite_activity_events enable row level security;
alter table public.jobsite_documents force row level security;
alter table public.jobsite_activity_events force row level security;

drop policy if exists "members read assigned jobsite documents" on public.jobsite_documents;
create policy "members read assigned jobsite documents"
on public.jobsite_documents for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and exists (
    select 1
    from public.jobsites j
    where j.id = jobsite_id
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "managers and foremen insert jobsite documents" on public.jobsite_documents;
create policy "managers and foremen insert jobsite documents"
on public.jobsite_documents for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and exists (
    select 1
    from public.jobsites j
    where j.id = jobsite_id
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or (public.current_role() = 'vorarbeiter' and auth.uid() = any(j.assigned_employee_ids))
      )
  )
);

drop policy if exists "managers update jobsite documents" on public.jobsite_documents;
create policy "managers update jobsite documents"
on public.jobsite_documents for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "members read assigned jobsite activity" on public.jobsite_activity_events;
create policy "members read assigned jobsite activity"
on public.jobsite_activity_events for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and exists (
    select 1
    from public.jobsites j
    where j.id = jobsite_id
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "members insert assigned jobsite activity" on public.jobsite_activity_events;
create policy "members insert assigned jobsite activity"
on public.jobsite_activity_events for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and exists (
    select 1
    from public.jobsites j
    where j.id = jobsite_id
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "managers archive jobsite activity" on public.jobsite_activity_events;
create policy "managers archive jobsite activity"
on public.jobsite_activity_events for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "members read assigned jobsite documents storage" on storage.objects;
create policy "members read assigned jobsite documents storage"
on storage.objects for select
to authenticated
using (
  bucket_id = 'jobsite-documents'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'jobsites'
  and exists (
    select 1
    from public.jobsites j
    where j.id::text = (storage.foldername(name))[3]
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "managers and foremen upload jobsite documents storage" on storage.objects;
create policy "managers and foremen upload jobsite documents storage"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'jobsite-documents'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'jobsites'
  and exists (
    select 1
    from public.jobsites j
    where j.id::text = (storage.foldername(name))[3]
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or (public.current_role() = 'vorarbeiter' and auth.uid() = any(j.assigned_employee_ids))
      )
  )
);

drop policy if exists "managers delete jobsite documents storage" on storage.objects;
create policy "managers delete jobsite documents storage"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'jobsite-documents'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and public.can_manage_company()
);

drop trigger if exists set_jobsite_documents_updated_at on public.jobsite_documents;
create trigger set_jobsite_documents_updated_at
before update on public.jobsite_documents
for each row execute function public.set_updated_at();

drop policy if exists "redteam managers delete fallback" on public.jobsite_documents;
drop policy if exists "redteam managers delete fallback" on public.jobsite_activity_events;

select pg_notify('pgrst', 'reload schema');

-- Digitale Unterschriften fuer Arbeitsauftraege, Tagesberichte, Abnahmen und Dokumente.
-- Safe to run multiple times.

alter table public.reports add column if not exists signature_status text not null default 'draft'
  check (signature_status in ('draft', 'signed', 'rejected'));
alter table public.reports add column if not exists signature_data_url text;
alter table public.reports add column if not exists signature_signed_at timestamptz;
alter table public.reports add column if not exists signature_role text
  check (signature_role in ('kunde', 'mitarbeiter', 'vorarbeiter', 'chef', 'admin'));
alter table public.reports add column if not exists signature_content_hash text;
alter table public.reports add column if not exists source_report_id uuid references public.reports(id) on delete set null;
alter table public.reports add column if not exists document_version integer not null default 1 check (document_version > 0);
alter table public.reports add column if not exists report_status text not null default 'draft'
  check (report_status in ('draft', 'submitted', 'reviewed', 'approved'));
alter table public.reports add column if not exists submitted_at timestamptz;
alter table public.reports add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.reports add column if not exists reviewed_at timestamptz;
alter table public.reports add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.reports add column if not exists approved_at timestamptz;
alter table public.reports add column if not exists machine_usage text;
alter table public.reports add column if not exists vehicle_ids uuid[] not null default '{}';
alter table public.reports add column if not exists linked_time_entry_ids uuid[] not null default '{}';

alter table public.work_orders add column if not exists signature_role text
  check (signature_role in ('kunde', 'mitarbeiter', 'vorarbeiter', 'chef', 'admin'));

alter table public.jobsite_documents add column if not exists signature_data_url text;
alter table public.jobsite_documents add column if not exists signature_role text
  check (signature_role in ('kunde', 'mitarbeiter', 'vorarbeiter', 'chef', 'admin'));
alter table public.jobsite_documents add column if not exists signature_content_hash text;

create table if not exists public.digital_document_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_type text not null check (document_type in ('work_order', 'report', 'commercial_document', 'jobsite_document', 'acceptance')),
  document_id uuid not null,
  version integer not null default 1 check (version > 0),
  snapshot jsonb not null,
  content_hash text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (company_id, document_type, document_id, version)
);

create table if not exists public.digital_signatures (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_type text not null check (document_type in ('work_order', 'report', 'commercial_document', 'jobsite_document', 'acceptance')),
  document_id uuid not null,
  document_version integer not null default 1 check (document_version > 0),
  jobsite_id uuid references public.jobsites(id) on delete set null,
  status text not null default 'signed' check (status in ('draft', 'signed', 'rejected')),
  signer_name text not null,
  signer_role text not null check (signer_role in ('kunde', 'mitarbeiter', 'vorarbeiter', 'chef', 'admin')),
  signer_user_id uuid references public.profiles(id) on delete set null,
  signer_ip text,
  signer_user_agent text,
  signature_data_url text,
  signed_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  content_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists reports_signature_status_idx
  on public.reports(company_id, signature_status, signature_signed_at desc);
create index if not exists reports_revision_idx
  on public.reports(company_id, source_report_id, document_version desc);
create index if not exists reports_workflow_idx
  on public.reports(company_id, report_status, report_date desc)
  where archived_at is null;
create index if not exists reports_time_link_idx
  on public.reports(company_id, report_date desc)
  where cardinality(linked_time_entry_ids) > 0 and archived_at is null;
create index if not exists digital_signatures_document_idx
  on public.digital_signatures(company_id, document_type, document_id, document_version);
create index if not exists digital_signatures_jobsite_idx
  on public.digital_signatures(company_id, jobsite_id, created_at desc);
create index if not exists digital_document_versions_document_idx
  on public.digital_document_versions(company_id, document_type, document_id, version desc);

alter table public.digital_signatures enable row level security;
alter table public.digital_document_versions enable row level security;
alter table public.digital_signatures force row level security;
alter table public.digital_document_versions force row level security;

drop policy if exists "members read permitted digital signatures" on public.digital_signatures;
create policy "members read permitted digital signatures"
on public.digital_signatures for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or signer_user_id = auth.uid()
    or exists (
      select 1 from public.reports r
      where document_type = 'report'
        and r.id = document_id
        and r.company_id = public.current_company_id()
        and (r.created_by = auth.uid() or auth.uid() = any(r.employee_ids))
    )
    or exists (
      select 1 from public.jobsites j
      where jobsite_id = j.id
        and j.company_id = public.current_company_id()
        and auth.uid() = any(j.assigned_employee_ids)
    )
  )
);

drop policy if exists "members insert own digital signatures" on public.digital_signatures;
create policy "members insert own digital signatures"
on public.digital_signatures for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and signer_user_id = auth.uid()
  and signer_role = public.current_role()
);

drop policy if exists "managers read digital document versions" on public.digital_document_versions;
create policy "managers read digital document versions"
on public.digital_document_versions for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or created_by = auth.uid()
  )
);

drop policy if exists "members insert digital document versions" on public.digital_document_versions;
create policy "members insert digital document versions"
on public.digital_document_versions for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and (public.can_manage_company() or created_by = auth.uid())
);

create or replace function public.prevent_signed_report_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.signature_status in ('signed', 'rejected') or old.report_status = 'approved' then
    if new.company_id is distinct from old.company_id
      or new.jobsite_id is distinct from old.jobsite_id
      or new.report_date is distinct from old.report_date
      or new.weather is distinct from old.weather
      or new.weather_summary is distinct from old.weather_summary
      or new.weather_temperature_c is distinct from old.weather_temperature_c
      or new.weather_precipitation_mm is distinct from old.weather_precipitation_mm
      or new.weather_wind_kmh is distinct from old.weather_wind_kmh
      or new.weather_source is distinct from old.weather_source
      or new.weather_fetched_at is distinct from old.weather_fetched_at
      or new.weather_lat is distinct from old.weather_lat
      or new.weather_lng is distinct from old.weather_lng
      or new.work_start is distinct from old.work_start
      or new.work_end is distinct from old.work_end
      or new.employee_ids is distinct from old.employee_ids
      or new.activities is distinct from old.activities
      or new.material_usage is distinct from old.material_usage
      or new.machine_usage is distinct from old.machine_usage
      or new.vehicle_ids is distinct from old.vehicle_ids
      or new.linked_time_entry_ids is distinct from old.linked_time_entry_ids
      or new.issues is distinct from old.issues
      or new.signature_name is distinct from old.signature_name
      or new.source_report_id is distinct from old.source_report_id
      or new.document_version is distinct from old.document_version
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      -- Signierte Tagesberichte koennen nicht geaendert werden; freigegebene Berichte sind ebenfalls gesperrt.
      raise exception 'Freigegebene oder signierte Bautagesberichte koennen nicht geaendert werden. Bitte neue Version erzeugen.';
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_signed_report_mutation on public.reports;
create trigger prevent_signed_report_mutation
before update on public.reports
for each row execute function public.prevent_signed_report_mutation();

drop policy if exists "redteam managers delete fallback" on public.digital_signatures;
drop policy if exists "redteam managers delete fallback" on public.digital_document_versions;

select pg_notify('pgrst', 'reload schema');


-- Soft-delete hardening for business-critical records.

alter table public.time_entries add column if not exists archived_at timestamptz;
alter table public.report_photos add column if not exists archived_at timestamptz;
alter table public.job_dimensions add column if not exists archived_at timestamptz;
alter table public.job_material_requirements add column if not exists archived_at timestamptz;
alter table public.vehicle_materials add column if not exists archived_at timestamptz;

create index if not exists time_entries_archived_idx on public.time_entries(company_id, archived_at, date desc);
create index if not exists report_photos_archived_idx on public.report_photos(company_id, archived_at, report_id, created_at desc);
create index if not exists job_dimensions_archived_idx on public.job_dimensions(company_id, archived_at, order_id);
create index if not exists job_material_requirements_archived_idx on public.job_material_requirements(company_id, archived_at, order_id);
create index if not exists vehicle_materials_archived_idx on public.vehicle_materials(company_id, archived_at, vehicle_id);

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
  item.updated_at,
  item.archived_at
from public.job_material_requirements item
join public.orders o on o.id = item.order_id
where item.company_id = public.current_company_id()
  and item.archived_at is null
  and (
    public.can_manage_company()
    or auth.uid() = any(o.assigned_employee_ids)
  );

grant select on public.job_material_requirements_public to authenticated;

create or replace function public.archive_report_photo(p_photo_id uuid, p_report_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  archived_id uuid;
begin
  update public.report_photos
  set archived_at = now()
  where id = p_photo_id
    and report_id = p_report_id
    and company_id = public.current_company_id()
    and archived_at is null
    and (public.can_manage_company() or created_by = auth.uid())
  returning id into archived_id;

  if archived_id is null then
    raise exception 'not_authorized';
  end if;

  return archived_id;
end;
$$;

grant execute on function public.archive_report_photo(uuid, uuid) to authenticated;

drop policy if exists "managers can delete customers" on public.customers;
drop policy if exists "managers can delete jobsites" on public.jobsites;
drop policy if exists "managers can delete orders" on public.orders;
drop policy if exists "managers can delete commercial documents" on public.commercial_documents;
drop policy if exists "managers can delete job dimensions" on public.job_dimensions;
drop policy if exists "delete relevant reports" on public.reports;
drop policy if exists "delete report photos" on public.report_photos;
drop policy if exists "managers can delete time entries" on public.time_entries;
drop policy if exists "managers can delete materials" on public.materials;
drop policy if exists "managers can delete inventory items" on public.inventory_items;
drop policy if exists "managers can delete vehicles" on public.vehicles;
drop policy if exists "managers can delete vehicle materials" on public.vehicle_materials;
drop policy if exists "managers can delete resource documents" on public.resource_documents;
drop policy if exists "managers can delete tasks" on public.tasks;
drop policy if exists "managers can delete order requirements" on public.job_material_requirements;
drop policy if exists "redteam managers delete fallback" on public.digital_signatures;
drop policy if exists "redteam managers delete fallback" on public.digital_document_versions;
drop policy if exists "redteam managers delete fallback" on public.jobsite_documents;
drop policy if exists "redteam managers delete fallback" on public.jobsite_activity_events;

drop policy if exists "redteam managers delete fallback" on public.customers;
drop policy if exists "redteam managers delete fallback" on public.jobsites;
drop policy if exists "redteam managers delete fallback" on public.orders;
drop policy if exists "redteam managers delete fallback" on public.commercial_documents;
drop policy if exists "redteam managers delete fallback" on public.job_dimensions;
drop policy if exists "redteam managers delete fallback" on public.reports;
drop policy if exists "redteam managers delete fallback" on public.report_photos;
drop policy if exists "redteam managers delete fallback" on public.time_entries;
drop policy if exists "redteam managers delete fallback" on public.materials;
drop policy if exists "redteam managers delete fallback" on public.inventory_items;
drop policy if exists "redteam managers delete fallback" on public.vehicles;
drop policy if exists "redteam managers delete fallback" on public.vehicle_materials;
drop policy if exists "redteam managers delete fallback" on public.resource_documents;
drop policy if exists "redteam managers delete fallback" on public.tasks;
drop policy if exists "redteam managers delete fallback" on public.job_material_requirements;
drop policy if exists "redteam managers delete fallback" on public.jobsite_documents;
drop policy if exists "redteam managers delete fallback" on public.jobsite_activity_events;

select pg_notify('pgrst', 'reload schema');

-- Position-based roof measurement / Aufmass for orders.

create table if not exists public.order_measurement_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  item_type text not null default 'roof_area' check (
    item_type in ('roof_area', 'deduction_area', 'eaves_length', 'ridge_length', 'verge_length', 'valley_length', 'wall_connection_length', 'downpipe_length', 'roof_window', 'penetration', 'roof_drain', 'emergency_overflow')
  ),
  label text not null,
  length_m numeric(12, 2),
  width_m numeric(12, 2),
  quantity numeric(12, 2) not null default 1,
  pitch_deg numeric(7, 2),
  calculated_area_m2 numeric(12, 2) not null default 0,
  calculated_length_m numeric(12, 2) not null default 0,
  count_value integer not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity >= 0),
  check (count_value >= 0)
);

create index if not exists order_measurement_items_order_idx
  on public.order_measurement_items(company_id, order_id, archived_at, created_at desc);

alter table public.order_measurement_items enable row level security;
alter table public.order_measurement_items force row level security;

drop policy if exists "managers read order measurement items" on public.order_measurement_items;
create policy "managers read order measurement items"
on public.order_measurement_items for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers insert order measurement items" on public.order_measurement_items;
create policy "managers insert order measurement items"
on public.order_measurement_items for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update order measurement items" on public.order_measurement_items;
create policy "managers update order measurement items"
on public.order_measurement_items for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop trigger if exists set_order_measurement_items_updated_at on public.order_measurement_items;
create trigger set_order_measurement_items_updated_at
before update on public.order_measurement_items
for each row execute function public.set_updated_at();

drop policy if exists "redteam managers delete fallback" on public.order_measurement_items;
drop policy if exists "managers can delete order measurement items" on public.order_measurement_items;

select pg_notify('pgrst', 'reload schema');

-- Commercial document core: Angebote/Rechnungen from orders and material requirements.

create table if not exists public.commercial_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  jobsite_id uuid references public.jobsites(id) on delete set null,
  document_type text not null check (document_type in ('quote', 'invoice')),
  document_number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'paid', 'cancelled')),
  subject text not null,
  customer_snapshot jsonb not null default '{}'::jsonb,
  issue_date date not null default current_date,
  due_date date,
  valid_until date,
  subtotal_net numeric(12, 2) not null default 0,
  tax_rate numeric(7, 2) not null default 19,
  tax_total numeric(12, 2) not null default 0,
  total_gross numeric(12, 2) not null default 0,
  notes text,
  payment_terms text,
  created_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz,
  accepted_at timestamptz,
  paid_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, document_number)
);

create table if not exists public.commercial_document_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid not null references public.commercial_documents(id) on delete cascade,
  source_requirement_id uuid references public.job_material_requirements(id) on delete set null,
  position integer not null default 1,
  title text not null,
  description text,
  quantity numeric(12, 2) not null default 1,
  unit text not null default 'Stueck',
  unit_price_net numeric(12, 2) not null default 0,
  discount_percent numeric(7, 2) not null default 0,
  line_total_net numeric(12, 2) generated always as (
    round(coalesce(quantity, 0) * coalesce(unit_price_net, 0) * (1 - coalesce(discount_percent, 0) / 100), 2)
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity >= 0),
  check (unit_price_net >= 0),
  check (discount_percent >= 0 and discount_percent <= 100)
);

create index if not exists commercial_documents_company_type_status_idx
  on public.commercial_documents(company_id, document_type, status, issue_date desc);
create index if not exists commercial_documents_order_idx
  on public.commercial_documents(company_id, order_id, created_at desc);
create index if not exists commercial_documents_archived_idx
  on public.commercial_documents(company_id, archived_at, created_at desc);
create index if not exists commercial_document_items_document_idx
  on public.commercial_document_items(document_id, position);

alter table public.commercial_documents enable row level security;
alter table public.commercial_document_items enable row level security;
alter table public.commercial_documents force row level security;
alter table public.commercial_document_items force row level security;

drop policy if exists "managers read commercial documents" on public.commercial_documents;
create policy "managers read commercial documents"
on public.commercial_documents for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers insert commercial documents" on public.commercial_documents;
create policy "managers insert commercial documents"
on public.commercial_documents for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update commercial documents" on public.commercial_documents;
create policy "managers update commercial documents"
on public.commercial_documents for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers read commercial document items" on public.commercial_document_items;
create policy "managers read commercial document items"
on public.commercial_document_items for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers insert commercial document items" on public.commercial_document_items;
create policy "managers insert commercial document items"
on public.commercial_document_items for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update commercial document items" on public.commercial_document_items;
create policy "managers update commercial document items"
on public.commercial_document_items for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers delete commercial document items" on public.commercial_document_items;
create policy "managers delete commercial document items"
on public.commercial_document_items for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop trigger if exists set_commercial_documents_updated_at on public.commercial_documents;
create trigger set_commercial_documents_updated_at
before update on public.commercial_documents
for each row execute function public.set_updated_at();

drop trigger if exists set_commercial_document_items_updated_at on public.commercial_document_items;
create trigger set_commercial_document_items_updated_at
before update on public.commercial_document_items
for each row execute function public.set_updated_at();

create or replace function public.recalculate_commercial_document_totals(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  subtotal numeric(12, 2);
  doc_tax_rate numeric(7, 2);
begin
  select coalesce(sum(line_total_net), 0)
  into subtotal
  from public.commercial_document_items
  where document_id = p_document_id;

  select tax_rate
  into doc_tax_rate
  from public.commercial_documents
  where id = p_document_id;

  update public.commercial_documents
  set
    subtotal_net = subtotal,
    tax_total = round(subtotal * coalesce(doc_tax_rate, 19) / 100, 2),
    total_gross = round(subtotal * (1 + coalesce(doc_tax_rate, 19) / 100), 2),
    updated_at = now()
  where id = p_document_id;
end;
$$;

create or replace function public.recalculate_commercial_document_totals_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_commercial_document_totals(coalesce(new.document_id, old.document_id));
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists recalculate_commercial_document_totals_on_items on public.commercial_document_items;
create trigger recalculate_commercial_document_totals_on_items
after insert or update or delete on public.commercial_document_items
for each row execute function public.recalculate_commercial_document_totals_trigger();

grant execute on function public.recalculate_commercial_document_totals(uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');

-- Help system and connected material intelligence.

alter table public.inventory_locations add column if not exists address text;
alter table public.inventory_locations add column if not exists vehicle_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_locations_vehicle_id_fkey'
      and conrelid = 'public.inventory_locations'::regclass
  ) then
    alter table public.inventory_locations
      add constraint inventory_locations_vehicle_id_fkey
      foreign key (vehicle_id) references public.vehicles(id) on delete set null;
  end if;
end $$;

do $$
declare
  constraint_name text;
begin
  select conname
  into constraint_name
  from pg_constraint
  where conrelid = 'public.inventory_locations'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%location_type%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.inventory_locations drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.inventory_locations
  add constraint inventory_locations_location_type_check
  check (location_type in ('Hauptlager', 'Fahrzeuglager', 'Baustelle', 'Container', 'Werkstatt', 'Lieferant/offen bestellt'));

create table if not exists public.user_help_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  feature_key text not null,
  first_seen_at timestamptz not null default now(),
  dismissed_at timestamptz,
  first_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, feature_key)
);

create table if not exists public.bring_list_availability_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bring_list_id uuid not null references public.bring_lists(id) on delete cascade,
  bring_list_item_id uuid references public.bring_list_items(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  required_quantity numeric(12, 2) not null default 0 check (required_quantity >= 0),
  available_quantity numeric(12, 2) not null default 0 check (available_quantity >= 0),
  reserved_quantity numeric(12, 2) not null default 0 check (reserved_quantity >= 0),
  missing_quantity numeric(12, 2) not null default 0 check (missing_quantity >= 0),
  risk_level text not null default 'green' check (risk_level in ('green', 'yellow', 'red', 'blue')),
  status_label text not null,
  source text not null default 'availability_check',
  created_at timestamptz not null default now()
);

create table if not exists public.material_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  from_location_id uuid references public.inventory_locations(id) on delete set null,
  to_location_id uuid references public.inventory_locations(id) on delete set null,
  jobsite_id uuid references public.jobsites(id) on delete set null,
  bring_list_id uuid references public.bring_lists(id) on delete set null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit text not null default 'Stueck',
  movement_type text not null check (movement_type in ('purchase', 'transfer', 'reserve', 'consume', 'return', 'correction')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  notes text
);

create index if not exists inventory_locations_vehicle_idx on public.inventory_locations(company_id, vehicle_id);
create index if not exists user_help_state_user_feature_idx on public.user_help_state(user_id, feature_key);
create index if not exists user_help_state_company_idx on public.user_help_state(company_id, user_id);
create index if not exists bring_list_availability_snapshots_list_idx on public.bring_list_availability_snapshots(company_id, bring_list_id, created_at desc);
create index if not exists bring_list_availability_snapshots_item_idx on public.bring_list_availability_snapshots(inventory_item_id, created_at desc);
create index if not exists material_movements_company_created_idx on public.material_movements(company_id, created_at desc);
create index if not exists material_movements_inventory_idx on public.material_movements(inventory_item_id, created_at desc);
create index if not exists material_movements_bring_list_idx on public.material_movements(bring_list_id, created_at desc);

drop trigger if exists set_user_help_state_updated_at on public.user_help_state;
create trigger set_user_help_state_updated_at
before update on public.user_help_state
for each row execute function public.set_updated_at();

alter table public.user_help_state enable row level security;
alter table public.user_help_state force row level security;
alter table public.bring_list_availability_snapshots enable row level security;
alter table public.bring_list_availability_snapshots force row level security;
alter table public.material_movements enable row level security;
alter table public.material_movements force row level security;

grant select, insert, update, delete on public.user_help_state to authenticated;
grant select, insert, update, delete on public.bring_list_availability_snapshots to authenticated;
grant select, insert, update on public.material_movements to authenticated;

drop policy if exists "users manage own help state" on public.user_help_state;
create policy "users manage own help state"
on public.user_help_state for all
to authenticated
using (company_id = public.current_company_id() and user_id = auth.uid())
with check (company_id = public.current_company_id() and user_id = auth.uid());

drop policy if exists "read relevant availability snapshots" on public.bring_list_availability_snapshots;
create policy "read relevant availability snapshots"
on public.bring_list_availability_snapshots for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or exists (
      select 1
      from public.bring_lists bl
      where bl.id = bring_list_id
        and bl.company_id = public.current_company_id()
        and (
          bl.assigned_to = auth.uid()
          or bl.created_by = auth.uid()
          or exists (
            select 1 from public.jobsites j
            where j.id = bl.job_id
              and auth.uid() = any(j.assigned_employee_ids)
          )
        )
    )
  )
);

drop policy if exists "create relevant availability snapshots" on public.bring_list_availability_snapshots;
create policy "create relevant availability snapshots"
on public.bring_list_availability_snapshots for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and exists (
    select 1
    from public.bring_lists bl
    where bl.id = bring_list_id
      and bl.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or bl.assigned_to = auth.uid()
        or bl.created_by = auth.uid()
      )
  )
);

drop policy if exists "managers maintain availability snapshots" on public.bring_list_availability_snapshots;
create policy "managers maintain availability snapshots"
on public.bring_list_availability_snapshots for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers delete availability snapshots" on public.bring_list_availability_snapshots;
create policy "managers delete availability snapshots"
on public.bring_list_availability_snapshots for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers read material movements" on public.material_movements;
create policy "managers read material movements"
on public.material_movements for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers create material movements" on public.material_movements;
create policy "managers create material movements"
on public.material_movements for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update material movements" on public.material_movements;
create policy "managers update material movements"
on public.material_movements for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

create or replace function public.record_material_movement_from_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  movement_inventory_item_id uuid;
  movement_from_location_id uuid;
  movement_to_location_id uuid;
  movement_quantity numeric;
  movement_unit text;
  movement_type text;
begin
  if new.action = 'material_reserved' then
    movement_inventory_item_id := nullif(new.new_values->>'inventory_item_id', '')::uuid;
    movement_quantity := coalesce(nullif(new.new_values->>'quantity_reserved', '')::numeric, 0);
    movement_type := 'reserve';
  elsif new.action = 'inventory_transferred' then
    movement_inventory_item_id := new.entity_id;
    movement_from_location_id := nullif(new.old_values->>'source_location_id', '')::uuid;
    movement_to_location_id := nullif(new.new_values->>'target_location_id', '')::uuid;
    movement_quantity := coalesce(nullif(new.new_values->>'amount', '')::numeric, 0);
    movement_type := 'transfer';
  elsif new.action = 'inventory_stock_adjusted' then
    movement_inventory_item_id := new.entity_id;
    movement_quantity := coalesce(nullif(new.new_values->>'amount', '')::numeric, 0);
    movement_type := 'correction';
  else
    return new;
  end if;

  if movement_inventory_item_id is null or movement_quantity <= 0 then
    return new;
  end if;

  select unit
  into movement_unit
  from public.inventory_items
  where id = movement_inventory_item_id
    and company_id = new.company_id;

  insert into public.material_movements (
    company_id,
    inventory_item_id,
    from_location_id,
    to_location_id,
    quantity,
    unit,
    movement_type,
    created_by,
    notes
  )
  values (
    new.company_id,
    movement_inventory_item_id,
    movement_from_location_id,
    movement_to_location_id,
    movement_quantity,
    coalesce(movement_unit, 'Stueck'),
    movement_type,
    new.actor_id,
    new.action
  );

  return new;
end;
$$;

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

drop trigger if exists record_material_movement_from_audit on public.company_audit_log;
create trigger record_material_movement_from_audit
after insert on public.company_audit_log
for each row execute function public.record_material_movement_from_audit();

create or replace function public.consume_inventory_item(
  p_company_id uuid,
  p_item_id uuid,
  p_quantity numeric,
  p_jobsite_id uuid,
  p_bring_list_id uuid,
  p_actor_id uuid,
  p_notes text
)
returns numeric
language plpgsql
set search_path = public
as $$
declare
  current_item public.inventory_items%rowtype;
  next_stock numeric;
begin
  if p_company_id <> public.current_company_id() or not public.can_manage_company() then
    raise exception 'not_authorized';
  end if;

  if p_actor_id is distinct from auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  if p_jobsite_id is not null and not exists (
    select 1 from public.jobsites
    where id = p_jobsite_id
      and company_id = p_company_id
  ) then
    raise exception 'jobsite_not_found';
  end if;

  if p_bring_list_id is not null and not exists (
    select 1 from public.bring_lists
    where id = p_bring_list_id
      and company_id = p_company_id
  ) then
    raise exception 'bring_list_not_found';
  end if;

  select *
  into current_item
  from public.inventory_items
  where id = p_item_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'inventory_item_not_found';
  end if;

  if current_item.stock < p_quantity then
    raise exception 'negative_stock_not_allowed';
  end if;

  next_stock := current_item.stock - p_quantity;

  update public.inventory_items
  set stock = next_stock,
      updated_at = now()
  where id = p_item_id
    and company_id = p_company_id;

  insert into public.material_movements (
    company_id,
    inventory_item_id,
    from_location_id,
    jobsite_id,
    bring_list_id,
    quantity,
    unit,
    movement_type,
    created_by,
    notes
  )
  values (
    p_company_id,
    p_item_id,
    current_item.location_id,
    p_jobsite_id,
    p_bring_list_id,
    p_quantity,
    current_item.unit,
    'consume',
    p_actor_id,
    p_notes
  );

  insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
  values (
    p_company_id,
    p_actor_id,
    'inventory_item',
    p_item_id,
    'inventory_consumed',
    jsonb_build_object('stock', current_item.stock),
    jsonb_build_object('stock', next_stock, 'amount', p_quantity, 'jobsite_id', p_jobsite_id, 'bring_list_id', p_bring_list_id)
  );

  return next_stock;
end;
$$;

create or replace function public.return_inventory_item(
  p_company_id uuid,
  p_item_id uuid,
  p_quantity numeric,
  p_jobsite_id uuid,
  p_bring_list_id uuid,
  p_actor_id uuid,
  p_notes text
)
returns numeric
language plpgsql
set search_path = public
as $$
declare
  current_item public.inventory_items%rowtype;
  next_stock numeric;
begin
  if p_company_id <> public.current_company_id() or not public.can_manage_company() then
    raise exception 'not_authorized';
  end if;

  if p_actor_id is distinct from auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  if p_jobsite_id is not null and not exists (
    select 1 from public.jobsites
    where id = p_jobsite_id
      and company_id = p_company_id
  ) then
    raise exception 'jobsite_not_found';
  end if;

  if p_bring_list_id is not null and not exists (
    select 1 from public.bring_lists
    where id = p_bring_list_id
      and company_id = p_company_id
  ) then
    raise exception 'bring_list_not_found';
  end if;

  select *
  into current_item
  from public.inventory_items
  where id = p_item_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'inventory_item_not_found';
  end if;

  next_stock := current_item.stock + p_quantity;

  update public.inventory_items
  set stock = next_stock,
      updated_at = now()
  where id = p_item_id
    and company_id = p_company_id;

  insert into public.material_movements (
    company_id,
    inventory_item_id,
    to_location_id,
    jobsite_id,
    bring_list_id,
    quantity,
    unit,
    movement_type,
    created_by,
    notes
  )
  values (
    p_company_id,
    p_item_id,
    current_item.location_id,
    p_jobsite_id,
    p_bring_list_id,
    p_quantity,
    current_item.unit,
    'return',
    p_actor_id,
    p_notes
  );

  insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
  values (
    p_company_id,
    p_actor_id,
    'inventory_item',
    p_item_id,
    'inventory_returned',
    jsonb_build_object('stock', current_item.stock),
    jsonb_build_object('stock', next_stock, 'amount', p_quantity, 'jobsite_id', p_jobsite_id, 'bring_list_id', p_bring_list_id)
  );

  return next_stock;
end;
$$;

create or replace function public.receive_inventory_purchase(
  p_company_id uuid,
  p_item_id uuid,
  p_quantity numeric,
  p_actor_id uuid,
  p_notes text
)
returns numeric
language plpgsql
set search_path = public
as $$
declare
  current_item public.inventory_items%rowtype;
  next_stock numeric;
begin
  if p_company_id <> public.current_company_id() or not public.can_manage_company() then
    raise exception 'not_authorized';
  end if;

  if p_actor_id is distinct from auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  select *
  into current_item
  from public.inventory_items
  where id = p_item_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'inventory_item_not_found';
  end if;

  next_stock := current_item.stock + p_quantity;

  update public.inventory_items
  set stock = next_stock,
      updated_at = now()
  where id = p_item_id
    and company_id = p_company_id;

  insert into public.material_movements (
    company_id,
    inventory_item_id,
    to_location_id,
    quantity,
    unit,
    movement_type,
    created_by,
    notes
  )
  values (
    p_company_id,
    p_item_id,
    current_item.location_id,
    p_quantity,
    current_item.unit,
    'purchase',
    p_actor_id,
    p_notes
  );

  insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
  values (
    p_company_id,
    p_actor_id,
    'inventory_item',
    p_item_id,
    'inventory_purchase_received',
    jsonb_build_object('stock', current_item.stock),
    jsonb_build_object('stock', next_stock, 'amount', p_quantity)
  );

  return next_stock;
end;
$$;

grant execute on function public.consume_inventory_item(uuid, uuid, numeric, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.return_inventory_item(uuid, uuid, numeric, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.receive_inventory_purchase(uuid, uuid, numeric, uuid, text) to authenticated;

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
  default_travel_rate_per_km numeric(12, 2) not null default 0.75,
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

create table if not exists public.stripe_webhook_events (
  id text primary key,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
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
create index if not exists companies_plan_idx on public.companies(plan_id);
create unique index if not exists companies_stripe_customer_idx on public.companies(stripe_customer_id) where stripe_customer_id is not null;
create unique index if not exists companies_stripe_subscription_idx on public.companies(stripe_subscription_id) where stripe_subscription_id is not null;
create index if not exists stripe_webhook_events_type_created_idx on public.stripe_webhook_events(event_type, created_at desc);

drop trigger if exists set_plans_updated_at on public.plans;
create trigger set_plans_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

drop trigger if exists set_ai_settings_updated_at on public.ai_settings;
create trigger set_ai_settings_updated_at
before update on public.ai_settings
for each row execute function public.set_updated_at();

alter table public.plans enable row level security;
alter table public.ai_settings enable row level security;
alter table public.ai_usage_logs enable row level security;
alter table public.ai_actions enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.stripe_webhook_events force row level security;

grant select on public.plans to anon, authenticated;
grant select, insert, update on public.ai_settings to authenticated;
grant select, insert on public.ai_usage_logs to authenticated;
grant select, insert, update on public.ai_actions to authenticated;
revoke all on public.stripe_webhook_events from anon, authenticated;

drop policy if exists "plans are publicly readable" on public.plans;
create policy "plans are publicly readable"
on public.plans for select
to anon, authenticated
using (true);

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
alter table public.companies add column if not exists session_timeout_minutes integer not null default 30;
alter table public.companies add column if not exists trade text not null default 'dachdecker';
alter table public.companies add column if not exists logo_path text;
alter table public.companies drop constraint if exists companies_session_timeout_minutes_check;
alter table public.companies add constraint companies_session_timeout_minutes_check check (session_timeout_minutes between 0 and 1440);

alter table public.customers add column if not exists archived_at timestamptz;
alter table public.jobsites add column if not exists archived_at timestamptz;
alter table public.orders add column if not exists archived_at timestamptz;
alter table public.materials add column if not exists archived_at timestamptz;
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

create index if not exists customers_archived_idx on public.customers(company_id, archived_at);
create index if not exists jobsites_archived_idx on public.jobsites(company_id, archived_at);
create index if not exists orders_archived_idx on public.orders(company_id, archived_at);
create index if not exists materials_archived_idx on public.materials(company_id, archived_at);
create index if not exists inventory_items_archived_idx on public.inventory_items(company_id, archived_at);
create index if not exists vehicles_archived_idx on public.vehicles(company_id, archived_at);
create index if not exists tasks_archived_idx on public.tasks(company_id, archived_at);
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
  auto_generated boolean not null default false,
  generation_source text not null default 'manual',
  last_auto_synced_at timestamptz,
  source_hash text,
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
  auto_generated boolean not null default false,
  source_type text,
  source_ref text,
  required_vehicle_id uuid references public.vehicles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bring_list_audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bring_list_id uuid not null references public.bring_lists(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  old_values jsonb,
  new_values jsonb,
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
create index if not exists bring_lists_auto_date_idx on public.bring_lists(company_id, date, auto_generated, last_auto_synced_at desc);
create index if not exists bring_list_items_list_idx on public.bring_list_items(bring_list_id);
create index if not exists bring_list_items_inventory_idx on public.bring_list_items(inventory_item_id);
create index if not exists bring_list_items_source_idx on public.bring_list_items(bring_list_id, source_type, source_ref);
create index if not exists bring_list_items_required_vehicle_idx on public.bring_list_items(required_vehicle_id) where required_vehicle_id is not null;
create index if not exists bring_list_audit_log_list_idx on public.bring_list_audit_log(bring_list_id, created_at desc);
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

drop trigger if exists set_bring_list_items_updated_at on public.bring_list_items;
create trigger set_bring_list_items_updated_at
before update on public.bring_list_items
for each row execute function public.set_updated_at();

create or replace function public.prevent_bring_list_auto_field_spoof()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.can_manage_company() then
    if tg_op = 'INSERT' then
      if new.auto_generated
        or new.generation_source <> 'manual'
        or new.last_auto_synced_at is not null
        or new.source_hash is not null
      then
        raise exception 'restricted_bring_list_auto_insert';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.auto_generated is distinct from old.auto_generated
        or new.generation_source is distinct from old.generation_source
        or new.last_auto_synced_at is distinct from old.last_auto_synced_at
        or new.source_hash is distinct from old.source_hash
      then
        raise exception 'restricted_bring_list_auto_update';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_bring_list_auto_field_spoof on public.bring_lists;
create trigger prevent_bring_list_auto_field_spoof
before insert or update on public.bring_lists
for each row execute function public.prevent_bring_list_auto_field_spoof();

create or replace function public.validate_bring_list_item_auto_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  list_company_id uuid;
begin
  select company_id
  into list_company_id
  from public.bring_lists
  where id = new.bring_list_id;

  if list_company_id is null then
    raise exception 'bring_list_not_found';
  end if;

  if new.required_vehicle_id is not null and not exists (
    select 1
    from public.vehicles
    where id = new.required_vehicle_id
      and company_id = list_company_id
  ) then
    raise exception 'required_vehicle_not_found';
  end if;

  if auth.uid() is not null and not public.can_manage_company() then
    if tg_op = 'INSERT' then
      if new.auto_generated
        or coalesce(new.source_type, 'manual') <> 'manual'
        or new.source_ref is not null
        or new.required_vehicle_id is not null
      then
        raise exception 'restricted_bring_list_item_source_insert';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.auto_generated is distinct from old.auto_generated
        or new.source_type is distinct from old.source_type
        or new.source_ref is distinct from old.source_ref
        or new.required_vehicle_id is distinct from old.required_vehicle_id
      then
        raise exception 'restricted_bring_list_item_source_update';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_bring_list_item_auto_fields on public.bring_list_items;
create trigger validate_bring_list_item_auto_fields
before insert or update on public.bring_list_items
for each row execute function public.validate_bring_list_item_auto_fields();

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
alter table public.bring_list_audit_log enable row level security;
alter table public.bring_list_audit_log force row level security;
alter table public.material_reservations enable row level security;
alter table public.material_alerts enable row level security;
alter table public.purchase_suggestions enable row level security;

grant select, insert on public.bring_list_audit_log to authenticated;
revoke delete on public.bring_list_audit_log from authenticated;

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

-- Customer portal, released photos and digital work orders.

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
create index if not exists customer_portal_messages_company_idx
  on public.customer_portal_messages(company_id, customer_id, jobsite_id, status, created_at desc);
create index if not exists customer_documents_customer_idx
  on public.customer_documents(company_id, customer_id, jobsite_id, created_at desc);
create index if not exists work_orders_customer_idx on public.work_orders(company_id, customer_id, jobsite_id, created_at desc);
create index if not exists work_orders_order_idx on public.work_orders(order_id);
create index if not exists work_order_versions_work_order_idx on public.work_order_versions(work_order_id, version desc);
create index if not exists reports_customer_release_idx
  on public.reports(company_id, jobsite_id, visible_to_customer, report_status, report_date desc)
  where archived_at is null;

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
alter table public.customer_portal_messages enable row level security;
alter table public.customer_documents enable row level security;
alter table public.work_orders enable row level security;
alter table public.work_order_versions enable row level security;
alter table public.customer_portal_tokens force row level security;
alter table public.customer_portal_events force row level security;
alter table public.customer_portal_messages force row level security;
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

drop policy if exists "managers read customer portal messages" on public.customer_portal_messages;
create policy "managers read customer portal messages"
on public.customer_portal_messages for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers insert customer portal messages" on public.customer_portal_messages;
create policy "managers insert customer portal messages"
on public.customer_portal_messages for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

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

-- Redteam hardening: tenant RLS force, atomic inventory RPCs and critical audit hooks.

do $$
declare
  row record;
begin
  for row in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table %I.%I enable row level security', row.schemaname, row.tablename);
    execute format('alter table %I.%I force row level security', row.schemaname, row.tablename);
  end loop;
end $$;

do $$
declare
  row record;
begin
  for row in
    select table_schema, table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'company_id'
      and table_name not like 'pg_%'
  loop
    execute format('drop policy if exists "redteam managers select fallback" on %I.%I', row.table_schema, row.table_name);
    execute format(
      'create policy "redteam managers select fallback" on %I.%I for select to authenticated using (company_id = public.current_company_id() and public.can_manage_company())',
      row.table_schema,
      row.table_name
    );

    execute format('drop policy if exists "redteam managers insert fallback" on %I.%I', row.table_schema, row.table_name);
    execute format(
      'create policy "redteam managers insert fallback" on %I.%I for insert to authenticated with check (company_id = public.current_company_id() and public.can_manage_company())',
      row.table_schema,
      row.table_name
    );

    execute format('drop policy if exists "redteam managers update fallback" on %I.%I', row.table_schema, row.table_name);
    execute format(
      'create policy "redteam managers update fallback" on %I.%I for update to authenticated using (company_id = public.current_company_id() and public.can_manage_company()) with check (company_id = public.current_company_id() and public.can_manage_company())',
      row.table_schema,
      row.table_name
    );

    execute format('drop policy if exists "redteam managers delete fallback" on %I.%I', row.table_schema, row.table_name);
    execute format(
      'create policy "redteam managers delete fallback" on %I.%I for delete to authenticated using (company_id = public.current_company_id() and public.can_manage_company())',
      row.table_schema,
      row.table_name
    );
  end loop;
end $$;

-- RLS consolidation: exact duplicate redteam fallback policies removed.
-- Generated from: node scripts/audit-rls-policies.mjs --redundant-drops
drop policy if exists "redteam managers select fallback" on public.ai_job_drafts; -- select, gedeckt durch "managers read ai job drafts"
drop policy if exists "redteam managers update fallback" on public.ai_job_drafts; -- update, gedeckt durch "managers update ai job drafts"
drop policy if exists "redteam managers insert fallback" on public.ai_settings; -- insert, gedeckt durch "managers insert ai settings"
drop policy if exists "redteam managers update fallback" on public.ai_settings; -- update, gedeckt durch "managers update ai settings"
drop policy if exists "redteam managers select fallback" on public.ai_usage_logs; -- select, gedeckt durch "managers read ai usage logs"
drop policy if exists "redteam managers delete fallback" on public.bring_list_availability_snapshots; -- delete, gedeckt durch "managers delete availability snapshots"
drop policy if exists "redteam managers update fallback" on public.bring_list_availability_snapshots; -- update, gedeckt durch "managers maintain availability snapshots"
drop policy if exists "redteam managers delete fallback" on public.bring_lists; -- delete, gedeckt durch "managers delete bring lists"
drop policy if exists "redteam managers select fallback" on public.calculation_settings; -- select, gedeckt durch "managers read calculation settings"
drop policy if exists "redteam managers delete fallback" on public.commercial_document_items; -- delete, gedeckt durch "managers delete commercial document items"
drop policy if exists "redteam managers insert fallback" on public.commercial_document_items; -- insert, gedeckt durch "managers insert commercial document items"
drop policy if exists "redteam managers select fallback" on public.commercial_document_items; -- select, gedeckt durch "managers read commercial document items"
drop policy if exists "redteam managers update fallback" on public.commercial_document_items; -- update, gedeckt durch "managers update commercial document items"
drop policy if exists "redteam managers insert fallback" on public.commercial_documents; -- insert, gedeckt durch "managers insert commercial documents"
drop policy if exists "redteam managers select fallback" on public.commercial_documents; -- select, gedeckt durch "managers read commercial documents"
drop policy if exists "redteam managers update fallback" on public.commercial_documents; -- update, gedeckt durch "managers update commercial documents"
drop policy if exists "redteam managers insert fallback" on public.company_audit_log; -- insert, gedeckt durch "managers create company audit log"
drop policy if exists "redteam managers select fallback" on public.company_audit_log; -- select, gedeckt durch "managers read company audit log"
drop policy if exists "redteam managers insert fallback" on public.company_pricing_settings; -- insert, gedeckt durch "managers can insert pricing settings"
drop policy if exists "redteam managers select fallback" on public.company_pricing_settings; -- select, gedeckt durch "managers can read pricing settings"
drop policy if exists "redteam managers update fallback" on public.company_pricing_settings; -- update, gedeckt durch "managers can update pricing settings"
drop policy if exists "redteam managers select fallback" on public.customer_documents; -- select, gedeckt durch "managers read customer documents"
drop policy if exists "redteam managers select fallback" on public.customer_portal_events; -- select, gedeckt durch "managers read customer portal events"
drop policy if exists "redteam managers delete fallback" on public.customer_portal_messages; -- delete, gedeckt durch "managers delete customer portal messages"
drop policy if exists "redteam managers insert fallback" on public.customer_portal_messages; -- insert, gedeckt durch "managers insert customer portal messages"
drop policy if exists "redteam managers select fallback" on public.customer_portal_messages; -- select, gedeckt durch "managers read customer portal messages"
drop policy if exists "redteam managers update fallback" on public.customer_portal_messages; -- update, gedeckt durch "managers update customer portal messages"
drop policy if exists "redteam managers delete fallback" on public.customer_portal_tokens; -- delete, gedeckt durch "managers delete customer portal tokens"
drop policy if exists "redteam managers insert fallback" on public.customer_portal_tokens; -- insert, gedeckt durch "managers insert customer portal tokens"
drop policy if exists "redteam managers select fallback" on public.customer_portal_tokens; -- select, gedeckt durch "managers read customer portal tokens"
drop policy if exists "redteam managers update fallback" on public.customer_portal_tokens; -- update, gedeckt durch "managers update customer portal tokens"
drop policy if exists "redteam managers insert fallback" on public.customers; -- insert, gedeckt durch "managers can insert customers"
drop policy if exists "redteam managers select fallback" on public.customers; -- select, gedeckt durch "managers can read customers"
drop policy if exists "redteam managers update fallback" on public.customers; -- update, gedeckt durch "managers can update customers"
drop policy if exists "redteam managers insert fallback" on public.inventory_items; -- insert, gedeckt durch "managers can insert inventory items"
drop policy if exists "redteam managers select fallback" on public.inventory_items; -- select, gedeckt durch "managers can read inventory items with prices"
drop policy if exists "redteam managers update fallback" on public.inventory_items; -- update, gedeckt durch "managers can update inventory items"
drop policy if exists "redteam managers delete fallback" on public.inventory_locations; -- delete, gedeckt durch "managers can delete inventory locations"
drop policy if exists "redteam managers insert fallback" on public.inventory_locations; -- insert, gedeckt durch "managers can insert inventory locations"
drop policy if exists "redteam managers select fallback" on public.inventory_locations; -- select, gedeckt durch "read own company inventory locations"
drop policy if exists "redteam managers update fallback" on public.inventory_locations; -- update, gedeckt durch "managers can update inventory locations"
drop policy if exists "redteam managers insert fallback" on public.job_dimensions; -- insert, gedeckt durch "managers can insert job dimensions"
drop policy if exists "redteam managers update fallback" on public.job_dimensions; -- update, gedeckt durch "managers can update job dimensions"
drop policy if exists "redteam managers insert fallback" on public.job_estimates; -- insert, gedeckt durch "managers create job estimates"
drop policy if exists "redteam managers select fallback" on public.job_estimates; -- select, gedeckt durch "managers read job estimates"
drop policy if exists "redteam managers delete fallback" on public.job_material_calculation_items; -- delete, gedeckt durch "managers can delete calculation items"
drop policy if exists "redteam managers insert fallback" on public.job_material_calculation_items; -- insert, gedeckt durch "managers can insert calculation items"
drop policy if exists "redteam managers select fallback" on public.job_material_calculation_items; -- select, gedeckt durch "managers can read priced calculation items"
drop policy if exists "redteam managers update fallback" on public.job_material_calculation_items; -- update, gedeckt durch "managers can update calculation items"
drop policy if exists "redteam managers delete fallback" on public.job_material_calculations; -- delete, gedeckt durch "managers can delete job material calculations"
drop policy if exists "redteam managers insert fallback" on public.job_material_calculations; -- insert, gedeckt durch "managers can insert job material calculations"
drop policy if exists "redteam managers update fallback" on public.job_material_calculations; -- update, gedeckt durch "managers can update job material calculations"
drop policy if exists "redteam managers insert fallback" on public.job_material_requirements; -- insert, gedeckt durch "managers can insert order requirements"
drop policy if exists "redteam managers select fallback" on public.job_material_requirements; -- select, gedeckt durch "managers can read priced order requirements"
drop policy if exists "redteam managers update fallback" on public.job_material_requirements; -- update, gedeckt durch "managers can update order requirements"
drop policy if exists "redteam managers update fallback" on public.jobsite_activity_events; -- update, gedeckt durch "managers archive jobsite activity"
drop policy if exists "redteam managers update fallback" on public.jobsite_documents; -- update, gedeckt durch "managers update jobsite documents"
drop policy if exists "redteam managers insert fallback" on public.jobsites; -- insert, gedeckt durch "managers can insert jobsites"
drop policy if exists "redteam managers update fallback" on public.jobsites; -- update, gedeckt durch "managers can update jobsites"
drop policy if exists "redteam managers update fallback" on public.material_alerts; -- update, gedeckt durch "managers update material alerts"
drop policy if exists "redteam managers delete fallback" on public.material_calculation_rules; -- delete, gedeckt durch "managers can delete calculation rules"
drop policy if exists "redteam managers insert fallback" on public.material_calculation_rules; -- insert, gedeckt durch "managers can insert calculation rules"
drop policy if exists "redteam managers update fallback" on public.material_calculation_rules; -- update, gedeckt durch "managers can update calculation rules"
drop policy if exists "redteam managers insert fallback" on public.material_movements; -- insert, gedeckt durch "managers create material movements"
drop policy if exists "redteam managers update fallback" on public.material_movements; -- update, gedeckt durch "managers update material movements"
drop policy if exists "redteam managers insert fallback" on public.material_reservations; -- insert, gedeckt durch "managers create material reservations"
drop policy if exists "redteam managers update fallback" on public.material_reservations; -- update, gedeckt durch "managers update material reservations"
drop policy if exists "redteam managers insert fallback" on public.materials; -- insert, gedeckt durch "managers can insert materials"
drop policy if exists "redteam managers select fallback" on public.materials; -- select, gedeckt durch "managers can read materials with prices"
drop policy if exists "redteam managers update fallback" on public.materials; -- update, gedeckt durch "managers can update materials"
drop policy if exists "redteam managers delete fallback" on public.online_price_discoveries; -- delete, gedeckt durch "managers can delete online price discoveries"
drop policy if exists "redteam managers insert fallback" on public.online_price_discoveries; -- insert, gedeckt durch "managers can insert online price discoveries"
drop policy if exists "redteam managers select fallback" on public.online_price_discoveries; -- select, gedeckt durch "managers can read online price discoveries"
drop policy if exists "redteam managers delete fallback" on public.online_price_offers; -- delete, gedeckt durch "managers can delete online price offers"
drop policy if exists "redteam managers insert fallback" on public.online_price_offers; -- insert, gedeckt durch "managers can insert online price offers"
drop policy if exists "redteam managers select fallback" on public.online_price_offers; -- select, gedeckt durch "managers can read online price offers"
drop policy if exists "redteam managers insert fallback" on public.order_measurement_items; -- insert, gedeckt durch "managers insert order measurement items"
drop policy if exists "redteam managers select fallback" on public.order_measurement_items; -- select, gedeckt durch "managers read order measurement items"
drop policy if exists "redteam managers update fallback" on public.order_measurement_items; -- update, gedeckt durch "managers update order measurement items"
drop policy if exists "redteam managers insert fallback" on public.orders; -- insert, gedeckt durch "managers can insert orders"
drop policy if exists "redteam managers select fallback" on public.orders; -- select, gedeckt durch "managers can read orders"
drop policy if exists "redteam managers update fallback" on public.orders; -- update, gedeckt durch "managers can update orders"
drop policy if exists "redteam managers insert fallback" on public.planning_assignments; -- insert, gedeckt durch "managers insert planning assignments"
drop policy if exists "redteam managers update fallback" on public.planning_assignments; -- update, gedeckt durch "managers update planning assignments"
drop policy if exists "redteam managers insert fallback" on public.planning_resources; -- insert, gedeckt durch "managers insert planning resources"
drop policy if exists "redteam managers update fallback" on public.planning_resources; -- update, gedeckt durch "managers update planning resources"
drop policy if exists "redteam managers insert fallback" on public.planning_weather_checks; -- insert, gedeckt durch "managers insert planning weather checks"
drop policy if exists "redteam managers update fallback" on public.planning_weather_checks; -- update, gedeckt durch "managers update planning weather checks"
drop policy if exists "redteam managers update fallback" on public.privacy_requests; -- update, gedeckt durch "managers update privacy requests"
drop policy if exists "redteam managers delete fallback" on public.profiles; -- delete, gedeckt durch "managers can delete profiles"
drop policy if exists "redteam managers insert fallback" on public.profiles; -- insert, gedeckt durch "managers can insert profiles"
drop policy if exists "redteam managers update fallback" on public.profiles; -- update, gedeckt durch "managers can update profiles"
drop policy if exists "redteam managers select fallback" on public.purchase_suggestions; -- select, gedeckt durch "managers read purchase suggestions"
drop policy if exists "redteam managers update fallback" on public.purchase_suggestions; -- update, gedeckt durch "managers update purchase suggestions"
drop policy if exists "redteam managers update fallback" on public.report_photos; -- update, gedeckt durch "managers update report photo release"
drop policy if exists "redteam managers insert fallback" on public.resource_documents; -- insert, gedeckt durch "managers insert resource documents"
drop policy if exists "redteam managers update fallback" on public.resource_documents; -- update, gedeckt durch "managers update resource documents"
drop policy if exists "redteam managers delete fallback" on public.supplier_integrations; -- delete, gedeckt durch "managers can delete supplier integrations"
drop policy if exists "redteam managers insert fallback" on public.supplier_integrations; -- insert, gedeckt durch "managers can insert supplier integrations"
drop policy if exists "redteam managers select fallback" on public.supplier_integrations; -- select, gedeckt durch "managers can read supplier integrations"
drop policy if exists "redteam managers update fallback" on public.supplier_integrations; -- update, gedeckt durch "managers can update supplier integrations"
drop policy if exists "redteam managers delete fallback" on public.supplier_offer_matches; -- delete, gedeckt durch "managers can delete supplier offer matches"
drop policy if exists "redteam managers insert fallback" on public.supplier_offer_matches; -- insert, gedeckt durch "managers can insert supplier offer matches"
drop policy if exists "redteam managers select fallback" on public.supplier_offer_matches; -- select, gedeckt durch "managers can read supplier offer matches"
drop policy if exists "redteam managers update fallback" on public.supplier_offer_matches; -- update, gedeckt durch "managers can update supplier offer matches"
drop policy if exists "redteam managers delete fallback" on public.supplier_offers; -- delete, gedeckt durch "managers can delete supplier offers"
drop policy if exists "redteam managers insert fallback" on public.supplier_offers; -- insert, gedeckt durch "managers can insert supplier offers"
drop policy if exists "redteam managers select fallback" on public.supplier_offers; -- select, gedeckt durch "managers can read supplier offers"
drop policy if exists "redteam managers update fallback" on public.supplier_offers; -- update, gedeckt durch "managers can update supplier offers"
drop policy if exists "redteam managers delete fallback" on public.supplier_price_history; -- delete, gedeckt durch "managers can delete supplier price history"
drop policy if exists "redteam managers insert fallback" on public.supplier_price_history; -- insert, gedeckt durch "managers can insert supplier price history"
drop policy if exists "redteam managers select fallback" on public.supplier_price_history; -- select, gedeckt durch "managers can read supplier price history"
drop policy if exists "redteam managers delete fallback" on public.suppliers; -- delete, gedeckt durch "managers can delete suppliers"
drop policy if exists "redteam managers insert fallback" on public.suppliers; -- insert, gedeckt durch "managers can insert suppliers"
drop policy if exists "redteam managers select fallback" on public.suppliers; -- select, gedeckt durch "read own company suppliers"
drop policy if exists "redteam managers update fallback" on public.suppliers; -- update, gedeckt durch "managers can update suppliers"
drop policy if exists "redteam managers insert fallback" on public.tasks; -- insert, gedeckt durch "managers can insert tasks"
drop policy if exists "redteam managers delete fallback" on public.time_reports; -- delete, gedeckt durch "managers can delete time reports"
drop policy if exists "redteam managers insert fallback" on public.time_reports; -- insert, gedeckt durch "managers can insert time reports"
drop policy if exists "redteam managers select fallback" on public.time_reports; -- select, gedeckt durch "managers can read time reports"
drop policy if exists "redteam managers update fallback" on public.time_reports; -- update, gedeckt durch "managers can update time reports"
drop policy if exists "redteam managers insert fallback" on public.vehicle_materials; -- insert, gedeckt durch "managers can insert vehicle materials"
drop policy if exists "redteam managers update fallback" on public.vehicle_materials; -- update, gedeckt durch "managers can update vehicle materials"
drop policy if exists "redteam managers insert fallback" on public.vehicles; -- insert, gedeckt durch "managers can insert vehicles"
drop policy if exists "redteam managers update fallback" on public.vehicles; -- update, gedeckt durch "managers can update vehicles"
drop policy if exists "redteam managers delete fallback" on public.weather_snapshots; -- delete, gedeckt durch "managers can delete weather snapshots"
drop policy if exists "redteam managers insert fallback" on public.weather_snapshots; -- insert, gedeckt durch "managers can insert weather snapshots"
drop policy if exists "redteam managers select fallback" on public.weather_snapshots; -- select, gedeckt durch "managers can read weather snapshots"
drop policy if exists "redteam managers update fallback" on public.weather_snapshots; -- update, gedeckt durch "managers can update weather snapshots"
drop policy if exists "redteam managers insert fallback" on public.work_order_versions; -- insert, gedeckt durch "managers insert work order versions"
drop policy if exists "redteam managers select fallback" on public.work_order_versions; -- select, gedeckt durch "managers read work order versions"
drop policy if exists "redteam managers insert fallback" on public.work_orders; -- insert, gedeckt durch "managers insert work orders"
drop policy if exists "redteam managers select fallback" on public.work_orders; -- select, gedeckt durch "managers read work orders"
drop policy if exists "redteam managers update fallback" on public.work_orders; -- update, gedeckt durch "managers update work orders"
drop policy if exists "read own company inventory items" on public.inventory_items;
drop policy if exists "managers can read inventory items with prices" on public.inventory_items;
create policy "managers can read inventory items with prices"
on public.inventory_items for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "read own company materials" on public.materials;
drop policy if exists "managers can read materials with prices" on public.materials;
create policy "managers can read materials with prices"
on public.materials for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "authenticated can read active material catalog" on public.material_catalog;
drop policy if exists "managers can read priced material catalog" on public.material_catalog;
create policy "managers can read priced material catalog"
on public.material_catalog for select
to authenticated
using (active = true and public.can_manage_company());

drop policy if exists "members can upload company report photos" on storage.objects;
create policy "members can upload company report photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'report-photos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'reports'
  and exists (
    select 1 from public.reports r
    where r.company_id = public.current_company_id()
      and r.id::text = (storage.foldername(name))[3]
      and (public.can_manage_company() or r.created_by = auth.uid() or auth.uid() = any(r.employee_ids))
  )
);

create or replace function public.adjust_inventory_stock(
  p_company_id uuid,
  p_item_id uuid,
  p_mode text,
  p_amount numeric,
  p_actor_id uuid
)
returns numeric
language plpgsql
set search_path = public
as $$
declare
  current_stock numeric;
  next_stock numeric;
begin
  if p_company_id <> public.current_company_id() or not public.can_manage_company() then
    raise exception 'not_authorized';
  end if;

  if p_actor_id is distinct from auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if p_amount < 0 or p_mode not in ('increase', 'decrease', 'set') then
    raise exception 'invalid_inventory_adjustment';
  end if;

  select stock
  into current_stock
  from public.inventory_items
  where id = p_item_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'inventory_item_not_found';
  end if;

  next_stock := case
    when p_mode = 'increase' then current_stock + p_amount
    when p_mode = 'decrease' then current_stock - p_amount
    else p_amount
  end;

  if next_stock < 0 then
    raise exception 'negative_stock_not_allowed';
  end if;

  update public.inventory_items
  set stock = next_stock,
      updated_at = now()
  where id = p_item_id
    and company_id = p_company_id;

  insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
  values (
    p_company_id,
    p_actor_id,
    'inventory_item',
    p_item_id,
    'inventory_stock_adjusted',
    jsonb_build_object('stock', current_stock),
    jsonb_build_object('stock', next_stock, 'mode', p_mode, 'amount', p_amount)
  );

  return next_stock;
end;
$$;

create or replace function public.transfer_inventory_item(
  p_company_id uuid,
  p_source_item_id uuid,
  p_target_location_id uuid,
  p_amount numeric,
  p_actor_id uuid
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  source_item public.inventory_items%rowtype;
  target_item_id uuid;
begin
  if p_company_id <> public.current_company_id() or not public.can_manage_company() then
    raise exception 'not_authorized';
  end if;

  if p_actor_id is distinct from auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if p_amount <= 0 then
    raise exception 'invalid_transfer_amount';
  end if;

  select *
  into source_item
  from public.inventory_items
  where id = p_source_item_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'source_inventory_item_not_found';
  end if;

  if source_item.location_id = p_target_location_id then
    raise exception 'same_inventory_location';
  end if;

  if not exists (
    select 1 from public.inventory_locations
    where id = p_target_location_id
      and company_id = p_company_id
      and active = true
  ) then
    raise exception 'target_location_not_found';
  end if;

  if source_item.stock < p_amount then
    raise exception 'insufficient_source_stock';
  end if;

  update public.inventory_items
  set stock = stock - p_amount,
      updated_at = now()
  where id = p_source_item_id
    and company_id = p_company_id;

  if source_item.catalog_item_id is not null then
    insert into public.inventory_items (
      company_id,
      catalog_item_id,
      category_id,
      subcategory_id,
      location_id,
      supplier_id,
      name,
      unit,
      stock,
      minimum_stock,
      package_unit,
      manufacturer,
      article_number,
      ean,
      purchase_price,
      sales_price,
      markup_percent,
      sales_unit,
      price_per_unit,
      notes,
      created_by
    )
    values (
      p_company_id,
      source_item.catalog_item_id,
      source_item.category_id,
      source_item.subcategory_id,
      p_target_location_id,
      source_item.supplier_id,
      source_item.name,
      source_item.unit,
      p_amount,
      source_item.minimum_stock,
      source_item.package_unit,
      source_item.manufacturer,
      source_item.article_number,
      source_item.ean,
      source_item.purchase_price,
      source_item.sales_price,
      source_item.markup_percent,
      source_item.sales_unit,
      source_item.price_per_unit,
      source_item.notes,
      p_actor_id
    )
    on conflict (company_id, catalog_item_id, location_id)
    do update set stock = public.inventory_items.stock + excluded.stock,
                  updated_at = now()
    returning id into target_item_id;
  else
    insert into public.inventory_items (
      company_id,
      category_id,
      subcategory_id,
      location_id,
      supplier_id,
      name,
      unit,
      stock,
      minimum_stock,
      package_unit,
      manufacturer,
      article_number,
      ean,
      purchase_price,
      sales_price,
      markup_percent,
      sales_unit,
      price_per_unit,
      notes,
      created_by
    )
    values (
      p_company_id,
      source_item.category_id,
      source_item.subcategory_id,
      p_target_location_id,
      source_item.supplier_id,
      source_item.name,
      source_item.unit,
      p_amount,
      source_item.minimum_stock,
      source_item.package_unit,
      source_item.manufacturer,
      source_item.article_number,
      source_item.ean,
      source_item.purchase_price,
      source_item.sales_price,
      source_item.markup_percent,
      source_item.sales_unit,
      source_item.price_per_unit,
      source_item.notes,
      p_actor_id
    )
    returning id into target_item_id;
  end if;

  insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
  values (
    p_company_id,
    p_actor_id,
    'inventory_item',
    p_source_item_id,
    'inventory_transferred',
    jsonb_build_object('source_stock', source_item.stock, 'source_location_id', source_item.location_id),
    jsonb_build_object('target_item_id', target_item_id, 'target_location_id', p_target_location_id, 'amount', p_amount)
  );

  return target_item_id;
end;
$$;

create or replace function public.reserve_inventory_item(
  p_company_id uuid,
  p_job_id uuid,
  p_bring_list_id uuid,
  p_material_id uuid,
  p_inventory_item_id uuid,
  p_quantity_required numeric,
  p_quantity_requested numeric,
  p_unit text,
  p_reserved_by uuid
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  item_stock numeric;
  existing_reservation_id uuid;
  existing_reserved numeric := 0;
  active_reserved numeric := 0;
  available_quantity numeric;
  reserved_quantity numeric;
  reservation_status text;
begin
  if p_company_id <> public.current_company_id() or not public.can_manage_company() then
    raise exception 'not_authorized';
  end if;

  if p_reserved_by is distinct from auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if p_quantity_required < 0 or p_quantity_requested < 0 then
    raise exception 'invalid_reservation_quantity';
  end if;

  if p_job_id is not null and not exists (
    select 1 from public.jobsites
    where id = p_job_id
      and company_id = p_company_id
  ) then
    raise exception 'jobsite_not_found';
  end if;

  if p_bring_list_id is not null and not exists (
    select 1 from public.bring_lists
    where id = p_bring_list_id
      and company_id = p_company_id
  ) then
    raise exception 'bring_list_not_found';
  end if;

  if p_material_id is not null and not exists (
    select 1 from public.materials
    where id = p_material_id
      and company_id = p_company_id
  ) then
    raise exception 'material_not_found';
  end if;

  select stock
  into item_stock
  from public.inventory_items
  where id = p_inventory_item_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'inventory_item_not_found';
  end if;

  select id, quantity_reserved
  into existing_reservation_id, existing_reserved
  from public.material_reservations
  where company_id = p_company_id
    and inventory_item_id = p_inventory_item_id
    and (
      (p_bring_list_id is null and bring_list_id is null)
      or bring_list_id = p_bring_list_id
    )
    and status in ('open', 'reserved', 'partially_reserved')
  order by created_at asc
  limit 1
  for update;

  select coalesce(sum(quantity_reserved), 0)
  into active_reserved
  from public.material_reservations
  where company_id = p_company_id
    and inventory_item_id = p_inventory_item_id
    and status in ('open', 'reserved', 'partially_reserved');

  available_quantity := greatest(item_stock - active_reserved + coalesce(existing_reserved, 0), 0);
  reserved_quantity := least(p_quantity_requested, available_quantity);
  reservation_status := case
    when reserved_quantity <= 0 then 'missing'
    when reserved_quantity < p_quantity_required then 'partially_reserved'
    else 'reserved'
  end;

  if existing_reservation_id is not null then
    update public.material_reservations
    set job_id = p_job_id,
        bring_list_id = p_bring_list_id,
        material_id = p_material_id,
        quantity_required = p_quantity_required,
        quantity_reserved = reserved_quantity,
        unit = p_unit,
        status = reservation_status,
        reserved_by = p_reserved_by,
        reserved_at = now(),
        updated_at = now()
    where id = existing_reservation_id
      and company_id = p_company_id
    returning id into existing_reservation_id;
  else
    insert into public.material_reservations (
      company_id,
      job_id,
      bring_list_id,
      material_id,
      inventory_item_id,
      quantity_required,
      quantity_reserved,
      unit,
      status,
      reserved_by,
      reserved_at
    )
    values (
      p_company_id,
      p_job_id,
      p_bring_list_id,
      p_material_id,
      p_inventory_item_id,
      p_quantity_required,
      reserved_quantity,
      p_unit,
      reservation_status,
      p_reserved_by,
      now()
    )
    returning id into existing_reservation_id;
  end if;

  insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, new_values)
  values (
    p_company_id,
    p_reserved_by,
    'material_reservation',
    existing_reservation_id,
    'material_reserved',
    jsonb_build_object(
      'inventory_item_id', p_inventory_item_id,
      'quantity_required', p_quantity_required,
      'quantity_reserved', reserved_quantity,
      'available_before_reservation', available_quantity
    )
  );

  return existing_reservation_id;
end;
$$;

grant execute on function public.adjust_inventory_stock(uuid, uuid, text, numeric, uuid) to authenticated;
grant execute on function public.transfer_inventory_item(uuid, uuid, uuid, numeric, uuid) to authenticated;
grant execute on function public.reserve_inventory_item(uuid, uuid, uuid, uuid, uuid, numeric, numeric, text, uuid) to authenticated;

create or replace function public.prevent_inventory_audit_actor_spoof()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
    and (
      new.action in (
        'inventory_stock_adjusted',
        'inventory_transferred',
        'inventory_consumed',
        'inventory_returned',
        'inventory_purchase_received',
        'material_reserved'
      )
      or new.entity_type in ('inventory_item', 'material_reservation')
    )
    and new.actor_id is distinct from auth.uid()
  then
    raise exception 'actor_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_inventory_audit_actor_spoof on public.company_audit_log;
create trigger prevent_inventory_audit_actor_spoof
before insert or update on public.company_audit_log
for each row execute function public.prevent_inventory_audit_actor_spoof();

create or replace function public.validate_material_reservation_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.company_id <> public.current_company_id() or not public.can_manage_company() then
    raise exception 'not_authorized';
  end if;

  if auth.uid() is not null and new.reserved_by is distinct from auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if new.inventory_item_id is not null and not exists (
    select 1 from public.inventory_items
    where id = new.inventory_item_id
      and company_id = new.company_id
  ) then
    raise exception 'inventory_item_not_found';
  end if;

  if new.job_id is not null and not exists (
    select 1 from public.jobsites
    where id = new.job_id
      and company_id = new.company_id
  ) then
    raise exception 'jobsite_not_found';
  end if;

  if new.bring_list_id is not null and not exists (
    select 1 from public.bring_lists
    where id = new.bring_list_id
      and company_id = new.company_id
  ) then
    raise exception 'bring_list_not_found';
  end if;

  if new.material_id is not null and not exists (
    select 1 from public.materials
    where id = new.material_id
      and company_id = new.company_id
  ) then
    raise exception 'material_not_found';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_material_reservation_tenant on public.material_reservations;
create trigger validate_material_reservation_tenant
before insert or update on public.material_reservations
for each row execute function public.validate_material_reservation_tenant();

create or replace function public.validate_material_movement_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.company_id <> public.current_company_id() or not public.can_manage_company() then
    raise exception 'not_authorized';
  end if;

  if auth.uid() is not null and new.created_by is distinct from auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if not exists (
    select 1 from public.inventory_items
    where id = new.inventory_item_id
      and company_id = new.company_id
  ) then
    raise exception 'inventory_item_not_found';
  end if;

  if new.from_location_id is not null and not exists (
    select 1 from public.inventory_locations
    where id = new.from_location_id
      and company_id = new.company_id
  ) then
    raise exception 'source_location_not_found';
  end if;

  if new.to_location_id is not null and not exists (
    select 1 from public.inventory_locations
    where id = new.to_location_id
      and company_id = new.company_id
  ) then
    raise exception 'target_location_not_found';
  end if;

  if new.jobsite_id is not null and not exists (
    select 1 from public.jobsites
    where id = new.jobsite_id
      and company_id = new.company_id
  ) then
    raise exception 'jobsite_not_found';
  end if;

  if new.bring_list_id is not null and not exists (
    select 1 from public.bring_lists
    where id = new.bring_list_id
      and company_id = new.company_id
  ) then
    raise exception 'bring_list_not_found';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_material_movement_tenant on public.material_movements;
create trigger validate_material_movement_tenant
before insert or update on public.material_movements
for each row execute function public.validate_material_movement_tenant();

-- Baustellenbezogener Materialfluss: Mitarbeiter melden, Vorarbeiter/Chef bestaetigen,
-- Bestand wird erst danach atomar gegen das Lager gebucht.

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.material_movements'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%movement_type%'
  loop
    execute format('alter table public.material_movements drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.material_movements
  add constraint material_movements_movement_type_check
  check (movement_type in ('purchase', 'transfer', 'reserve', 'consume', 'return', 'correction', 'loss', 'break'));

drop policy if exists "managers delete material movements" on public.material_movements;
revoke delete on public.material_movements from authenticated;

drop policy if exists "managers read material movements" on public.material_movements;
drop policy if exists "read relevant material movements" on public.material_movements;
create policy "read relevant material movements"
on public.material_movements for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or created_by = auth.uid()
    or exists (
      select 1
      from public.jobsites j
      where j.id = jobsite_id
        and j.company_id = public.current_company_id()
        and auth.uid() = any(j.assigned_employee_ids)
    )
  )
);

create table if not exists public.material_usage_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  bring_list_id uuid references public.bring_lists(id) on delete set null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit text not null default 'Stueck',
  booking_type text not null check (booking_type in ('consume', 'return', 'loss', 'break')),
  status text not null default 'reported' check (status in ('reported', 'confirmed', 'rejected', 'corrected')),
  movement_id uuid references public.material_movements(id) on delete set null,
  reported_by uuid references public.profiles(id) on delete set null,
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  notes text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists material_usage_reports_company_status_idx
on public.material_usage_reports(company_id, status, created_at desc);

create index if not exists material_usage_reports_jobsite_idx
on public.material_usage_reports(company_id, jobsite_id, status);

create index if not exists material_usage_reports_inventory_idx
on public.material_usage_reports(inventory_item_id, created_at desc);

drop trigger if exists set_material_usage_reports_updated_at on public.material_usage_reports;
create trigger set_material_usage_reports_updated_at
before update on public.material_usage_reports
for each row execute function public.set_updated_at();

alter table public.material_usage_reports enable row level security;
alter table public.material_usage_reports force row level security;

grant select, insert, update on public.material_usage_reports to authenticated;

drop policy if exists "read relevant material usage reports" on public.material_usage_reports;
create policy "read relevant material usage reports"
on public.material_usage_reports for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or reported_by = auth.uid()
    or exists (
      select 1
      from public.jobsites j
      where j.id = jobsite_id
        and j.company_id = public.current_company_id()
        and auth.uid() = any(j.assigned_employee_ids)
    )
  )
);

drop policy if exists "members create material usage reports" on public.material_usage_reports;
create policy "members create material usage reports"
on public.material_usage_reports for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and reported_by = auth.uid()
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

drop policy if exists "operators update material usage reports" on public.material_usage_reports;
create policy "operators update material usage reports"
on public.material_usage_reports for update
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or (
      public.current_role() = 'vorarbeiter'
      and exists (
        select 1
        from public.jobsites j
        where j.id = jobsite_id
          and j.company_id = public.current_company_id()
          and auth.uid() = any(j.assigned_employee_ids)
      )
    )
  )
)
with check (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or (
      public.current_role() = 'vorarbeiter'
      and exists (
        select 1
        from public.jobsites j
        where j.id = jobsite_id
          and j.company_id = public.current_company_id()
          and auth.uid() = any(j.assigned_employee_ids)
      )
    )
  )
);

create or replace function public.prevent_direct_material_usage_status_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.company_id is distinct from old.company_id
    or new.inventory_item_id is distinct from old.inventory_item_id
    or new.jobsite_id is distinct from old.jobsite_id
    or new.reported_by is distinct from old.reported_by
  then
    raise exception 'protected_usage_report_fields';
  end if;

  if (
    new.status is distinct from old.status
    or new.movement_id is distinct from old.movement_id
    or new.confirmed_by is distinct from old.confirmed_by
    or new.confirmed_at is distinct from old.confirmed_at
    or new.rejection_reason is distinct from old.rejection_reason
  ) and coalesce(current_setting('app.material_usage_confirmation', true), '') <> '1' then
    raise exception 'use_material_usage_confirmation_rpc';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_direct_material_usage_status_update on public.material_usage_reports;
create trigger prevent_direct_material_usage_status_update
before update on public.material_usage_reports
for each row execute function public.prevent_direct_material_usage_status_update();

create or replace function public.validate_material_movement_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  actor_can_book boolean;
begin
  actor_can_book := public.can_manage_company()
    or (
      public.current_role() = 'vorarbeiter'
      and new.movement_type in ('consume', 'return', 'loss', 'break')
      and new.jobsite_id is not null
      and exists (
        select 1
        from public.jobsites j
        where j.id = new.jobsite_id
          and j.company_id = new.company_id
          and auth.uid() = any(j.assigned_employee_ids)
      )
    );

  if new.company_id <> public.current_company_id() or not actor_can_book then
    raise exception 'not_authorized';
  end if;

  if auth.uid() is not null and new.created_by is distinct from auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if not exists (
    select 1 from public.inventory_items
    where id = new.inventory_item_id
      and company_id = new.company_id
  ) then
    raise exception 'inventory_item_not_found';
  end if;

  if new.from_location_id is not null and not exists (
    select 1 from public.inventory_locations
    where id = new.from_location_id
      and company_id = new.company_id
  ) then
    raise exception 'source_location_not_found';
  end if;

  if new.to_location_id is not null and not exists (
    select 1 from public.inventory_locations
    where id = new.to_location_id
      and company_id = new.company_id
  ) then
    raise exception 'target_location_not_found';
  end if;

  if new.jobsite_id is not null and not exists (
    select 1 from public.jobsites
    where id = new.jobsite_id
      and company_id = new.company_id
  ) then
    raise exception 'jobsite_not_found';
  end if;

  if new.bring_list_id is not null and not exists (
    select 1 from public.bring_lists
    where id = new.bring_list_id
      and company_id = new.company_id
  ) then
    raise exception 'bring_list_not_found';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_material_movement_tenant on public.material_movements;
create trigger validate_material_movement_tenant
before insert or update on public.material_movements
for each row execute function public.validate_material_movement_tenant();

create or replace function public.confirm_material_usage_report(
  p_company_id uuid,
  p_report_id uuid,
  p_actor_id uuid,
  p_decision text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  report_row public.material_usage_reports%rowtype;
  current_item public.inventory_items%rowtype;
  next_stock numeric;
  v_movement_id uuid;
  existing_alert_id uuid;
  actor_can_confirm boolean;
begin
  if p_company_id <> public.current_company_id() then
    raise exception 'not_authorized';
  end if;

  if p_actor_id is distinct from auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if p_decision not in ('confirmed', 'rejected') then
    raise exception 'invalid_decision';
  end if;

  select *
  into report_row
  from public.material_usage_reports
  where id = p_report_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'usage_report_not_found';
  end if;

  if report_row.status <> 'reported' then
    raise exception 'usage_report_already_processed';
  end if;

  perform set_config('app.material_usage_confirmation', '1', true);

  actor_can_confirm := public.can_manage_company()
    or (
      public.current_role() = 'vorarbeiter'
      and exists (
        select 1
        from public.jobsites j
        where j.id = report_row.jobsite_id
          and j.company_id = p_company_id
          and auth.uid() = any(j.assigned_employee_ids)
      )
    );

  if not actor_can_confirm then
    raise exception 'not_authorized';
  end if;

  if p_decision = 'rejected' then
    update public.material_usage_reports
    set status = 'rejected',
        rejection_reason = nullif(p_note, ''),
        confirmed_by = p_actor_id,
        confirmed_at = now(),
        updated_at = now()
    where id = report_row.id
      and company_id = p_company_id;

    insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
    values (
      p_company_id,
      p_actor_id,
      'material_usage_report',
      report_row.id,
      'material_usage_rejected',
      jsonb_build_object('status', report_row.status),
      jsonb_build_object('status', 'rejected', 'reason', nullif(p_note, ''))
    );

    return null;
  end if;

  select *
  into current_item
  from public.inventory_items
  where id = report_row.inventory_item_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'inventory_item_not_found';
  end if;

  if report_row.booking_type in ('consume', 'loss', 'break') then
    if current_item.stock < report_row.quantity then
      raise exception 'negative_stock_not_allowed';
    end if;

    next_stock := current_item.stock - report_row.quantity;
  else
    next_stock := current_item.stock + report_row.quantity;
  end if;

  update public.inventory_items
  set stock = next_stock,
      updated_at = now()
  where id = current_item.id
    and company_id = p_company_id;

  insert into public.material_movements (
    company_id,
    inventory_item_id,
    from_location_id,
    to_location_id,
    jobsite_id,
    bring_list_id,
    quantity,
    unit,
    movement_type,
    created_by,
    notes
  )
  values (
    p_company_id,
    current_item.id,
    case when report_row.booking_type in ('consume', 'loss', 'break') then current_item.location_id else null end,
    case when report_row.booking_type = 'return' then current_item.location_id else null end,
    report_row.jobsite_id,
    report_row.bring_list_id,
    report_row.quantity,
    report_row.unit,
    report_row.booking_type,
    p_actor_id,
    coalesce(nullif(p_note, ''), report_row.notes)
  )
  returning id into v_movement_id;

  update public.material_usage_reports
  set status = 'confirmed',
      movement_id = v_movement_id,
      confirmed_by = p_actor_id,
      confirmed_at = now(),
      notes = coalesce(nullif(p_note, ''), public.material_usage_reports.notes),
      updated_at = now()
  where id = report_row.id
    and company_id = p_company_id;

  if current_item.minimum_stock > 0 and next_stock <= current_item.minimum_stock then
    update public.material_alerts
    set status = 'open',
        severity = case when next_stock <= 0 then 'critical' else 'warning' end,
        alert_type = case when next_stock <= 0 then 'out_of_stock' else 'low_stock' end,
        message = current_item.name || ' ist knapp: ' || next_stock || ' ' || current_item.unit || ' verfuegbar.',
        available_quantity = next_stock,
        missing_quantity = greatest(current_item.minimum_stock - next_stock, 0),
        unit = current_item.unit,
        resolved_at = null
    where id = (
      select id
      from public.material_alerts
      where company_id = p_company_id
        and inventory_item_id = current_item.id
        and status in ('open', 'acknowledged')
        and alert_type in ('low_stock', 'out_of_stock')
      order by created_at desc
      limit 1
    )
    returning id into existing_alert_id;

    if existing_alert_id is null then
      insert into public.material_alerts (
        company_id,
        inventory_item_id,
        job_id,
        alert_type,
        severity,
        message,
        required_quantity,
        available_quantity,
        missing_quantity,
        unit,
        created_by_system
      )
      values (
        p_company_id,
        current_item.id,
        report_row.jobsite_id,
        case when next_stock <= 0 then 'out_of_stock' else 'low_stock' end,
        case when next_stock <= 0 then 'critical' else 'warning' end,
        current_item.name || ' ist knapp: ' || next_stock || ' ' || current_item.unit || ' verfuegbar.',
        current_item.minimum_stock,
        next_stock,
        greatest(current_item.minimum_stock - next_stock, 0),
        current_item.unit,
        true
      );
    end if;
  elsif current_item.minimum_stock > 0 and next_stock > current_item.minimum_stock then
    update public.material_alerts
    set status = 'resolved',
        resolved_at = now()
    where company_id = p_company_id
      and inventory_item_id = current_item.id
      and status in ('open', 'acknowledged')
      and alert_type in ('low_stock', 'out_of_stock');
  end if;

  insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
  values (
    p_company_id,
    p_actor_id,
    'material_usage_report',
    report_row.id,
    'material_usage_confirmed',
    jsonb_build_object('stock', current_item.stock, 'status', report_row.status),
    jsonb_build_object(
      'stock', next_stock,
      'status', 'confirmed',
      'movement_id', v_movement_id,
      'inventory_item_id', current_item.id,
      'jobsite_id', report_row.jobsite_id,
      'booking_type', report_row.booking_type,
      'quantity', report_row.quantity
    )
  );

  return v_movement_id;
end;
$$;

create or replace function public.reserve_inventory_for_jobsite(
  p_company_id uuid,
  p_jobsite_id uuid,
  p_inventory_item_id uuid,
  p_quantity_required numeric,
  p_quantity_requested numeric,
  p_unit text,
  p_reserved_by uuid,
  p_notes text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  current_item public.inventory_items%rowtype;
  existing_reservation_id uuid;
  existing_reserved numeric := 0;
  active_reserved numeric := 0;
  available_quantity numeric;
  reserved_quantity numeric;
  reservation_status text;
begin
  if p_company_id <> public.current_company_id() or not public.can_manage_company() then
    raise exception 'not_authorized';
  end if;

  if p_reserved_by is distinct from auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if p_quantity_required < 0 or p_quantity_requested < 0 then
    raise exception 'invalid_reservation_quantity';
  end if;

  if not exists (
    select 1 from public.jobsites
    where id = p_jobsite_id
      and company_id = p_company_id
  ) then
    raise exception 'jobsite_not_found';
  end if;

  select *
  into current_item
  from public.inventory_items
  where id = p_inventory_item_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'inventory_item_not_found';
  end if;

  select id, quantity_reserved
  into existing_reservation_id, existing_reserved
  from public.material_reservations
  where company_id = p_company_id
    and job_id = p_jobsite_id
    and bring_list_id is null
    and inventory_item_id = p_inventory_item_id
    and status in ('open', 'reserved', 'partially_reserved')
  order by created_at asc
  limit 1
  for update;

  select coalesce(sum(quantity_reserved), 0)
  into active_reserved
  from public.material_reservations
  where company_id = p_company_id
    and inventory_item_id = p_inventory_item_id
    and status in ('open', 'reserved', 'partially_reserved');

  available_quantity := greatest(current_item.stock - active_reserved + coalesce(existing_reserved, 0), 0);
  reserved_quantity := least(p_quantity_requested, available_quantity);
  reservation_status := case
    when reserved_quantity <= 0 then 'missing'
    when reserved_quantity < p_quantity_required then 'partially_reserved'
    else 'reserved'
  end;

  if existing_reservation_id is not null then
    update public.material_reservations
    set quantity_required = p_quantity_required,
        quantity_reserved = reserved_quantity,
        unit = p_unit,
        status = reservation_status,
        reserved_by = p_reserved_by,
        reserved_at = now(),
        updated_at = now()
    where id = existing_reservation_id
      and company_id = p_company_id
    returning id into existing_reservation_id;
  else
    insert into public.material_reservations (
      company_id,
      job_id,
      inventory_item_id,
      quantity_required,
      quantity_reserved,
      unit,
      status,
      reserved_by,
      reserved_at
    )
    values (
      p_company_id,
      p_jobsite_id,
      p_inventory_item_id,
      p_quantity_required,
      reserved_quantity,
      p_unit,
      reservation_status,
      p_reserved_by,
      now()
    )
    returning id into existing_reservation_id;
  end if;

  insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, new_values)
  values (
    p_company_id,
    p_reserved_by,
    'material_reservation',
    existing_reservation_id,
    'material_reserved',
    jsonb_build_object(
      'inventory_item_id', p_inventory_item_id,
      'jobsite_id', p_jobsite_id,
      'quantity_required', p_quantity_required,
      'quantity_reserved', reserved_quantity,
      'available_before_reservation', available_quantity,
      'notes', nullif(p_notes, '')
    )
  );

  return existing_reservation_id;
end;
$$;

grant execute on function public.confirm_material_usage_report(uuid, uuid, uuid, text, text) to authenticated;
grant execute on function public.reserve_inventory_for_jobsite(uuid, uuid, uuid, numeric, numeric, text, uuid, text) to authenticated;

create or replace function public.prevent_inventory_item_creator_spoof()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and new.created_by is not null then
    if tg_op = 'INSERT' and new.created_by is distinct from auth.uid() then
      raise exception 'actor_mismatch';
    end if;

    if tg_op = 'UPDATE'
      and new.created_by is distinct from old.created_by
      and new.created_by is distinct from auth.uid()
    then
      raise exception 'actor_mismatch';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_inventory_item_creator_spoof on public.inventory_items;
create trigger prevent_inventory_item_creator_spoof
before insert or update on public.inventory_items
for each row execute function public.prevent_inventory_item_creator_spoof();

create or replace function public.validate_vehicle_material_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.company_id <> public.current_company_id() or not public.can_manage_company() then
    raise exception 'not_authorized';
  end if;

  if not exists (
    select 1 from public.vehicles
    where id = new.vehicle_id
      and company_id = new.company_id
  ) then
    raise exception 'vehicle_not_found';
  end if;

  if not exists (
    select 1 from public.materials
    where id = new.material_id
      and company_id = new.company_id
  ) then
    raise exception 'material_not_found';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_vehicle_material_tenant on public.vehicle_materials;
create trigger validate_vehicle_material_tenant
before insert or update on public.vehicle_materials
for each row execute function public.validate_vehicle_material_tenant();

create or replace function public.assert_role_change_allowed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  other_admin_exists boolean;
begin
  if old.role is not distinct from new.role then
    return new;
  end if;

  select p.role
    into actor_role
  from public.profiles p
  where p.id = auth.uid()
    and p.company_id = old.company_id
    and p.active = true
  limit 1;

  if new.role = 'admin' and coalesce(actor_role, '') <> 'admin' then
    raise exception 'Keine Berechtigung fuer diese Rollenaenderung.';
  end if;

  if old.role = 'admin' and new.role <> 'admin' then
    select exists (
      select 1
      from public.profiles p
      where p.company_id = old.company_id
        and p.id <> old.id
        and p.role = 'admin'
        and p.active = true
    )
      into other_admin_exists;

    if not coalesce(other_admin_exists, false) then
      raise exception 'Keine Berechtigung fuer diese Rollenaenderung.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_role_change_before_audit on public.profiles;
create trigger guard_profile_role_change_before_audit
before update of role on public.profiles
for each row execute function public.assert_role_change_allowed();

create or replace function public.audit_profile_role_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.role is distinct from new.role then
    insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
    values (
      new.company_id,
      auth.uid(),
      'profile',
      new.id,
      'role_changed',
      jsonb_build_object('role', old.role),
      jsonb_build_object('role', new.role)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_profile_role_change on public.profiles;
create trigger audit_profile_role_change
after update of role on public.profiles
for each row execute function public.audit_profile_role_change();

create or replace function public.audit_inventory_price_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.purchase_price is distinct from new.purchase_price
    or old.sales_price is distinct from new.sales_price
    or old.markup_percent is distinct from new.markup_percent
    or old.price_per_unit is distinct from new.price_per_unit then
    insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
    values (
      new.company_id,
      auth.uid(),
      'inventory_item',
      new.id,
      'price_changed',
      jsonb_build_object(
        'purchase_price', old.purchase_price,
        'sales_price', old.sales_price,
        'markup_percent', old.markup_percent,
        'price_per_unit', old.price_per_unit
      ),
      jsonb_build_object(
        'purchase_price', new.purchase_price,
        'sales_price', new.sales_price,
        'markup_percent', new.markup_percent,
        'price_per_unit', new.price_per_unit
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_inventory_price_change on public.inventory_items;
create trigger audit_inventory_price_change
after update of purchase_price, sales_price, markup_percent, price_per_unit on public.inventory_items
for each row execute function public.audit_inventory_price_change();

create or replace function public.audit_supplier_key_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.api_key_encrypted is distinct from new.api_key_encrypted then
    insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
    values (
      new.company_id,
      auth.uid(),
      'supplier_integration',
      new.id,
      'supplier_key_changed',
      jsonb_build_object('had_key', old.api_key_encrypted is not null),
      jsonb_build_object('has_key', new.api_key_encrypted is not null)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_supplier_key_change on public.supplier_integrations;
create trigger audit_supplier_key_change
after update of api_key_encrypted on public.supplier_integrations
for each row execute function public.audit_supplier_key_change();

-- Performance indexes for high-traffic SaaS surfaces.
create index if not exists idx_jobsites_company_status_start on public.jobsites (company_id, status, start_date);
create index if not exists idx_jobsites_company_created on public.jobsites (company_id, created_at desc);
create index if not exists idx_jobsites_assigned_employees on public.jobsites using gin (assigned_employee_ids);
create index if not exists idx_orders_company_status_start on public.orders (company_id, status, start_date);
create index if not exists idx_orders_company_created on public.orders (company_id, created_at desc);
create index if not exists idx_orders_company_customer on public.orders (company_id, customer_id, created_at desc);
create index if not exists idx_orders_company_jobsite on public.orders (company_id, jobsite_id);
create index if not exists idx_reports_company_report_date on public.reports (company_id, report_date desc);
create index if not exists idx_reports_company_jobsite on public.reports (company_id, jobsite_id, report_date desc);
create index if not exists idx_tasks_company_status_due on public.tasks (company_id, status, due_date);
create index if not exists idx_tasks_company_assigned on public.tasks (company_id, assigned_to, status);
create index if not exists idx_time_entries_company_date_employee on public.time_entries (company_id, date desc, employee_id);
create index if not exists idx_time_entries_company_status_date on public.time_entries (company_id, status, date desc);
create index if not exists idx_time_entries_employee_status on public.time_entries (employee_id, status, date desc);
create index if not exists idx_inventory_items_company_name on public.inventory_items (company_id, name);
create index if not exists idx_inventory_items_company_location on public.inventory_items (company_id, location_id, name);
create index if not exists idx_inventory_items_company_stock on public.inventory_items (company_id, stock, minimum_stock);
create index if not exists idx_material_alerts_company_status_created on public.material_alerts (company_id, status, created_at desc);
create index if not exists idx_material_alerts_company_bring_list on public.material_alerts (company_id, bring_list_id, status);
create index if not exists idx_purchase_suggestions_company_status_created on public.purchase_suggestions (company_id, status, created_at desc);
create index if not exists idx_purchase_suggestions_company_bring_list on public.purchase_suggestions (company_id, bring_list_id, status);
create index if not exists idx_bring_lists_company_date_status on public.bring_lists (company_id, date, status);
create index if not exists idx_bring_lists_company_assigned on public.bring_lists (company_id, assigned_to, date);
create index if not exists idx_customers_company_status_updated on public.customers (company_id, status, updated_at desc);
create index if not exists idx_customers_company_type_updated on public.customers (company_id, customer_type, updated_at desc);
create index if not exists idx_customer_portal_tokens_token_hash on public.customer_portal_tokens (token_hash);
create index if not exists idx_customer_portal_tokens_company_customer on public.customer_portal_tokens (company_id, customer_id, revoked_at);
create index if not exists idx_report_photos_report_visible on public.report_photos (report_id, visible_to_customer, created_at desc);
create index if not exists idx_work_orders_company_order_status on public.work_orders (company_id, order_id, status, created_at desc);

-- Bring-list direct update hardening.
create or replace function public.can_access_bring_list(
  p_company_id uuid,
  p_job_id uuid,
  p_assigned_to uuid,
  p_created_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_company_id = public.current_company_id()
    and (
      public.can_manage_company()
      or p_assigned_to = auth.uid()
      or p_created_by = auth.uid()
      or exists (
        select 1
        from public.jobsites j
        where j.id = p_job_id
          and j.company_id = p_company_id
          and auth.uid() = any(j.assigned_employee_ids)
      )
    )
$$;

drop policy if exists "read relevant bring lists" on public.bring_lists;
create policy "read relevant bring lists"
on public.bring_lists for select
to authenticated
using (public.can_access_bring_list(company_id, job_id, assigned_to, created_by));

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
using (public.can_access_bring_list(company_id, job_id, assigned_to, created_by))
with check (public.can_access_bring_list(company_id, job_id, assigned_to, created_by));

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
    select 1
    from public.bring_lists bl
    where bl.id = bring_list_id
      and public.can_access_bring_list(bl.company_id, bl.job_id, bl.assigned_to, bl.created_by)
  )
);

drop policy if exists "create relevant bring list items" on public.bring_list_items;
create policy "create relevant bring list items"
on public.bring_list_items for insert
to authenticated
with check (
  exists (
    select 1
    from public.bring_lists bl
    where bl.id = bring_list_id
      and public.can_access_bring_list(bl.company_id, bl.job_id, bl.assigned_to, bl.created_by)
  )
);

drop policy if exists "update relevant bring list items" on public.bring_list_items;
create policy "update relevant bring list items"
on public.bring_list_items for update
to authenticated
using (
  exists (
    select 1
    from public.bring_lists bl
    where bl.id = bring_list_id
      and public.can_access_bring_list(bl.company_id, bl.job_id, bl.assigned_to, bl.created_by)
  )
)
with check (
  exists (
    select 1
    from public.bring_lists bl
    where bl.id = bring_list_id
      and public.can_access_bring_list(bl.company_id, bl.job_id, bl.assigned_to, bl.created_by)
  )
);

drop policy if exists "managers delete bring list items" on public.bring_list_items;
create policy "managers delete bring list items"
on public.bring_list_items for delete
to authenticated
using (
  exists (
    select 1
    from public.bring_lists bl
    where bl.id = bring_list_id
      and bl.company_id = public.current_company_id()
      and public.can_manage_company()
  )
);

drop policy if exists "read relevant bring list audit log" on public.bring_list_audit_log;
create policy "read relevant bring list audit log"
on public.bring_list_audit_log for select
to authenticated
using (
  exists (
    select 1
    from public.bring_lists bl
    where bl.id = bring_list_id
      and public.can_access_bring_list(bl.company_id, bl.job_id, bl.assigned_to, bl.created_by)
  )
);

drop policy if exists "create relevant bring list audit log" on public.bring_list_audit_log;
create policy "create relevant bring list audit log"
on public.bring_list_audit_log for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and actor_id = auth.uid()
  and exists (
    select 1
    from public.bring_lists bl
    where bl.id = bring_list_id
      and public.can_access_bring_list(bl.company_id, bl.job_id, bl.assigned_to, bl.created_by)
  )
);

drop policy if exists "redteam managers delete fallback" on public.bring_list_audit_log;

create or replace function public.validate_bring_list_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and new.company_id <> public.current_company_id() then
    raise exception 'not_authorized';
  end if;

  if not exists (
    select 1
    from public.jobsites
    where id = new.job_id
      and company_id = new.company_id
  ) then
    raise exception 'jobsite_not_found';
  end if;

  if new.created_by is not null and not exists (
    select 1
    from public.profiles
    where id = new.created_by
      and company_id = new.company_id
  ) then
    raise exception 'creator_not_found';
  end if;

  if new.assigned_to is not null and not exists (
    select 1
    from public.profiles
    where id = new.assigned_to
      and company_id = new.company_id
      and role in ('vorarbeiter', 'mitarbeiter')
  ) then
    raise exception 'assignee_not_found';
  end if;

  if new.vehicle_id is not null and not exists (
    select 1
    from public.vehicles
    where id = new.vehicle_id
      and company_id = new.company_id
  ) then
    raise exception 'vehicle_not_found';
  end if;

  if auth.uid() is not null and not public.can_manage_company() then
    if tg_op = 'INSERT' then
      if new.created_by is distinct from auth.uid() then
        raise exception 'actor_mismatch';
      end if;

      if new.assigned_to is distinct from auth.uid() then
        raise exception 'assignment_mismatch';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.company_id is distinct from old.company_id
        or new.job_id is distinct from old.job_id
        or new.date is distinct from old.date
        or new.title is distinct from old.title
        or new.notes is distinct from old.notes
        or new.created_by is distinct from old.created_by
        or new.assigned_to is distinct from old.assigned_to
        or new.vehicle_id is distinct from old.vehicle_id
      then
        raise exception 'restricted_bring_list_update';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_bring_list_tenant on public.bring_lists;
create trigger validate_bring_list_tenant
before insert or update on public.bring_lists
for each row execute function public.validate_bring_list_tenant();

create or replace function public.validate_bring_list_item_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  list_company_id uuid;
begin
  select company_id
  into list_company_id
  from public.bring_lists
  where id = new.bring_list_id;

  if list_company_id is null then
    raise exception 'bring_list_not_found';
  end if;

  if auth.uid() is not null and list_company_id <> public.current_company_id() then
    raise exception 'not_authorized';
  end if;

  if new.material_id is not null and not exists (
    select 1
    from public.materials
    where id = new.material_id
      and company_id = list_company_id
  ) then
    raise exception 'material_not_found';
  end if;

  if new.inventory_item_id is not null and not exists (
    select 1
    from public.inventory_items
    where id = new.inventory_item_id
      and company_id = list_company_id
  ) then
    raise exception 'inventory_item_not_found';
  end if;

  if new.vehicle_id is not null and not exists (
    select 1
    from public.vehicles
    where id = new.vehicle_id
      and company_id = list_company_id
  ) then
    raise exception 'vehicle_not_found';
  end if;

  if auth.uid() is not null and not public.can_manage_company() then
    if tg_op = 'INSERT' then
	      if not exists (
	        select 1
	        from public.bring_lists bl
	        where bl.id = new.bring_list_id
	          and public.can_access_bring_list(bl.company_id, bl.job_id, bl.assigned_to, bl.created_by)
	      ) then
	        raise exception 'not_authorized';
	      end if;
    elsif tg_op = 'UPDATE' then
      if new.bring_list_id is distinct from old.bring_list_id
        or new.material_id is distinct from old.material_id
        or new.inventory_item_id is distinct from old.inventory_item_id
        or new.custom_item_name is distinct from old.custom_item_name
        or new.item_type is distinct from old.item_type
        or new.quantity is distinct from old.quantity
        or new.unit is distinct from old.unit
        or new.storage_location is distinct from old.storage_location
        or new.vehicle_id is distinct from old.vehicle_id
        or new.notes is distinct from old.notes
        or new.created_at is distinct from old.created_at
      then
        raise exception 'restricted_bring_list_item_update';
      end if;

      if old.missing_reported and not new.missing_reported then
        raise exception 'restricted_missing_report_reset';
      end if;

      if new.packed and new.packed_by is distinct from auth.uid() then
        raise exception 'actor_mismatch';
      end if;

      if not new.packed and new.packed_by is not null then
        raise exception 'actor_mismatch';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_bring_list_item_tenant on public.bring_list_items;
create trigger validate_bring_list_item_tenant
before insert or update on public.bring_list_items
for each row execute function public.validate_bring_list_item_tenant();

select pg_notify('pgrst', 'reload schema');

-- Lieferschein-Erkennung per Foto mit bestaetigungspflichtigem Wareneingang.
-- Preisfelder liegen getrennt in einer Manager-only Tabelle, damit Vorarbeiter keine EK-Preise sehen.

insert into storage.buckets (id, name, public)
values ('delivery-notes', 'delivery-notes', false)
on conflict (id) do update set public = false;

create table if not exists public.delivery_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text,
  document_date date,
  status text not null default 'uploaded' check (status in ('uploaded', 'recognized', 'confirmed', 'rejected')),
  storage_path text not null unique,
  file_name text not null,
  content_type text not null,
  recognition_model text,
  recognition_confidence numeric(5, 2),
  recognized_json jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_note_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  delivery_note_id uuid not null references public.delivery_notes(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  supplier_article_number text,
  article_name text not null,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit text not null default 'Stueck',
  target_location_id uuid references public.inventory_locations(id) on delete set null,
  recognition_confidence numeric(5, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_note_item_prices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  delivery_note_item_id uuid not null unique references public.delivery_note_items(id) on delete cascade,
  unit_price numeric(12, 2),
  total_price numeric(12, 2),
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists delivery_notes_company_created_idx on public.delivery_notes(company_id, created_at desc);
create index if not exists delivery_notes_status_idx on public.delivery_notes(company_id, status, created_at desc);
create index if not exists delivery_note_items_note_idx on public.delivery_note_items(delivery_note_id);
create index if not exists delivery_note_items_inventory_idx on public.delivery_note_items(inventory_item_id);
create index if not exists delivery_note_item_prices_item_idx on public.delivery_note_item_prices(delivery_note_item_id);

drop trigger if exists set_delivery_notes_updated_at on public.delivery_notes;
create trigger set_delivery_notes_updated_at
before update on public.delivery_notes
for each row execute function public.set_updated_at();

drop trigger if exists set_delivery_note_items_updated_at on public.delivery_note_items;
create trigger set_delivery_note_items_updated_at
before update on public.delivery_note_items
for each row execute function public.set_updated_at();

drop trigger if exists set_delivery_note_item_prices_updated_at on public.delivery_note_item_prices;
create trigger set_delivery_note_item_prices_updated_at
before update on public.delivery_note_item_prices
for each row execute function public.set_updated_at();

alter table public.delivery_notes enable row level security;
alter table public.delivery_notes force row level security;
alter table public.delivery_note_items enable row level security;
alter table public.delivery_note_items force row level security;
alter table public.delivery_note_item_prices enable row level security;
alter table public.delivery_note_item_prices force row level security;

grant select, insert, update on public.delivery_notes to authenticated;
grant select, insert, update on public.delivery_note_items to authenticated;
grant select, insert, update on public.delivery_note_item_prices to authenticated;

drop policy if exists "operators read delivery notes" on public.delivery_notes;
create policy "operators read delivery notes"
on public.delivery_notes for select
to authenticated
using (company_id = public.current_company_id() and public.current_role() in ('admin', 'chef', 'vorarbeiter'));

drop policy if exists "operators create delivery notes" on public.delivery_notes;
create policy "operators create delivery notes"
on public.delivery_notes for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and created_by = auth.uid()
  and public.current_role() in ('admin', 'chef', 'vorarbeiter')
);

drop policy if exists "operators update delivery notes" on public.delivery_notes;
create policy "operators update delivery notes"
on public.delivery_notes for update
to authenticated
using (company_id = public.current_company_id() and public.current_role() in ('admin', 'chef', 'vorarbeiter'))
with check (company_id = public.current_company_id() and public.current_role() in ('admin', 'chef', 'vorarbeiter'));

drop policy if exists "operators read delivery note items" on public.delivery_note_items;
create policy "operators read delivery note items"
on public.delivery_note_items for select
to authenticated
using (company_id = public.current_company_id() and public.current_role() in ('admin', 'chef', 'vorarbeiter'));

drop policy if exists "operators create delivery note items" on public.delivery_note_items;
create policy "operators create delivery note items"
on public.delivery_note_items for insert
to authenticated
with check (company_id = public.current_company_id() and public.current_role() in ('admin', 'chef', 'vorarbeiter'));

drop policy if exists "operators update delivery note items" on public.delivery_note_items;
create policy "operators update delivery note items"
on public.delivery_note_items for update
to authenticated
using (company_id = public.current_company_id() and public.current_role() in ('admin', 'chef', 'vorarbeiter'))
with check (company_id = public.current_company_id() and public.current_role() in ('admin', 'chef', 'vorarbeiter'));

drop policy if exists "managers read delivery note item prices" on public.delivery_note_item_prices;
create policy "managers read delivery note item prices"
on public.delivery_note_item_prices for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers create delivery note item prices" on public.delivery_note_item_prices;
create policy "managers create delivery note item prices"
on public.delivery_note_item_prices for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update delivery note item prices" on public.delivery_note_item_prices;
create policy "managers update delivery note item prices"
on public.delivery_note_item_prices for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "operators read delivery note storage" on storage.objects;
create policy "operators read delivery note storage"
on storage.objects for select
to authenticated
using (
  bucket_id = 'delivery-notes'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'delivery-notes'
  and public.current_role() in ('admin', 'chef', 'vorarbeiter')
);

drop policy if exists "operators upload delivery note storage" on storage.objects;
create policy "operators upload delivery note storage"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'delivery-notes'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'delivery-notes'
  and public.current_role() in ('admin', 'chef', 'vorarbeiter')
);

create or replace function public.confirm_delivery_note(
  p_company_id uuid,
  p_delivery_note_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
set search_path = public
as $$
declare
  note_row public.delivery_notes%rowtype;
  item_row public.delivery_note_items%rowtype;
  current_stock numeric;
begin
  if p_company_id <> public.current_company_id()
    or public.current_role() not in ('admin', 'chef', 'vorarbeiter')
  then
    raise exception 'not_authorized';
  end if;

  if p_actor_id is distinct from auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  select *
  into note_row
  from public.delivery_notes
  where id = p_delivery_note_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'delivery_note_not_found';
  end if;

  if note_row.status = 'confirmed' then
    raise exception 'delivery_note_already_confirmed';
  end if;

  for item_row in
    select *
    from public.delivery_note_items
    where delivery_note_id = p_delivery_note_id
      and company_id = p_company_id
    order by created_at
  loop
    if item_row.inventory_item_id is null then
      raise exception 'delivery_note_item_missing_inventory';
    end if;

    select stock
    into current_stock
    from public.inventory_items
    where id = item_row.inventory_item_id
      and company_id = p_company_id
    for update;

    if not found then
      raise exception 'inventory_item_not_found';
    end if;

    update public.inventory_items
    set stock = current_stock + item_row.quantity,
        updated_at = now()
    where id = item_row.inventory_item_id
      and company_id = p_company_id;

    insert into public.material_movements (
      company_id,
      inventory_item_id,
      to_location_id,
      quantity,
      unit,
      movement_type,
      created_by,
      notes
    )
    values (
      p_company_id,
      item_row.inventory_item_id,
      item_row.target_location_id,
      item_row.quantity,
      item_row.unit,
      'purchase',
      p_actor_id,
      concat('Lieferschein ', coalesce(note_row.supplier_name, 'ohne Lieferant'), ' vom ', coalesce(note_row.document_date::text, 'ohne Datum'))
    );
  end loop;

  update public.delivery_notes
  set status = 'confirmed',
      confirmed_by = p_actor_id,
      confirmed_at = now()
  where id = p_delivery_note_id
    and company_id = p_company_id;

  insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, new_values)
  values (
    p_company_id,
    p_actor_id,
    'delivery_note',
    p_delivery_note_id,
    'delivery_note_confirmed',
    jsonb_build_object('status', 'confirmed')
  );
end;
$$;

grant execute on function public.confirm_delivery_note(uuid, uuid, uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');

-- Final hard-delete deny-list for protected business tables.
-- The broad redteam fallback grants tenant CRUD first; these drops narrow DELETE again.

drop policy if exists "managers can delete customers" on public.customers;
drop policy if exists "managers can delete jobsites" on public.jobsites;
drop policy if exists "managers can delete orders" on public.orders;
drop policy if exists "managers can delete job dimensions" on public.job_dimensions;
drop policy if exists "delete relevant reports" on public.reports;
drop policy if exists "delete report photos" on public.report_photos;
drop policy if exists "managers can delete time entries" on public.time_entries;
drop policy if exists "managers can delete materials" on public.materials;
drop policy if exists "managers can delete inventory items" on public.inventory_items;
drop policy if exists "managers can delete vehicles" on public.vehicles;
drop policy if exists "managers can delete vehicle materials" on public.vehicle_materials;
drop policy if exists "managers can delete resource documents" on public.resource_documents;
drop policy if exists "managers can delete tasks" on public.tasks;
drop policy if exists "managers can delete order requirements" on public.job_material_requirements;
drop policy if exists "redteam managers delete fallback" on public.digital_signatures;
drop policy if exists "redteam managers delete fallback" on public.digital_document_versions;

drop policy if exists "redteam managers delete fallback" on public.customers;
drop policy if exists "redteam managers delete fallback" on public.jobsites;
drop policy if exists "redteam managers delete fallback" on public.orders;
drop policy if exists "redteam managers delete fallback" on public.job_dimensions;
drop policy if exists "redteam managers delete fallback" on public.reports;
drop policy if exists "redteam managers delete fallback" on public.report_photos;
drop policy if exists "redteam managers delete fallback" on public.time_entries;
drop policy if exists "redteam managers delete fallback" on public.materials;
drop policy if exists "redteam managers delete fallback" on public.inventory_items;
drop policy if exists "redteam managers delete fallback" on public.vehicles;
drop policy if exists "redteam managers delete fallback" on public.vehicle_materials;
drop policy if exists "redteam managers delete fallback" on public.resource_documents;
drop policy if exists "redteam managers delete fallback" on public.tasks;
drop policy if exists "redteam managers delete fallback" on public.job_material_requirements;

select pg_notify('pgrst', 'reload schema');


-- -----------------------------------------------------------------------------
-- Flexible Checklisten fuer Baustellen, Arbeitssicherheit, Abnahmen und Material.
-- Mirrors supabase/migrations/20260705_flexible_checklists.sql.
-- -----------------------------------------------------------------------------

-- Flexible Checklisten fuer Baustellen, Arbeitssicherheit, Abnahmen und Material.

create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  category text not null check (category in ('arbeitssicherheit', 'baustart', 'tagesabschluss', 'abnahme', 'material', 'geruest', 'dacharbeiten')),
  description text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  label text not null,
  help_text text,
  required boolean not null default false,
  photo_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.jobsite_checklists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  template_id uuid references public.checklist_templates(id) on delete set null,
  title text not null,
  category text not null check (category in ('arbeitssicherheit', 'baustart', 'tagesabschluss', 'abnahme', 'material', 'geruest', 'dacharbeiten')),
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'completed', 'archived')),
  due_date date,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  signature_name text,
  signature_data_url text,
  signature_role text check (signature_role in ('kunde', 'mitarbeiter', 'vorarbeiter', 'chef', 'admin')),
  signature_signed_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.jobsite_checklist_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  checklist_id uuid not null references public.jobsite_checklists(id) on delete cascade,
  template_item_id uuid references public.checklist_template_items(id) on delete set null,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  label text not null,
  help_text text,
  required boolean not null default false,
  photo_required boolean not null default false,
  status text not null default 'offen' check (status in ('offen', 'erledigt', 'nicht_zutreffend', 'problem')),
  notes text,
  problem_description text,
  resolved_task_id uuid references public.tasks(id) on delete set null,
  checked_by uuid references auth.users(id) on delete set null,
  checked_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.checklist_item_photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  checklist_id uuid not null references public.jobsite_checklists(id) on delete cascade,
  checklist_item_id uuid not null references public.jobsite_checklist_items(id) on delete cascade,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists checklist_templates_company_idx
  on public.checklist_templates(company_id, category, active, archived_at, name);
create index if not exists checklist_template_items_template_idx
  on public.checklist_template_items(template_id, archived_at, sort_order);
create index if not exists jobsite_checklists_company_jobsite_idx
  on public.jobsite_checklists(company_id, jobsite_id, status, archived_at, created_at desc);
create index if not exists jobsite_checklist_items_checklist_idx
  on public.jobsite_checklist_items(company_id, checklist_id, archived_at, sort_order);
create index if not exists jobsite_checklist_items_problem_idx
  on public.jobsite_checklist_items(company_id, status, resolved_task_id)
  where archived_at is null and status = 'problem';
create index if not exists checklist_item_photos_item_idx
  on public.checklist_item_photos(company_id, checklist_item_id, archived_at, created_at desc);

alter table public.checklist_templates enable row level security;
alter table public.checklist_template_items enable row level security;
alter table public.jobsite_checklists enable row level security;
alter table public.jobsite_checklist_items enable row level security;
alter table public.checklist_item_photos enable row level security;
alter table public.checklist_templates force row level security;
alter table public.checklist_template_items force row level security;
alter table public.jobsite_checklists force row level security;
alter table public.jobsite_checklist_items force row level security;
alter table public.checklist_item_photos force row level security;

drop policy if exists "members read checklist templates" on public.checklist_templates;
create policy "members read checklist templates"
on public.checklist_templates for select
to authenticated
using (
  archived_at is null
  and active
  and (company_id is null or company_id = public.current_company_id())
);

drop policy if exists "managers insert checklist templates" on public.checklist_templates;
create policy "managers insert checklist templates"
on public.checklist_templates for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update checklist templates" on public.checklist_templates;
create policy "managers update checklist templates"
on public.checklist_templates for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "members read checklist template items" on public.checklist_template_items;
create policy "members read checklist template items"
on public.checklist_template_items for select
to authenticated
using (
  archived_at is null
  and exists (
    select 1 from public.checklist_templates t
    where t.id = template_id
      and t.archived_at is null
      and t.active
      and (t.company_id is null or t.company_id = public.current_company_id())
  )
);

drop policy if exists "managers insert checklist template items" on public.checklist_template_items;
create policy "managers insert checklist template items"
on public.checklist_template_items for insert
to authenticated
with check (
  public.can_manage_company()
  and company_id = public.current_company_id()
  and exists (
    select 1 from public.checklist_templates t
    where t.id = template_id
      and t.company_id = public.current_company_id()
  )
);

drop policy if exists "managers update checklist template items" on public.checklist_template_items;
create policy "managers update checklist template items"
on public.checklist_template_items for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "members read jobsite checklists" on public.jobsite_checklists;
create policy "members read jobsite checklists"
on public.jobsite_checklists for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and exists (
    select 1
    from public.jobsites j
    where j.id = jobsite_id
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "operators insert jobsite checklists" on public.jobsite_checklists;
create policy "operators insert jobsite checklists"
on public.jobsite_checklists for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and exists (
    select 1
    from public.jobsites j
    where j.id = jobsite_id
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or (public.current_role() = 'vorarbeiter' and auth.uid() = any(j.assigned_employee_ids))
      )
  )
);

drop policy if exists "operators update jobsite checklists" on public.jobsite_checklists;
create policy "operators update jobsite checklists"
on public.jobsite_checklists for update
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and exists (
    select 1
    from public.jobsites j
    where j.id = jobsite_id
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or (public.current_role() = 'vorarbeiter' and auth.uid() = any(j.assigned_employee_ids))
      )
  )
)
with check (
  company_id = public.current_company_id()
  and exists (
    select 1
    from public.jobsites j
    where j.id = jobsite_id
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or (public.current_role() = 'vorarbeiter' and auth.uid() = any(j.assigned_employee_ids))
      )
  )
);

drop policy if exists "members read jobsite checklist items" on public.jobsite_checklist_items;
create policy "members read jobsite checklist items"
on public.jobsite_checklist_items for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and exists (
    select 1
    from public.jobsite_checklists c
    join public.jobsites j on j.id = c.jobsite_id
    where c.id = checklist_id
      and c.company_id = public.current_company_id()
      and c.archived_at is null
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "operators insert jobsite checklist items" on public.jobsite_checklist_items;
create policy "operators insert jobsite checklist items"
on public.jobsite_checklist_items for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and exists (
    select 1
    from public.jobsite_checklists c
    join public.jobsites j on j.id = c.jobsite_id
    where c.id = checklist_id
      and c.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or (public.current_role() = 'vorarbeiter' and auth.uid() = any(j.assigned_employee_ids))
      )
  )
);

drop policy if exists "operators update jobsite checklist items" on public.jobsite_checklist_items;
create policy "operators update jobsite checklist items"
on public.jobsite_checklist_items for update
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and exists (
    select 1
    from public.jobsite_checklists c
    join public.jobsites j on j.id = c.jobsite_id
    where c.id = checklist_id
      and c.company_id = public.current_company_id()
      and c.archived_at is null
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
)
with check (
  company_id = public.current_company_id()
  and exists (
    select 1
    from public.jobsite_checklists c
    join public.jobsites j on j.id = c.jobsite_id
    where c.id = checklist_id
      and c.company_id = public.current_company_id()
      and c.archived_at is null
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "members read checklist item photos" on public.checklist_item_photos;
create policy "members read checklist item photos"
on public.checklist_item_photos for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and exists (
    select 1
    from public.jobsite_checklists c
    join public.jobsites j on j.id = c.jobsite_id
    where c.id = checklist_id
      and c.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "members insert checklist item photos" on public.checklist_item_photos;
create policy "members insert checklist item photos"
on public.checklist_item_photos for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and exists (
    select 1
    from public.jobsite_checklists c
    join public.jobsites j on j.id = c.jobsite_id
    where c.id = checklist_id
      and c.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "managers update checklist item photos" on public.checklist_item_photos;
create policy "managers update checklist item photos"
on public.checklist_item_photos for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

create or replace function public.validate_checklist_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  template_company uuid;
  checklist_company uuid;
  checklist_jobsite uuid;
begin
  if tg_table_name = 'checklist_template_items' then
    select company_id into template_company from public.checklist_templates where id = new.template_id;
    if not found then
      raise exception 'checklist_template_not_found';
    end if;
    if template_company is distinct from new.company_id then
      raise exception 'checklist_template_company_mismatch';
    end if;
  elsif tg_table_name = 'jobsite_checklists' then
    if not exists (
      select 1 from public.jobsites j
      where j.id = new.jobsite_id
        and j.company_id = new.company_id
        and j.archived_at is null
    ) then
      raise exception 'jobsite_not_found';
    end if;
    if new.template_id is not null and not exists (
      select 1 from public.checklist_templates t
      where t.id = new.template_id
        and t.archived_at is null
        and t.active
        and (t.company_id is null or t.company_id = new.company_id)
    ) then
      raise exception 'checklist_template_not_found';
    end if;
  elsif tg_table_name = 'jobsite_checklist_items' then
    select company_id, jobsite_id into checklist_company, checklist_jobsite
    from public.jobsite_checklists
    where id = new.checklist_id;
    if not found then
      raise exception 'jobsite_checklist_not_found';
    end if;
    if checklist_company <> new.company_id or checklist_jobsite <> new.jobsite_id then
      raise exception 'jobsite_checklist_company_mismatch';
    end if;
  elsif tg_table_name = 'checklist_item_photos' then
    select company_id, jobsite_id into checklist_company, checklist_jobsite
    from public.jobsite_checklists
    where id = new.checklist_id;
    if not found then
      raise exception 'jobsite_checklist_not_found';
    end if;
    if checklist_company <> new.company_id or checklist_jobsite <> new.jobsite_id then
      raise exception 'checklist_photo_company_mismatch';
    end if;
    if not exists (
      select 1 from public.jobsite_checklist_items i
      where i.id = new.checklist_item_id
        and i.checklist_id = new.checklist_id
        and i.company_id = new.company_id
        and i.jobsite_id = new.jobsite_id
        and i.archived_at is null
    ) then
      raise exception 'checklist_item_not_found';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_checklist_template_item_tenant on public.checklist_template_items;
create trigger validate_checklist_template_item_tenant
before insert or update on public.checklist_template_items
for each row execute function public.validate_checklist_tenant();

drop trigger if exists validate_jobsite_checklist_tenant on public.jobsite_checklists;
create trigger validate_jobsite_checklist_tenant
before insert or update on public.jobsite_checklists
for each row execute function public.validate_checklist_tenant();

drop trigger if exists validate_jobsite_checklist_item_tenant on public.jobsite_checklist_items;
create trigger validate_jobsite_checklist_item_tenant
before insert or update on public.jobsite_checklist_items
for each row execute function public.validate_checklist_tenant();

drop trigger if exists validate_checklist_item_photo_tenant on public.checklist_item_photos;
create trigger validate_checklist_item_photo_tenant
before insert or update on public.checklist_item_photos
for each row execute function public.validate_checklist_tenant();

create or replace function public.create_task_for_checklist_problem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  task_id uuid;
begin
  if new.status <> 'problem' or new.resolved_task_id is not null or new.archived_at is not null then
    return new;
  end if;

  insert into public.tasks (
    company_id,
    jobsite_id,
    title,
    description,
    due_date,
    status,
    created_by
  )
  values (
    new.company_id,
    new.jobsite_id,
    concat('Mangel/Problem: ', left(new.label, 120)),
    nullif(concat_ws(E'\n', new.problem_description, new.notes, concat('Aus Checklistenpunkt: ', new.label)), ''),
    current_date,
    'offen',
    auth.uid()
  )
  returning id into task_id;

  new.resolved_task_id := task_id;
  return new;
end;
$$;

drop trigger if exists create_task_for_checklist_problem on public.jobsite_checklist_items;
create trigger create_task_for_checklist_problem
before update on public.jobsite_checklist_items
for each row
when (new.status = 'problem' and new.resolved_task_id is null)
execute function public.create_task_for_checklist_problem();

drop trigger if exists set_checklist_templates_updated_at on public.checklist_templates;
create trigger set_checklist_templates_updated_at
before update on public.checklist_templates
for each row execute function public.set_updated_at();

drop trigger if exists set_checklist_template_items_updated_at on public.checklist_template_items;
create trigger set_checklist_template_items_updated_at
before update on public.checklist_template_items
for each row execute function public.set_updated_at();

drop trigger if exists set_jobsite_checklists_updated_at on public.jobsite_checklists;
create trigger set_jobsite_checklists_updated_at
before update on public.jobsite_checklists
for each row execute function public.set_updated_at();

drop trigger if exists set_jobsite_checklist_items_updated_at on public.jobsite_checklist_items;
create trigger set_jobsite_checklist_items_updated_at
before update on public.jobsite_checklist_items
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('checklist-photos', 'checklist-photos', false)
on conflict (id) do nothing;

drop policy if exists "members read checklist photos storage" on storage.objects;
create policy "members read checklist photos storage"
on storage.objects for select
to authenticated
using (
  bucket_id = 'checklist-photos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'checklists'
);

drop policy if exists "members upload checklist photos storage" on storage.objects;
create policy "members upload checklist photos storage"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'checklist-photos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'checklists'
);

drop policy if exists "managers delete checklist photos storage" on storage.objects;
create policy "managers delete checklist photos storage"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'checklist-photos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and public.can_manage_company()
);

-- Praxisnahe Standardvorlagen fuer neue Firmen, sichtbar fuer alle Mandanten.
with templates(name, category, description) as (
  values
    ('Arbeitssicherheit Dacharbeiten', 'arbeitssicherheit', 'Kurzer Sicherheitscheck vor Dacharbeiten.'),
    ('Baustart Standard', 'baustart', 'Vorbereitung beim Start einer Baustelle.'),
    ('Tagesabschluss Baustelle', 'tagesabschluss', 'Schneller Abschlusscheck zum Feierabend.'),
    ('Abnahme Dacharbeiten', 'abnahme', 'Nachweisorientierte Abnahme vor Uebergabe.'),
    ('Material Vollstaendigkeit', 'material', 'Material und Werkzeug fuer den Einsatz pruefen.'),
    ('Geruest / Leiter Pruefung', 'geruest', 'Sichtpruefung fuer Geruest, Leiter und Zugang.'),
    ('Dacharbeiten Qualitaet', 'dacharbeiten', 'Qualitaetscheck fuer typische Dacharbeiten.')
),
inserted as (
  insert into public.checklist_templates (company_id, name, category, description, active)
  select null, name, category, description, true
  from templates t
  where not exists (
    select 1 from public.checklist_templates existing
    where existing.company_id is null and existing.name = t.name and existing.category = t.category
  )
  returning id, name
)
insert into public.checklist_template_items (template_id, company_id, label, help_text, required, photo_required, sort_order)
select inserted.id, null, item.label, item.help_text, item.required, item.photo_required, item.sort_order
from inserted
join lateral (
  values
    ('Arbeitssicherheit Dacharbeiten', 'PSA vorhanden und getragen', 'Helm, Schuhe, Handschuhe, Absturzsicherung pruefen.', true, false, 10),
    ('Arbeitssicherheit Dacharbeiten', 'Absturzsicherung geprueft', 'Anschlagpunkte, Geruest, Seitenschutz oder Auffanggurt dokumentieren.', true, true, 20),
    ('Arbeitssicherheit Dacharbeiten', 'Wetter und Wind fuer Dacharbeiten passend', 'Bei Wind/Regen/Frost Problem markieren.', true, false, 30),
    ('Baustart Standard', 'Baustelle eingerichtet', 'Zugang, Absperrung und Lagerflaeche geklaert.', true, false, 10),
    ('Baustart Standard', 'Kunde/Ansprechpartner informiert', 'Start, Ablauf und Besonderheiten kurz abstimmen.', false, false, 20),
    ('Baustart Standard', 'Fotos vom Ausgangszustand erstellt', 'Vorher-Fotos als Nachweis speichern.', true, true, 30),
    ('Tagesabschluss Baustelle', 'Baustelle wetterfest gesichert', 'Folien, offene Flaechen, Material und Werkzeug sichern.', true, true, 10),
    ('Tagesabschluss Baustelle', 'Werkzeug und Material mitgenommen', 'Nichts offen liegen lassen.', true, false, 20),
    ('Tagesabschluss Baustelle', 'Tagesbericht/Zeiten vorbereitet', 'Fehlende Angaben sofort notieren.', false, false, 30),
    ('Abnahme Dacharbeiten', 'Leistung fachlich geprueft', 'Sichtpruefung, Anschluesse, Ortgang, First, Entwaesserung.', true, false, 10),
    ('Abnahme Dacharbeiten', 'Maengel dokumentiert oder ausgeschlossen', 'Problem markieren, wenn etwas offen ist.', true, true, 20),
    ('Abnahme Dacharbeiten', 'Kunde/Vertreter kann unterschreiben', 'Optional digitale Unterschrift erfassen.', false, false, 30),
    ('Material Vollstaendigkeit', 'Hauptmaterial vollstaendig', 'Ziegel/Bahn/Daemmung/Blech passend zur Planung.', true, false, 10),
    ('Material Vollstaendigkeit', 'Zubehoer vorhanden', 'Schrauben, Klammern, Dichtstoffe, Baender.', true, false, 20),
    ('Material Vollstaendigkeit', 'Fehlmaterial gemeldet', 'Problem markieren, wenn Bestand fehlt.', false, false, 30),
    ('Geruest / Leiter Pruefung', 'Stand sicher und frei', 'Untergrund, Sicherung, Zugang pruefen.', true, true, 10),
    ('Geruest / Leiter Pruefung', 'Sichtbare Schaeden ausgeschlossen', 'Defekte Leiter/Geruestteile sofort als Problem markieren.', true, true, 20),
    ('Dacharbeiten Qualitaet', 'Untergrund vorbereitet', 'Alte Lattung/Bahn/Anschluesse geprueft.', true, false, 10),
    ('Dacharbeiten Qualitaet', 'Anschluesse sauber ausgefuehrt', 'Wand, Kamin, Kehlbereich, Durchdringungen pruefen.', true, true, 20),
    ('Dacharbeiten Qualitaet', 'Fotos der fertigen Bereiche erstellt', 'Nachweisfotos direkt am Punkt speichern.', true, true, 30)
) as item(template_name, label, help_text, required, photo_required, sort_order)
on item.template_name = inserted.name;

select pg_notify('pgrst', 'reload schema');

-- Final hard-delete deny-list for checklist business data.
drop policy if exists "redteam managers delete fallback" on public.checklist_templates;
drop policy if exists "redteam managers delete fallback" on public.checklist_template_items;
drop policy if exists "redteam managers delete fallback" on public.jobsite_checklists;
drop policy if exists "redteam managers delete fallback" on public.jobsite_checklist_items;
drop policy if exists "redteam managers delete fallback" on public.checklist_item_photos;

select pg_notify('pgrst', 'reload schema');


-- -----------------------------------------------------------------------------
-- Maengelmanagement: defects, photos, due notifications and customer release.
-- Mirrors supabase/migrations/20260706_defect_management.sql.
-- -----------------------------------------------------------------------------

-- Mängelmanagement: Mängel, Schäden und offene Punkte mit Nachweis, Frist und Kundenfreigabe.

create table if not exists public.defects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'mittel' check (priority in ('niedrig', 'mittel', 'hoch', 'kritisch')),
  status text not null default 'offen' check (status in ('offen', 'in_arbeit', 'wartet_auf_kunde', 'erledigt', 'abgenommen')),
  assigned_to uuid references public.profiles(id) on delete set null,
  due_date date,
  visible_to_customer boolean not null default false,
  customer_released_at timestamptz,
  customer_released_by uuid references public.profiles(id) on delete set null,
  source_type text not null default 'manual' check (source_type in ('manual', 'photo', 'report', 'checklist', 'customer_message')),
  source_report_id uuid references public.reports(id) on delete set null,
  source_report_photo_id uuid references public.report_photos(id) on delete set null,
  source_checklist_id uuid references public.jobsite_checklists(id) on delete set null,
  source_checklist_item_id uuid references public.jobsite_checklist_items(id) on delete set null,
  source_customer_message_id uuid references public.customer_portal_messages(id) on delete set null,
  source_task_id uuid references public.tasks(id) on delete set null,
  closed_at timestamptz,
  accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.defect_photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  defect_id uuid not null references public.defects(id) on delete cascade,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  visible_to_customer boolean not null default false,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.defect_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  defect_id uuid not null references public.defects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  notification_type text not null check (notification_type in ('due_soon', 'overdue', 'status_changed')),
  title text not null,
  body text,
  due_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists defects_company_status_idx
  on public.defects(company_id, status, priority, due_date, archived_at, created_at desc);
create index if not exists defects_jobsite_idx
  on public.defects(company_id, jobsite_id, status, archived_at, created_at desc);
create index if not exists defects_assigned_idx
  on public.defects(company_id, assigned_to, status, due_date)
  where archived_at is null;
create index if not exists defects_customer_visible_idx
  on public.defects(company_id, jobsite_id, visible_to_customer, status, created_at desc)
  where archived_at is null;
create unique index if not exists defects_checklist_item_once_idx
  on public.defects(company_id, source_checklist_item_id)
  where source_checklist_item_id is not null and archived_at is null;
create index if not exists defect_photos_defect_idx
  on public.defect_photos(company_id, defect_id, archived_at, created_at desc);
create index if not exists defect_notifications_company_idx
  on public.defect_notifications(company_id, read_at, created_at desc)
  where archived_at is null;
create unique index if not exists defect_notifications_once_idx
  on public.defect_notifications(defect_id, notification_type, due_at)
  where archived_at is null;

alter table public.defects enable row level security;
alter table public.defect_photos enable row level security;
alter table public.defect_notifications enable row level security;
alter table public.defects force row level security;
alter table public.defect_photos force row level security;
alter table public.defect_notifications force row level security;

grant select, insert, update on public.defects to authenticated;
grant select, insert, update on public.defect_photos to authenticated;
grant select, insert, update on public.defect_notifications to authenticated;

drop policy if exists "members read relevant defects" on public.defects;
create policy "members read relevant defects"
on public.defects for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and exists (
    select 1
    from public.jobsites j
    where j.id = jobsite_id
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or assigned_to = auth.uid()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "members insert assigned jobsite defects" on public.defects;
create policy "members insert assigned jobsite defects"
on public.defects for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and exists (
    select 1
    from public.jobsites j
    where j.id = jobsite_id
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "members update relevant defects" on public.defects;
create policy "members update relevant defects"
on public.defects for update
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and exists (
    select 1
    from public.jobsites j
    where j.id = jobsite_id
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or assigned_to = auth.uid()
        or (public.current_role() = 'vorarbeiter' and auth.uid() = any(j.assigned_employee_ids))
      )
  )
)
with check (
  company_id = public.current_company_id()
  and exists (
    select 1
    from public.jobsites j
    where j.id = jobsite_id
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or assigned_to = auth.uid()
        or (public.current_role() = 'vorarbeiter' and auth.uid() = any(j.assigned_employee_ids))
      )
  )
);

drop policy if exists "members read relevant defect photos" on public.defect_photos;
create policy "members read relevant defect photos"
on public.defect_photos for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and exists (
    select 1 from public.defects d
    join public.jobsites j on j.id = d.jobsite_id
    where d.id = defect_id
      and d.company_id = public.current_company_id()
      and d.archived_at is null
      and (
        public.can_manage_company()
        or d.assigned_to = auth.uid()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "members insert relevant defect photos" on public.defect_photos;
create policy "members insert relevant defect photos"
on public.defect_photos for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and exists (
    select 1 from public.defects d
    join public.jobsites j on j.id = d.jobsite_id
    where d.id = defect_id
      and d.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or d.assigned_to = auth.uid()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "managers update defect photos" on public.defect_photos;
create policy "managers update defect photos"
on public.defect_photos for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "members read relevant defect notifications" on public.defect_notifications;
create policy "members read relevant defect notifications"
on public.defect_notifications for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and (
    public.can_manage_company()
    or user_id = auth.uid()
    or exists (
      select 1 from public.defects d
      where d.id = defect_id
        and d.company_id = public.current_company_id()
        and d.assigned_to = auth.uid()
    )
  )
);

drop policy if exists "members update own defect notifications" on public.defect_notifications;
create policy "members update own defect notifications"
on public.defect_notifications for update
to authenticated
using (company_id = public.current_company_id() and (public.can_manage_company() or user_id = auth.uid()))
with check (company_id = public.current_company_id() and (public.can_manage_company() or user_id = auth.uid()));

create or replace function public.validate_defect_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  defect_company uuid;
  defect_jobsite uuid;
begin
  if tg_table_name = 'defects' then
    if not exists (
      select 1 from public.jobsites j
      where j.id = new.jobsite_id
        and j.company_id = new.company_id
        and j.archived_at is null
    ) then
      raise exception 'defect_jobsite_not_found';
    end if;

    if new.assigned_to is not null and not exists (
      select 1 from public.profiles p
      where p.id = new.assigned_to
        and p.company_id = new.company_id
        and p.active
        and p.role in ('vorarbeiter', 'mitarbeiter')
    ) then
      raise exception 'defect_assignee_not_found';
    end if;

    if new.source_report_id is not null and not exists (
      select 1 from public.reports r
      where r.id = new.source_report_id
        and r.company_id = new.company_id
        and r.jobsite_id = new.jobsite_id
        and r.archived_at is null
    ) then
      raise exception 'defect_report_source_invalid';
    end if;

    if new.source_report_photo_id is not null and not exists (
      select 1 from public.report_photos rp
      where rp.id = new.source_report_photo_id
        and rp.company_id = new.company_id
        and rp.jobsite_id = new.jobsite_id
        and rp.archived_at is null
    ) then
      raise exception 'defect_report_photo_source_invalid';
    end if;

    if new.source_checklist_id is not null and not exists (
      select 1 from public.jobsite_checklists c
      where c.id = new.source_checklist_id
        and c.company_id = new.company_id
        and c.jobsite_id = new.jobsite_id
        and c.archived_at is null
    ) then
      raise exception 'defect_checklist_source_invalid';
    end if;

    if new.source_checklist_item_id is not null and not exists (
      select 1 from public.jobsite_checklist_items ci
      where ci.id = new.source_checklist_item_id
        and ci.company_id = new.company_id
        and ci.jobsite_id = new.jobsite_id
        and ci.archived_at is null
    ) then
      raise exception 'defect_checklist_item_source_invalid';
    end if;

    if new.source_customer_message_id is not null and not exists (
      select 1 from public.customer_portal_messages m
      where m.id = new.source_customer_message_id
        and m.company_id = new.company_id
        and m.jobsite_id = new.jobsite_id
    ) then
      raise exception 'defect_customer_message_source_invalid';
    end if;

    if not public.can_manage_company() then
      if tg_op = 'UPDATE' and (
        new.jobsite_id is distinct from old.jobsite_id
        or new.assigned_to is distinct from old.assigned_to
        or new.due_date is distinct from old.due_date
        or new.visible_to_customer is distinct from old.visible_to_customer
        or new.customer_released_at is distinct from old.customer_released_at
        or new.customer_released_by is distinct from old.customer_released_by
        or new.source_report_id is distinct from old.source_report_id
        or new.source_report_photo_id is distinct from old.source_report_photo_id
        or new.source_checklist_id is distinct from old.source_checklist_id
        or new.source_checklist_item_id is distinct from old.source_checklist_item_id
        or new.source_customer_message_id is distinct from old.source_customer_message_id
      ) then
        raise exception 'restricted_defect_update';
      end if;
    end if;

    if new.status in ('erledigt', 'abgenommen') then
      if tg_op = 'INSERT' or old.status is distinct from new.status then
        new.closed_at := coalesce(new.closed_at, now());
      end if;
    end if;
    if new.status = 'abgenommen' then
      if tg_op = 'INSERT' or old.status is distinct from 'abgenommen' then
        new.accepted_at := coalesce(new.accepted_at, now());
      end if;
    end if;
  elsif tg_table_name = 'defect_photos' then
    select company_id, jobsite_id into defect_company, defect_jobsite
    from public.defects
    where id = new.defect_id;
    if not found then
      raise exception 'defect_not_found';
    end if;
    if defect_company <> new.company_id or defect_jobsite <> new.jobsite_id then
      raise exception 'defect_photo_company_mismatch';
    end if;
    if not public.can_manage_company() and tg_op = 'UPDATE' and new.visible_to_customer is distinct from old.visible_to_customer then
      raise exception 'restricted_defect_photo_update';
    end if;
  elsif tg_table_name = 'defect_notifications' then
    select company_id into defect_company
    from public.defects
    where id = new.defect_id;
    if not found then
      raise exception 'defect_not_found';
    end if;
    if defect_company <> new.company_id then
      raise exception 'defect_notification_company_mismatch';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_defects_tenant on public.defects;
create trigger validate_defects_tenant
before insert or update on public.defects
for each row execute function public.validate_defect_tenant();

drop trigger if exists validate_defect_photos_tenant on public.defect_photos;
create trigger validate_defect_photos_tenant
before insert or update on public.defect_photos
for each row execute function public.validate_defect_tenant();

drop trigger if exists validate_defect_notifications_tenant on public.defect_notifications;
create trigger validate_defect_notifications_tenant
before insert or update on public.defect_notifications
for each row execute function public.validate_defect_tenant();

drop trigger if exists set_defects_updated_at on public.defects;
create trigger set_defects_updated_at
before update on public.defects
for each row execute function public.set_updated_at();

create or replace function public.create_defect_due_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_kind text;
  notification_title text;
begin
  if new.archived_at is not null or new.status in ('erledigt', 'abgenommen') or new.due_date is null then
    return new;
  end if;

  if new.due_date < current_date then
    notification_kind := 'overdue';
    notification_title := 'Mangel-Frist ueberfaellig';
  elsif new.due_date <= current_date + 1 then
    notification_kind := 'due_soon';
    notification_title := 'Mangel-Frist naht';
  else
    return new;
  end if;

  insert into public.defect_notifications (
    company_id,
    defect_id,
    user_id,
    notification_type,
    title,
    body,
    due_at
  )
  values (
    new.company_id,
    new.id,
    new.assigned_to,
    notification_kind,
    notification_title,
    new.title,
    new.due_date::timestamptz
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists create_defect_due_notification on public.defects;
create trigger create_defect_due_notification
after insert or update of due_date, status, assigned_to, archived_at on public.defects
for each row execute function public.create_defect_due_notification();

create or replace function public.create_defect_from_checklist_problem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'problem' or new.archived_at is not null then
    return new;
  end if;

  insert into public.defects (
    company_id,
    jobsite_id,
    title,
    description,
    priority,
    status,
    assigned_to,
    due_date,
    source_type,
    source_checklist_id,
    source_checklist_item_id,
    source_task_id,
    created_by
  )
  values (
    new.company_id,
    new.jobsite_id,
    left(concat('Mangel: ', new.label), 180),
    nullif(concat_ws(E'\n', new.problem_description, new.notes, concat('Aus Checklistenpunkt: ', new.label)), ''),
    'hoch',
    'offen',
    null,
    current_date + 3,
    'checklist',
    new.checklist_id,
    new.id,
    new.resolved_task_id,
    auth.uid()
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists create_defect_from_checklist_problem on public.jobsite_checklist_items;
create trigger create_defect_from_checklist_problem
after update on public.jobsite_checklist_items
for each row
when (new.status = 'problem')
execute function public.create_defect_from_checklist_problem();

insert into storage.buckets (id, name, public)
values ('defect-photos', 'defect-photos', false)
on conflict (id) do nothing;

drop policy if exists "members read defect photos storage" on storage.objects;
create policy "members read defect photos storage"
on storage.objects for select
to authenticated
using (
  bucket_id = 'defect-photos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'defects'
);

drop policy if exists "members upload defect photos storage" on storage.objects;
create policy "members upload defect photos storage"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'defect-photos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'defects'
);

drop policy if exists "managers delete defect photos storage" on storage.objects;
create policy "managers delete defect photos storage"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'defect-photos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and public.can_manage_company()
);

-- Protected business data: no hard delete fallback for defects.
drop policy if exists "redteam managers delete fallback" on public.defects;
drop policy if exists "redteam managers delete fallback" on public.defect_photos;
drop policy if exists "redteam managers delete fallback" on public.defect_notifications;

-- Performance follow-up indexes for mobile-first SaaS surfaces.
create index if not exists idx_planning_assignments_company_status_period on public.planning_assignments (company_id, status, start_date, end_date) where archived_at is null;
create index if not exists idx_planning_assignments_company_resource_period on public.planning_assignments (company_id, resource_type, start_date, end_date) where archived_at is null;
create index if not exists idx_planning_resources_company_status_kind on public.planning_resources (company_id, status, resource_kind, name) where archived_at is null;
create index if not exists idx_planning_weather_checks_assignment_period on public.planning_weather_checks (company_id, planning_assignment_id, period_start, period_end);
create index if not exists idx_planning_weather_checks_jobsite_risk on public.planning_weather_checks (company_id, jobsite_id, risk_level, fetched_at desc);
create index if not exists idx_material_movements_company_jobsite_created on public.material_movements (company_id, jobsite_id, created_at desc) where jobsite_id is not null;
create index if not exists idx_material_movements_company_inventory_created on public.material_movements (company_id, inventory_item_id, created_at desc);
create index if not exists idx_material_reservations_company_bring_status on public.material_reservations (company_id, bring_list_id, status) where bring_list_id is not null;
create index if not exists idx_material_reservations_company_inventory_status on public.material_reservations (company_id, inventory_item_id, status) where inventory_item_id is not null;
create index if not exists idx_material_usage_reports_company_status_created on public.material_usage_reports (company_id, status, created_at desc);
create index if not exists idx_material_usage_reports_company_jobsite_status on public.material_usage_reports (company_id, jobsite_id, status) where jobsite_id is not null;
create index if not exists idx_delivery_notes_company_status_created on public.delivery_notes (company_id, status, created_at desc);
create index if not exists idx_delivery_note_items_company_note_created on public.delivery_note_items (company_id, delivery_note_id, created_at);
create index if not exists idx_delivery_note_items_company_inventory on public.delivery_note_items (company_id, inventory_item_id) where inventory_item_id is not null;
create index if not exists idx_delivery_note_item_prices_company_item on public.delivery_note_item_prices (company_id, delivery_note_item_id);
create index if not exists idx_jobsite_checklists_company_status_created on public.jobsite_checklists (company_id, status, created_at desc) where archived_at is null;
create index if not exists idx_jobsite_checklists_company_due on public.jobsite_checklists (company_id, due_date, status) where archived_at is null and due_date is not null;
create index if not exists idx_jobsite_checklist_items_checklist_order on public.jobsite_checklist_items (checklist_id, sort_order) where archived_at is null;
create index if not exists idx_jobsite_checklist_items_company_status on public.jobsite_checklist_items (company_id, status, updated_at desc) where archived_at is null;
create index if not exists idx_checklist_item_photos_company_item_created on public.checklist_item_photos (company_id, checklist_item_id, created_at desc) where archived_at is null;
create index if not exists idx_defects_company_due_status on public.defects (company_id, due_date, status, priority) where archived_at is null and due_date is not null;
create index if not exists idx_defects_company_customer_visible on public.defects (company_id, jobsite_id, visible_to_customer, created_at desc) where archived_at is null;
create index if not exists idx_defect_photos_company_defect_created on public.defect_photos (company_id, defect_id, created_at desc) where archived_at is null;
create index if not exists idx_defect_notifications_company_user_read_due on public.defect_notifications (company_id, user_id, read_at, due_at) where archived_at is null;
create index if not exists idx_supplier_offers_company_provider_checked on public.supplier_offers (company_id, provider_key, last_checked_at desc);
create index if not exists idx_supplier_offers_company_total_price on public.supplier_offers (company_id, total_price_gross);
create index if not exists idx_supplier_offer_matches_company_material_score on public.supplier_offer_matches (company_id, material_id, match_score desc);
create index if not exists idx_online_price_discoveries_company_material_created on public.online_price_discoveries (company_id, material_id, created_at desc);
create index if not exists idx_online_price_offers_company_discovery_price on public.online_price_offers (company_id, discovery_id, total_price_gross);
create index if not exists idx_customer_portal_events_company_jobsite_date on public.customer_portal_events (company_id, jobsite_id, event_date desc) where visible_to_customer = true;
create index if not exists idx_customer_documents_company_jobsite_created on public.customer_documents (company_id, jobsite_id, created_at desc) where visible_to_customer = true;
create index if not exists idx_customer_portal_messages_company_status_created on public.customer_portal_messages (company_id, status, created_at desc);
create index if not exists idx_order_measurement_items_company_order_created on public.order_measurement_items (company_id, order_id, created_at) where archived_at is null;
create index if not exists idx_job_material_calculations_company_jobsite_created on public.job_material_calculations (company_id, jobsite_id, created_at desc);
create index if not exists idx_job_material_calculation_items_company_calc on public.job_material_calculation_items (company_id, calculation_id);
create index if not exists idx_job_material_requirements_company_order_active on public.job_material_requirements (company_id, order_id, created_at desc) where archived_at is null;
create index if not exists idx_privacy_requests_company_status_due on public.privacy_requests (company_id, status, due_at);

-- BauPro final privacy/security hardening:
-- Jede Mandantentabelle mit company_id wird am Ende des Vollschemas erneut auf FORCE RLS gesetzt.
do $$
declare
  tenant_table record;
begin
  for tenant_table in
    select table_schema, table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'company_id'
      and table_name not like 'pg_%'
  loop
    execute format('alter table %I.%I enable row level security', tenant_table.table_schema, tenant_table.table_name);
    execute format('alter table %I.%I force row level security', tenant_table.table_schema, tenant_table.table_name);
  end loop;
end $$;

alter table if exists public.companies enable row level security;
alter table if exists public.companies force row level security;

comment on table public.company_audit_log is
  'Audit-Log fuer kritische Aktionen. Datenschutz-/Firmenexporte loggen nur Metadaten, keine exportierten personenbezogenen Inhalte.';

comment on column public.materials.purchase_price is
  'EK-Preis: darf nur ueber Chef-Views, Server Actions oder eingeschraenkte Firmenexports sichtbar sein.';
comment on column public.materials.sales_price is
  'VK-Preis: darf nur ueber Chef-Views, Server Actions oder eingeschraenkte Firmenexports sichtbar sein.';
comment on column public.inventory_items.purchase_price is
  'EK-Preis: darf niemals an Mitarbeiter-, Vorarbeiter- oder Kundenportal-Responses ausgeliefert werden.';
comment on column public.inventory_items.sales_price is
  'VK-Preis: darf niemals an Mitarbeiter-, Vorarbeiter- oder Kundenportal-Responses ausgeliefert werden.';
comment on column public.inventory_items.markup_percent is
  'Marge/Aufschlag: nur fuer Chef, nicht fuer Mitarbeiter/Vorarbeiter/Kundenportal.';

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  type text not null check (type in ('angebot', 'rechnung', 'gutschrift')),
  status text not null default 'entwurf' check (status in ('entwurf', 'gesendet', 'bezahlt', 'storniert')),
  invoice_number text not null,
  issue_date date not null default current_date,
  due_date date,
  subtotal_eur numeric(12, 2) not null default 0,
  tax_rate_percent numeric(7, 2) not null default 19 check (tax_rate_percent in (0, 7, 19)),
  tax_eur numeric(12, 2) not null default 0,
  total_eur numeric(12, 2) not null default 0,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (company_id, invoice_number)
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit text not null default 'Stueck',
  unit_price_eur numeric(12, 2) not null default 0 check (unit_price_eur >= 0),
  total_eur numeric(12, 2) generated always as (
    round(coalesce(quantity, 0) * coalesce(unit_price_eur, 0), 2)
  ) stored,
  position integer not null default 1,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists invoices_company_type_status_idx
  on public.invoices(company_id, type, status, issue_date desc)
  where archived_at is null;
create index if not exists invoices_company_customer_idx
  on public.invoices(company_id, customer_id, created_at desc)
  where archived_at is null;
create index if not exists invoices_company_order_idx
  on public.invoices(company_id, order_id, created_at desc)
  where archived_at is null;
create index if not exists invoice_items_invoice_position_idx
  on public.invoice_items(invoice_id, position)
  where archived_at is null;

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoices force row level security;
alter table public.invoice_items force row level security;

grant select, insert, update on public.invoices to authenticated;
grant select, insert, update, delete on public.invoice_items to authenticated;

drop policy if exists "managers read invoices" on public.invoices;
create policy "managers read invoices"
on public.invoices for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "creators read own invoices" on public.invoices;
create policy "creators read own invoices"
on public.invoices for select
to authenticated
using (company_id = public.current_company_id() and created_by = auth.uid());

drop policy if exists "managers insert invoices" on public.invoices;
create policy "managers insert invoices"
on public.invoices for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update invoices" on public.invoices;
create policy "managers update invoices"
on public.invoices for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers read invoice items" on public.invoice_items;
create policy "managers read invoice items"
on public.invoice_items for select
to authenticated
using (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.company_id = public.current_company_id()
      and public.can_manage_company()
  )
);

drop policy if exists "creators read own invoice items" on public.invoice_items;
create policy "creators read own invoice items"
on public.invoice_items for select
to authenticated
using (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.company_id = public.current_company_id()
      and i.created_by = auth.uid()
  )
);

drop policy if exists "managers insert invoice items" on public.invoice_items;
create policy "managers insert invoice items"
on public.invoice_items for insert
to authenticated
with check (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.company_id = public.current_company_id()
      and public.can_manage_company()
  )
);

drop policy if exists "managers update invoice items" on public.invoice_items;
create policy "managers update invoice items"
on public.invoice_items for update
to authenticated
using (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.company_id = public.current_company_id()
      and public.can_manage_company()
  )
)
with check (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.company_id = public.current_company_id()
      and public.can_manage_company()
  )
);

drop policy if exists "managers delete invoice items" on public.invoice_items;
create policy "managers delete invoice items"
on public.invoice_items for delete
to authenticated
using (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.company_id = public.current_company_id()
      and public.can_manage_company()
  )
);

drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create or replace function public.generate_invoice_number(p_company_id uuid, p_type text default 'rechnung')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_year text := to_char(current_date, 'YYYY');
  prefix text;
  last_number int;
begin
  if p_type = 'angebot' then
    prefix := 'AN-' || current_year || '-';
  elsif p_type = 'gutschrift' then
    prefix := 'GS-' || current_year || '-';
  else
    prefix := 'RE-' || current_year || '-';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_company_id::text || ':' || prefix));

  select coalesce(max(nullif(regexp_replace(invoice_number, '^.*-', ''), '')::int), 0)
  into last_number
  from public.invoices
  where company_id = p_company_id
    and invoice_number like prefix || '%';

  return prefix || lpad((last_number + 1)::text, 4, '0');
end;
$$;

create or replace function public.recalculate_invoice_totals(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  subtotal numeric(12, 2);
  tax_rate numeric(7, 2);
begin
  select coalesce(sum(total_eur), 0)
  into subtotal
  from public.invoice_items
  where invoice_id = p_invoice_id
    and archived_at is null;

  select tax_rate_percent
  into tax_rate
  from public.invoices
  where id = p_invoice_id;

  update public.invoices
  set
    subtotal_eur = subtotal,
    tax_eur = round(subtotal * coalesce(tax_rate, 19) / 100, 2),
    total_eur = round(subtotal * (1 + coalesce(tax_rate, 19) / 100), 2)
  where id = p_invoice_id;
end;
$$;

create or replace function public.recalculate_invoice_totals_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_invoice_totals(coalesce(new.invoice_id, old.invoice_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists recalculate_invoice_totals_on_items on public.invoice_items;
create trigger recalculate_invoice_totals_on_items
after insert or update or delete on public.invoice_items
for each row execute function public.recalculate_invoice_totals_trigger();

grant execute on function public.generate_invoice_number(uuid, text) to authenticated;
grant execute on function public.recalculate_invoice_totals(uuid) to authenticated;

create or replace function public.insert_invoice_items_from_json(p_invoice_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Bitte mindestens eine Position erfassen.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as parsed(item)
    where btrim(coalesce(item->>'description', '')) = ''
      or coalesce(nullif(item->>'quantity', '')::numeric, 0) <= 0
      or coalesce(nullif(item->>'unit_price_eur', '')::numeric, 0) < 0
  ) then
    raise exception 'Belegpositionen sind ungueltig.';
  end if;

  insert into public.invoice_items (
    invoice_id,
    description,
    quantity,
    unit,
    unit_price_eur,
    position
  )
  select
    p_invoice_id,
    left(btrim(item->>'description'), 1000),
    (item->>'quantity')::numeric,
    left(coalesce(nullif(btrim(item->>'unit'), ''), 'Stueck'), 40),
    coalesce(nullif(item->>'unit_price_eur', '')::numeric, 0),
    coalesce(nullif(item->>'position', '')::int, ordinality::int)
  from jsonb_array_elements(p_items) with ordinality as parsed(item, ordinality);
end;
$$;

create or replace function public.create_invoice_with_items(
  p_company_id uuid,
  p_customer_id uuid,
  p_order_id uuid,
  p_type text,
  p_issue_date date,
  p_due_date date,
  p_tax_rate_percent numeric,
  p_notes text,
  p_created_by uuid,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_invoice_id uuid;
  invoice_number text;
begin
  if p_company_id is distinct from public.current_company_id() or not public.can_manage_company() then
    raise exception 'Keine Berechtigung fuer diesen Beleg.';
  end if;

  if p_type not in ('angebot', 'rechnung', 'gutschrift') then
    raise exception 'Ungueltiger Belegtyp.';
  end if;

  if p_tax_rate_percent not in (0, 7, 19) then
    raise exception 'Ungueltiger MwSt.-Satz.';
  end if;

  if not exists (
    select 1 from public.customers
    where id = p_customer_id
      and company_id = p_company_id
      and archived_at is null
  ) then
    raise exception 'Kunde wurde nicht gefunden.';
  end if;

  if p_order_id is not null and not exists (
    select 1 from public.orders
    where id = p_order_id
      and company_id = p_company_id
      and customer_id = p_customer_id
      and archived_at is null
  ) then
    raise exception 'Auftrag wurde nicht gefunden.';
  end if;

  invoice_number := public.generate_invoice_number(p_company_id, p_type);

  insert into public.invoices (
    company_id,
    customer_id,
    order_id,
    type,
    status,
    invoice_number,
    issue_date,
    due_date,
    tax_rate_percent,
    notes,
    created_by
  )
  values (
    p_company_id,
    p_customer_id,
    p_order_id,
    p_type,
    'entwurf',
    invoice_number,
    p_issue_date,
    p_due_date,
    p_tax_rate_percent,
    nullif(btrim(coalesce(p_notes, '')), ''),
    p_created_by
  )
  returning id into created_invoice_id;

  perform public.insert_invoice_items_from_json(created_invoice_id, p_items);
  perform public.recalculate_invoice_totals(created_invoice_id);

  return created_invoice_id;
end;
$$;

create or replace function public.update_invoice_with_items(
  p_invoice_id uuid,
  p_company_id uuid,
  p_customer_id uuid,
  p_order_id uuid,
  p_type text,
  p_issue_date date,
  p_due_date date,
  p_tax_rate_percent numeric,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
begin
  if p_company_id is distinct from public.current_company_id() or not public.can_manage_company() then
    raise exception 'Keine Berechtigung fuer diesen Beleg.';
  end if;

  select status
  into current_status
  from public.invoices
  where id = p_invoice_id
    and company_id = p_company_id
    and archived_at is null
  for update;

  if current_status is null then
    raise exception 'Beleg wurde nicht gefunden.';
  end if;

  if current_status <> 'entwurf' then
    raise exception 'Nur Entwuerfe koennen bearbeitet werden.';
  end if;

  if p_type not in ('angebot', 'rechnung', 'gutschrift') then
    raise exception 'Ungueltiger Belegtyp.';
  end if;

  if p_tax_rate_percent not in (0, 7, 19) then
    raise exception 'Ungueltiger MwSt.-Satz.';
  end if;

  if not exists (
    select 1 from public.customers
    where id = p_customer_id
      and company_id = p_company_id
      and archived_at is null
  ) then
    raise exception 'Kunde wurde nicht gefunden.';
  end if;

  if p_order_id is not null and not exists (
    select 1 from public.orders
    where id = p_order_id
      and company_id = p_company_id
      and customer_id = p_customer_id
      and archived_at is null
  ) then
    raise exception 'Auftrag wurde nicht gefunden.';
  end if;

  update public.invoices
  set
    customer_id = p_customer_id,
    order_id = p_order_id,
    type = p_type,
    issue_date = p_issue_date,
    due_date = p_due_date,
    tax_rate_percent = p_tax_rate_percent,
    notes = nullif(btrim(coalesce(p_notes, '')), '')
  where id = p_invoice_id
    and company_id = p_company_id;

  update public.invoice_items
  set archived_at = now()
  where invoice_id = p_invoice_id
    and archived_at is null;

  perform public.insert_invoice_items_from_json(p_invoice_id, p_items);
  perform public.recalculate_invoice_totals(p_invoice_id);

  return p_invoice_id;
end;
$$;

create or replace function public.get_invoice_stats(p_company_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_company_id = public.current_company_id() and public.can_manage_company() then (
      select jsonb_build_object(
        'open_count', count(*) filter (where status in ('entwurf', 'gesendet')),
        'paid_count', count(*) filter (where status = 'bezahlt'),
        'total_gross', coalesce(sum(total_eur), 0)
      )
      from public.invoices
      where company_id = p_company_id
        and archived_at is null
    )
    else jsonb_build_object('open_count', 0, 'paid_count', 0, 'total_gross', 0)
  end
$$;

revoke all on function public.insert_invoice_items_from_json(uuid, jsonb) from public;
grant execute on function public.create_invoice_with_items(uuid, uuid, uuid, text, date, date, numeric, text, uuid, jsonb) to authenticated;
grant execute on function public.update_invoice_with_items(uuid, uuid, uuid, uuid, text, date, date, numeric, text, jsonb) to authenticated;
grant execute on function public.get_invoice_stats(uuid) to authenticated;

create unique index if not exists suppliers_company_lower_name_unique_idx
on public.suppliers (company_id, lower(trim(name)))
where active is true;

create unique index if not exists time_reports_company_employee_period_unique_idx
on public.time_reports (company_id, coalesce(employee_id, '00000000-0000-0000-0000-000000000000'::uuid), year, month)
where status <> 'archived';

select pg_notify('pgrst', 'reload schema');
