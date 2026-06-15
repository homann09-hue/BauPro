export type Role = "admin" | "chef" | "vorarbeiter" | "mitarbeiter";
export type JobsiteStatus = "geplant" | "aktiv" | "abgeschlossen";
export type MaterialLocation = "Lager" | "Fahrzeug" | "Baustelle";
export type InventoryLocationType = "Hauptlager" | "Fahrzeuglager" | "Baustelle" | "Container" | "Werkstatt";
export type RoofType = "steildach" | "flachdach" | "reparatur" | "entwaesserung" | "blech";
export type CustomerType = "privatkunde" | "gewerbekunde" | "hausverwaltung" | "architekt" | "versicherung";
export type CustomerStatus = "aktiv" | "inaktiv";
export type OrderType = "steildach" | "flachdach" | "reparatur" | "dachrinne" | "blech" | "wartung" | "sonstiges";
export type OrderStatus = "anfrage" | "angebot" | "geplant" | "in_arbeit" | "fertig" | "abgerechnet";
export type OrderPriority = "niedrig" | "normal" | "hoch";
export type SupplierIntegrationType = "api" | "csv" | "affiliate_feed" | "manual";
export type SupplierProviderKey =
  | "idealo"
  | "geizhals"
  | "google_shopping"
  | "amazon_business"
  | "ebay"
  | "contorion"
  | "hornbach"
  | "bauhaus"
  | "obi"
  | "wuerth"
  | "spax"
  | "fischer"
  | "manual"
  | "csv";
export type SupplierOfferSourceType = "api" | "csv" | "affiliate_feed" | "manual";
export type OnlinePriceSourceKey =
  | "idealo"
  | "geizhals"
  | "ebay"
  | "amazon"
  | "contorion"
  | "toolineo"
  | "custom_feed"
  | "priceapi"
  | "dataforseo_google_shopping"
  | "searchapi_google_shopping"
  | "wuerth_catalog_csv"
  | "manual_csv"
  | "market_reference";
export type OnlinePriceDiscoveryStatus = "completed" | "no_results" | "partial_error";
export type TimeEntryStatus = "draft" | "submitted" | "approved" | "rejected";
export type TimeReportStatus = "generated" | "approved" | "archived";
export type VoiceIntent = "bring_list" | "time_tracking" | "material_alert" | "job_note" | "unknown";
export type VoiceNoteStatus = "draft" | "confirmed" | "discarded";
export type BringListStatus = "draft" | "ready" | "packed" | "delivered";
export type BringListItemType = "material" | "tool" | "document" | "safety" | "other";
export type MaterialReservationStatus = "open" | "reserved" | "partially_reserved" | "missing" | "consumed" | "cancelled";
export type MaterialAlertType = "low_stock" | "out_of_stock" | "missing_for_job" | "below_minimum_after_reservation";
export type MaterialAlertSeverity = "info" | "warning" | "critical";
export type MaterialAlertStatus = "open" | "acknowledged" | "resolved";
export type PurchaseSuggestionStatus = "open" | "ordered" | "ignored" | "received";
export type TaskStatus = "offen" | "in_arbeit" | "erledigt";

export type Company = {
  id: string;
  name: string;
  contact_email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  tax_id?: string | null;
  payment_terms?: string | null;
  onboarding_completed_at?: string | null;
};

export type Profile = {
  id: string;
  company_id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  active: boolean;
  companies?: Company | null;
};

export type Jobsite = {
  id: string;
  company_id: string;
  name: string;
  customer: string;
  address: string;
  start_date: string | null;
  status: JobsiteStatus;
  notes: string | null;
  assigned_employee_ids: string[];
  created_at: string;
};

export type Customer = {
  id: string;
  company_id: string;
  customer_type: CustomerType;
  company: string | null;
  first_name: string | null;
  last_name: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  billing_address: string | null;
  jobsite_address: string | null;
  notes: string | null;
  tax_id: string | null;
  payment_terms: string | null;
  status: CustomerStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Order = {
  id: string;
  company_id: string;
  customer_id: string;
  jobsite_id: string | null;
  order_number: string;
  title: string;
  order_type: OrderType;
  status: OrderStatus;
  priority: OrderPriority;
  jobsite_address: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  internal_notes: string | null;
  assigned_employee_ids: string[];
  has_dimensions: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customers?: Pick<Customer, "id" | "company" | "first_name" | "last_name" | "contact_person" | "phone" | "email"> | null;
  jobsites?: Pick<Jobsite, "id" | "name" | "address" | "customer"> | null;
};

export type PublicOrder = Omit<Order, "internal_notes" | "customers" | "jobsites"> & {
  customer_name: string | null;
};

export type JobDimension = {
  id: string;
  company_id: string;
  order_id: string;
  length_m: number | null;
  width_m: number | null;
  area_m2: number;
  roof_pitch: number | null;
  eaves_length_m: number | null;
  ridge_length_m: number | null;
  verge_length_m: number | null;
  valley_length_m: number | null;
  wall_connection_length_m: number | null;
  building_height_m: number | null;
  downpipe_length_m: number | null;
  roof_windows_count: number;
  penetrations_count: number;
  roof_drains_count: number;
  emergency_overflows_count: number;
  waste_percent: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Report = {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  report_date: string;
  weather: string | null;
  work_start: string | null;
  work_end: string | null;
  employee_ids: string[];
  activities: string;
  material_usage: string | null;
  issues: string | null;
  signature_name: string | null;
  created_by: string | null;
  created_at: string;
  jobsites?: Pick<Jobsite, "id" | "name" | "address" | "customer"> | null;
};

export type ReportPhoto = {
  id: string;
  report_id: string;
  storage_path: string;
  file_name: string;
  content_type: string | null;
  created_at: string;
  signedUrl?: string;
};

export type Material = {
  id: string;
  company_id: string;
  name: string;
  category: string | null;
  unit: string;
  stock: number;
  minimum_stock: number;
  location: MaterialLocation;
  purchase_price: number | null;
  sales_price: number | null;
};

export type MaterialCategory = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  active: boolean;
};

export type MaterialSubcategory = {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  sort_order: number;
  active: boolean;
};

export type MaterialCatalogItem = {
  id: string;
  category_id: string | null;
  subcategory_id: string | null;
  name: string;
  unit: string;
  package_unit: string | null;
  default_minimum_stock: number;
  short_description: string | null;
  search_terms: string[];
  typical_use: string | null;
  manufacturer: string | null;
  article_number: string | null;
  ean: string | null;
  purchase_price: number | null;
  sales_price: number | null;
  markup_percent: number;
  sales_unit: string | null;
  price_per_unit: number | null;
  last_price_changed_at: string | null;
  popularity: number;
  active: boolean;
  material_categories?: Pick<MaterialCategory, "id" | "name" | "slug"> | null;
  material_subcategories?: Pick<MaterialSubcategory, "id" | "name" | "slug"> | null;
};

export type InventoryLocation = {
  id: string;
  company_id: string;
  name: string;
  location_type: InventoryLocationType;
  notes: string | null;
  active: boolean;
};

export type Supplier = {
  id: string;
  company_id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
};

export type InventoryItem = {
  id: string;
  company_id: string;
  catalog_item_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  location_id: string | null;
  supplier_id: string | null;
  name: string;
  unit: string;
  stock: number;
  minimum_stock: number;
  package_unit: string | null;
  manufacturer: string | null;
  article_number: string | null;
  ean: string | null;
  purchase_price: number | null;
  sales_price: number | null;
  markup_percent: number;
  sales_unit: string | null;
  price_per_unit: number | null;
  last_price_changed_at: string | null;
  notes: string | null;
  created_by: string | null;
  inventory_locations?: Pick<InventoryLocation, "id" | "name" | "location_type"> | null;
  material_categories?: Pick<MaterialCategory, "id" | "name" | "slug"> | null;
  material_subcategories?: Pick<MaterialSubcategory, "id" | "name" | "slug"> | null;
  suppliers?: Pick<Supplier, "id" | "name"> | null;
};

export type PublicInventoryItem = {
  id: string;
  company_id: string;
  catalog_item_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  location_id: string | null;
  name: string;
  unit: string;
  stock: number;
  minimum_stock: number;
  package_unit: string | null;
  manufacturer: string | null;
  article_number: string | null;
  notes: string | null;
  location_name: string | null;
  location_type: InventoryLocationType | null;
  category_name: string | null;
  subcategory_name: string | null;
};

export type CompanyPricingSettings = {
  company_id: string;
  waste_percent: number;
  default_markup_percent: number;
  auto_calculate_sales_price: boolean;
};

export type MaterialCalculationRule = {
  id: string;
  company_id: string | null;
  rule_key: string;
  roof_type: RoofType;
  name: string;
  material_name: string;
  catalog_item_id: string | null;
  unit: string;
  calculation_method:
    | "area"
    | "area_per_spacing"
    | "first_length"
    | "eaves_length"
    | "verge_length"
    | "valley_length"
    | "wall_connection_length"
    | "penetrations_count"
    | "roof_windows_count"
    | "gutter_hangers";
  factor: number;
  spacing_m: number | null;
  waste_applies: boolean;
  sort_order: number;
  active: boolean;
};

export type JobMaterialCalculation = {
  id: string;
  company_id: string;
  jobsite_id: string;
  roof_type: RoofType;
  length_m: number | null;
  width_m: number | null;
  area_m2: number;
  roof_pitch: number | null;
  eaves_length_m: number | null;
  ridge_length_m: number | null;
  verge_length_m: number | null;
  valley_length_m: number | null;
  wall_connection_length_m: number | null;
  penetrations_count: number;
  roof_windows_count: number;
  waste_percent: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type JobMaterialCalculationItem = {
  id: string;
  company_id: string;
  calculation_id: string;
  jobsite_id: string;
  rule_id: string | null;
  catalog_item_id: string | null;
  inventory_item_id: string | null;
  material_name: string;
  unit: string;
  base_quantity: number;
  waste_percent: number;
  waste_quantity: number;
  total_quantity: number;
  purchase_price: number | null;
  sales_price: number | null;
  purchase_total: number | null;
  sales_total: number | null;
  margin_total: number | null;
  location_name: string | null;
  stock: number | null;
  minimum_stock: number | null;
  created_at: string;
};

export type PublicJobMaterialCalculationItem = Omit<
  JobMaterialCalculationItem,
  "purchase_price" | "sales_price" | "purchase_total" | "sales_total" | "margin_total"
>;

export type JobMaterialRequirement = {
  id: string;
  company_id: string;
  order_id: string;
  dimension_id: string | null;
  jobsite_id: string | null;
  rule_id: string | null;
  catalog_item_id: string | null;
  inventory_item_id: string | null;
  material_name: string;
  unit: string;
  base_quantity: number;
  waste_percent: number;
  waste_quantity: number;
  total_quantity: number;
  purchase_price: number | null;
  sales_price: number | null;
  purchase_total: number | null;
  sales_total: number | null;
  margin_total: number | null;
  location_name: string | null;
  stock: number | null;
  minimum_stock: number | null;
  created_at: string;
};

export type PublicJobMaterialRequirement = Omit<
  JobMaterialRequirement,
  "purchase_price" | "sales_price" | "purchase_total" | "sales_total" | "margin_total"
>;

export type SupplierIntegration = {
  id: string;
  company_id: string;
  name: string;
  type: SupplierIntegrationType;
  provider_key: SupplierProviderKey;
  base_url: string | null;
  api_key_encrypted: string | null;
  active: boolean;
  supports_price: boolean;
  supports_stock: boolean;
  supports_delivery_time: boolean;
  supports_product_url: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SupplierOffer = {
  id: string;
  company_id: string;
  supplier_integration_id: string | null;
  provider_key: SupplierProviderKey;
  supplier_name: string;
  external_product_id: string | null;
  product_name: string;
  manufacturer: string | null;
  category: string | null;
  unit: string;
  package_size: number | null;
  price_net: number | null;
  price_gross: number;
  currency: string;
  vat_rate: number;
  shipping_cost: number;
  total_price_gross: number;
  delivery_time_text: string | null;
  delivery_time_days_min: number | null;
  delivery_time_days_max: number | null;
  stock_status: string | null;
  product_url: string | null;
  image_url: string | null;
  last_checked_at: string;
  valid_until: string | null;
  source_type: SupplierOfferSourceType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  supplier_integrations?: Pick<SupplierIntegration, "id" | "name" | "provider_key" | "type"> | null;
};

export type SupplierOfferMatch = {
  id: string;
  company_id: string;
  material_id: string;
  supplier_offer_id: string;
  match_score: number;
  match_type: "auto" | "manual";
  approved_by_admin: boolean;
  created_by: string | null;
  created_at: string;
  supplier_offers?: SupplierOffer | null;
  inventory_items?: Pick<InventoryItem, "id" | "name" | "unit" | "purchase_price" | "manufacturer"> | null;
};

export type SupplierPriceHistory = {
  id: string;
  company_id: string;
  material_id: string;
  supplier_name: string;
  product_name: string;
  price_net: number | null;
  price_gross: number;
  total_price_gross: number;
  checked_at: string;
};

export type OnlinePriceDiscovery = {
  id: string;
  company_id: string;
  material_id: string | null;
  query: string;
  status: OnlinePriceDiscoveryStatus;
  source_statuses: Array<{
    sourceKey: OnlinePriceSourceKey;
    label: string;
    status: "ok" | "no_config" | "unreachable" | "error";
    message: string;
  }>;
  cheapest_price_gross: number | null;
  average_price_gross: number | null;
  offer_count: number;
  created_by: string | null;
  created_at: string;
};

export type OnlinePriceOffer = {
  id: string;
  company_id: string;
  discovery_id: string;
  material_id: string | null;
  source_key: OnlinePriceSourceKey;
  supplier_name: string;
  product_name: string;
  product_url: string | null;
  price_gross: number;
  shipping_cost: number;
  total_price_gross: number;
  delivery_time_text: string | null;
  checked_at: string;
  source_note: string | null;
  created_at: string;
};

export type TimeEntry = {
  id: string;
  company_id: string;
  employee_id: string;
  job_id: string;
  customer_id: string | null;
  date: string;
  work_location: string;
  work_address: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  gross_minutes: number;
  net_minutes: number;
  activity: string;
  weather: string | null;
  kilometers: number | null;
  notes: string | null;
  status: TimeEntryStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
  jobsites?: Pick<Jobsite, "id" | "name" | "address" | "customer"> | null;
};

export type TimeEntryAuditLog = {
  id: string;
  company_id: string;
  time_entry_id: string;
  changed_by: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  change_reason: string | null;
  created_at: string;
  profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
};

export type TimeReport = {
  id: string;
  company_id: string;
  employee_id: string | null;
  month: number;
  year: number;
  date_from: string;
  date_to: string;
  status: TimeReportStatus;
  generated_by: string | null;
  generated_at: string;
  profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
};

export type TimeReportEntry = {
  id: string;
  time_report_id: string;
  time_entry_id: string;
  time_entries?: TimeEntry | null;
};

export type VoiceNote = {
  id: string;
  company_id: string;
  user_id: string;
  raw_text: string;
  detected_intent: VoiceIntent;
  detected_entities: Record<string, unknown>;
  linked_customer_id: string | null;
  linked_job_id: string | null;
  linked_time_entry_id: string | null;
  linked_bring_list_id: string | null;
  linked_material_alert_id: string | null;
  status: VoiceNoteStatus;
  created_at: string;
};

export type VoiceRoutingRule = {
  id: string;
  company_id: string | null;
  keyword: string;
  intent: VoiceIntent;
  priority: number;
  active: boolean;
  created_at: string;
};

export type BringList = {
  id: string;
  company_id: string;
  job_id: string;
  date: string;
  title: string;
  notes: string | null;
  status: BringListStatus;
  created_by: string | null;
  assigned_to: string | null;
  vehicle_id: string | null;
  created_at: string;
  updated_at: string;
  jobsites?: Pick<Jobsite, "id" | "name" | "customer" | "address"> | null;
  profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
  vehicles?: Pick<Vehicle, "id" | "name" | "license_plate"> | null;
};

export type BringListItem = {
  id: string;
  bring_list_id: string;
  material_id: string | null;
  inventory_item_id: string | null;
  custom_item_name: string;
  item_type: BringListItemType;
  quantity: number;
  unit: string;
  storage_location: string | null;
  vehicle_id: string | null;
  packed: boolean;
  packed_by: string | null;
  packed_at: string | null;
  missing_reported: boolean;
  notes: string | null;
  created_at: string;
  inventory_items?: Pick<InventoryItem, "id" | "name" | "unit" | "stock" | "minimum_stock" | "location_id"> & {
    inventory_locations?: Pick<InventoryLocation, "id" | "name" | "location_type"> | null;
  };
};

export type MaterialReservation = {
  id: string;
  company_id: string;
  job_id: string | null;
  bring_list_id: string | null;
  material_id: string | null;
  inventory_item_id: string | null;
  quantity_required: number;
  quantity_reserved: number;
  unit: string;
  status: MaterialReservationStatus;
  reserved_by: string | null;
  reserved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MaterialAlert = {
  id: string;
  company_id: string;
  material_id: string | null;
  inventory_item_id: string | null;
  job_id: string | null;
  bring_list_id: string | null;
  alert_type: MaterialAlertType;
  severity: MaterialAlertSeverity;
  message: string;
  required_quantity: number | null;
  available_quantity: number | null;
  missing_quantity: number | null;
  unit: string | null;
  status: MaterialAlertStatus;
  created_by_system: boolean;
  assigned_to_admin: string | null;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  inventory_items?: Pick<InventoryItem, "id" | "name" | "unit" | "stock" | "minimum_stock"> | null;
  jobsites?: Pick<Jobsite, "id" | "name" | "address" | "customer"> | null;
  bring_lists?: Pick<BringList, "id" | "title" | "date"> | null;
};

export type PurchaseSuggestion = {
  id: string;
  company_id: string;
  material_id: string | null;
  inventory_item_id: string | null;
  job_id: string | null;
  bring_list_id: string | null;
  quantity_needed: number;
  unit: string;
  reason: string;
  status: PurchaseSuggestionStatus;
  created_at: string;
  updated_at: string;
  inventory_items?: Pick<InventoryItem, "id" | "name" | "unit" | "stock" | "minimum_stock"> | null;
  jobsites?: Pick<Jobsite, "id" | "name" | "address" | "customer"> | null;
  bring_lists?: Pick<BringList, "id" | "title" | "date"> | null;
};

export type Vehicle = {
  id: string;
  company_id: string;
  name: string;
  license_plate: string;
  tuv_date: string | null;
  notes: string | null;
};

export type VehicleMaterial = {
  id: string;
  vehicle_id: string;
  material_id: string;
  quantity: number;
  notes: string | null;
  materials?: Pick<Material, "id" | "name" | "unit"> | null;
};

export type Task = {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
  status: TaskStatus;
  jobsites?: Pick<Jobsite, "id" | "name"> | null;
  profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
};
