export type Role = "admin" | "chef" | "vorarbeiter" | "mitarbeiter" | "kunde";
export type JobsiteStatus = "geplant" | "aktiv" | "abgeschlossen";
export type MaterialLocation = "Lager" | "Fahrzeug" | "Baustelle";
export type InventoryLocationType =
  | "Hauptlager"
  | "Fahrzeuglager"
  | "Baustelle"
  | "Container"
  | "Werkstatt"
  | "Lieferant/offen bestellt";
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
export type ReportStatus = "draft" | "submitted" | "reviewed" | "approved";
export type VoiceIntent = "bring_list" | "time_tracking" | "material_alert" | "job_note" | "unknown";
export type VoiceNoteStatus = "draft" | "confirmed" | "discarded";
export type BringListStatus = "draft" | "ready" | "packed" | "delivered";
export type BringListItemType = "material" | "tool" | "document" | "safety" | "other";
export type MaterialReservationStatus = "open" | "reserved" | "partially_reserved" | "missing" | "consumed" | "cancelled";
export type MaterialUsageBookingType = "consume" | "return" | "loss" | "break";
export type MaterialUsageReportStatus = "reported" | "confirmed" | "rejected" | "corrected";
export type MaterialAlertType = "low_stock" | "out_of_stock" | "missing_for_job" | "below_minimum_after_reservation";
export type MaterialAlertSeverity = "info" | "warning" | "critical";
export type MaterialAlertStatus = "open" | "acknowledged" | "resolved";
export type PurchaseSuggestionStatus = "open" | "ordered" | "ignored" | "received";
export type DeliveryNoteStatus = "uploaded" | "recognized" | "confirmed" | "rejected";
export type TaskStatus = "offen" | "in_arbeit" | "erledigt";
export type ChecklistCategory =
  | "arbeitssicherheit"
  | "baustart"
  | "tagesabschluss"
  | "abnahme"
  | "material"
  | "geruest"
  | "dacharbeiten";
export type ChecklistItemStatus = "offen" | "erledigt" | "nicht_zutreffend" | "problem";
export type JobsiteChecklistStatus = "draft" | "in_progress" | "completed" | "archived";
export type DefectPriority = "niedrig" | "mittel" | "hoch" | "kritisch";
export type DefectStatus = "offen" | "in_arbeit" | "wartet_auf_kunde" | "erledigt" | "abgenommen";
export type DefectSourceType = "manual" | "photo" | "report" | "checklist" | "customer_message";
export type DefectNotificationType = "due_soon" | "overdue" | "status_changed";
export type PlanningView = "week" | "month";
export type PlanningResourceType = "employee" | "vehicle" | "equipment";
export type PlanningResourceKind = "fahrzeug" | "anhaenger" | "maschine" | "werkzeug" | "geruest_leiter" | "geraet" | "sonstiges";
export type PlanningResourceStatus =
  | "verfuegbar"
  | "auf_baustelle"
  | "im_fahrzeug"
  | "defekt"
  | "werkstatt"
  | "reserviert"
  | "archiviert";
export type PlanningWeatherRiskLevel = "green" | "yellow" | "red";
export type PlanningWeatherAcknowledgementAction = "confirmed" | "ignored";
export type PlanningAssignmentStatus =
  | "geplant"
  | "aktiv"
  | "erledigt"
  | "verschoben"
  | "krank"
  | "urlaub"
  | "werkstatt"
  | "defekt"
  | "weiterbildung";
export type CustomerPortalEventType = "update" | "status" | "photo" | "document" | "appointment" | "work_order";
export type WorkOrderStatus = "draft" | "sent" | "viewed" | "signed" | "rejected";
export type CommercialDocumentType = "quote" | "invoice";
export type CommercialDocumentStatus = "draft" | "sent" | "accepted" | "rejected" | "paid" | "cancelled";
export type InvoiceType = "angebot" | "rechnung" | "gutschrift";
export type InvoiceStatus = "entwurf" | "gesendet" | "bezahlt" | "storniert";
export type DigitalDocumentType = "work_order" | "report" | "commercial_document" | "jobsite_document" | "acceptance";
export type DigitalSignatureStatus = "draft" | "signed" | "rejected";
export type JobsiteDocumentCategory =
  | "angebot"
  | "rechnung"
  | "lieferschein"
  | "aufmass"
  | "abnahmeprotokoll"
  | "regiebericht"
  | "sicherheitsunterweisung"
  | "sonstiges";
export type JobsiteActivityEventType =
  | "note"
  | "document"
  | "photo"
  | "task"
  | "time"
  | "material"
  | "report"
  | "order"
  | "weather"
  | "signature";
export type JobsiteActivityVisibility = "internal" | "customer";
export type OrderMeasurementItemType =
  | "roof_area"
  | "deduction_area"
  | "eaves_length"
  | "ridge_length"
  | "verge_length"
  | "valley_length"
  | "wall_connection_length"
  | "downpipe_length"
  | "roof_window"
  | "penetration"
  | "roof_drain"
  | "emergency_overflow";
export type PlanId = "starter" | "professional" | "business";

export type Company = {
  id: string;
  name: string;
  plan_id?: PlanId | string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  session_timeout_minutes?: number | null;
  trade?: string | null;
  logo_path?: string | null;
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
  latitude?: number | null;
  longitude?: number | null;
  weather_last_checked_at?: string | null;
  created_at: string;
};

export type WeatherSnapshot = {
  id: string;
  company_id: string;
  jobsite_id: string;
  temperature_c: number | null;
  precipitation_mm: number | null;
  wind_kmh: number | null;
  weather_code: number | null;
  risk_level: "green" | "yellow" | "red";
  summary: string | null;
  source: string | null;
  fetched_at: string;
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
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderMeasurementItem = {
  id: string;
  company_id: string;
  order_id: string;
  item_type: OrderMeasurementItemType;
  label: string;
  length_m: number | null;
  width_m: number | null;
  quantity: number;
  pitch_deg: number | null;
  calculated_area_m2: number;
  calculated_length_m: number;
  count_value: number;
  notes: string | null;
  created_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Report = {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  report_date: string;
  weather: string | null;
  weather_summary?: string | null;
  weather_temperature_c?: number | null;
  weather_precipitation_mm?: number | null;
  weather_wind_kmh?: number | null;
  weather_source?: string | null;
  weather_fetched_at?: string | null;
  weather_lat?: number | null;
  weather_lng?: number | null;
  work_start: string | null;
  work_end: string | null;
  employee_ids: string[];
  activities: string;
  material_usage: string | null;
  machine_usage?: string | null;
  vehicle_ids?: string[];
  linked_time_entry_ids?: string[];
  issues: string | null;
  report_status?: ReportStatus;
  submitted_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  visible_to_customer?: boolean;
  customer_summary?: string | null;
  customer_released_at?: string | null;
  customer_released_by?: string | null;
  signature_name: string | null;
  signature_status?: DigitalSignatureStatus;
  signature_data_url?: string | null;
  signature_signed_at?: string | null;
  signature_role?: Role | null;
  signature_content_hash?: string | null;
  source_report_id?: string | null;
  document_version?: number;
  created_by: string | null;
  created_at: string;
  archived_at?: string | null;
  jobsites?: Pick<Jobsite, "id" | "name" | "address" | "customer"> | null;
};

export type ReportPhoto = {
  id: string;
  company_id: string;
  report_id: string;
  jobsite_id: string | null;
  storage_path: string;
  file_name: string;
  content_type: string | null;
  visible_to_customer: boolean;
  customer_caption: string | null;
  thumbnail_path: string | null;
  approved_by: string | null;
  approved_at: string | null;
  archived_at?: string | null;
  created_at: string;
  signedUrl?: string;
};

export type CustomerPortalToken = {
  id: string;
  company_id: string;
  customer_id: string;
  jobsite_id: string | null;
  token_hash: string;
  label: string | null;
  expires_at: string;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
  last_used_at: string | null;
};

export type CustomerPortalEvent = {
  id: string;
  company_id: string;
  customer_id: string;
  jobsite_id: string | null;
  event_type: CustomerPortalEventType;
  title: string;
  body: string | null;
  visible_to_customer: boolean;
  event_date: string;
  created_by: string | null;
  created_at: string;
};

export type CustomerPortalMessage = {
  id: string;
  company_id: string;
  customer_id: string;
  jobsite_id: string | null;
  portal_token_id: string | null;
  sender_name: string;
  sender_email: string | null;
  message: string;
  status: "open" | "answered" | "archived";
  answered_at: string | null;
  answered_by: string | null;
  created_at: string;
};

export type CustomerDocument = {
  id: string;
  company_id: string;
  customer_id: string;
  jobsite_id: string | null;
  title: string;
  storage_path: string;
  file_name: string;
  content_type: string | null;
  visible_to_customer: boolean;
  uploaded_by: string | null;
  created_at: string;
};

export type JobsiteDocument = {
  id: string;
  company_id: string;
  jobsite_id: string;
  category: JobsiteDocumentCategory;
  title: string;
  storage_path: string;
  file_name: string;
  content_type: string | null;
  size_bytes: number | null;
  visible_to_customer: boolean;
  uploaded_by: string | null;
  signed_by: string | null;
  signed_at: string | null;
  signature_name: string | null;
  signature_data_url?: string | null;
  signature_role?: Role | null;
  signature_content_hash?: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type JobsiteActivityEvent = {
  id: string;
  company_id: string;
  jobsite_id: string;
  event_type: JobsiteActivityEventType;
  title: string;
  body: string | null;
  visibility: JobsiteActivityVisibility;
  actor_id: string | null;
  source_table: string | null;
  source_id: string | null;
  archived_at: string | null;
  created_at: string;
};

export type WorkOrder = {
  id: string;
  company_id: string;
  customer_id: string;
  jobsite_id: string | null;
  order_id: string | null;
  title: string;
  description: string | null;
  scope_of_work: string;
  price_note: string | null;
  status: WorkOrderStatus;
  version: number;
  content_hash: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  rejected_at: string | null;
  signer_name: string | null;
  signer_ip: string | null;
  signer_user_agent: string | null;
  signature_data_url: string | null;
  signature_role?: Role | null;
  rejection_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DigitalSignature = {
  id: string;
  company_id: string;
  document_type: DigitalDocumentType;
  document_id: string;
  document_version: number;
  jobsite_id: string | null;
  status: DigitalSignatureStatus;
  signer_name: string;
  signer_role: Role;
  signer_user_id: string | null;
  signer_ip: string | null;
  signer_user_agent: string | null;
  signature_data_url: string | null;
  signed_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  content_hash: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type DigitalDocumentVersion = {
  id: string;
  company_id: string;
  document_type: DigitalDocumentType;
  document_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  content_hash: string;
  created_by: string | null;
  created_at: string;
};

export type WorkOrderVersion = {
  id: string;
  company_id: string;
  work_order_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  content_hash: string;
  created_by: string | null;
  created_at: string;
};

export type CommercialDocument = {
  id: string;
  company_id: string;
  order_id: string | null;
  customer_id: string;
  jobsite_id: string | null;
  document_type: CommercialDocumentType;
  document_number: string;
  status: CommercialDocumentStatus;
  subject: string;
  customer_snapshot: Record<string, unknown>;
  issue_date: string;
  due_date: string | null;
  valid_until: string | null;
  subtotal_net: number;
  tax_rate: number;
  tax_total: number;
  total_gross: number;
  notes: string | null;
  payment_terms: string | null;
  created_by: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  paid_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  orders?: Pick<Order, "id" | "order_number" | "title" | "status"> | null;
  customers?: Pick<Customer, "id" | "company" | "first_name" | "last_name" | "contact_person" | "email" | "phone"> | null;
};

export type CommercialDocumentItem = {
  id: string;
  company_id: string;
  document_id: string;
  source_requirement_id: string | null;
  position: number;
  title: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_price_net: number;
  discount_percent: number;
  line_total_net: number;
  created_at: string;
  updated_at: string;
};

export type Invoice = {
  id: string;
  company_id: string;
  customer_id: string;
  order_id: string | null;
  type: InvoiceType;
  status: InvoiceStatus;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  subtotal_eur: number;
  tax_rate_percent: number;
  tax_eur: number;
  total_eur: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at?: string | null;
  archived_at: string | null;
  customers?: Pick<Customer, "id" | "company" | "first_name" | "last_name" | "contact_person" | "email" | "phone" | "billing_address" | "jobsite_address" | "payment_terms"> | null;
  orders?: Pick<Order, "id" | "order_number" | "title" | "status" | "jobsite_address"> | null;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_eur: number;
  total_eur: number;
  position: number;
  created_at: string;
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
  archived_at?: string | null;
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
  address: string | null;
  vehicle_id: string | null;
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
  inventory_locations?: Pick<InventoryLocation, "id" | "name" | "location_type" | "vehicle_id"> | null;
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
    | "dormers_count"
    | "chimneys_count"
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
  roof_form: string | null;
  material_type: string | null;
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
  dormers_count: number;
  chimneys_count: number;
  waste_percent: number;
  ai_enabled: boolean;
  ai_model: string | null;
  ai_confidence: number | null;
  ai_notes: string | null;
  review_notice: string;
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
  missing_quantity: number;
  source: "rule" | "ai" | "manual";
  ai_reason: string | null;
  archived_at?: string | null;
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
  weather_summary?: string | null;
  weather_temperature_c?: number | null;
  weather_precipitation_mm?: number | null;
  weather_wind_kmh?: number | null;
  weather_source?: string | null;
  weather_fetched_at?: string | null;
  weather_lat?: number | null;
  weather_lng?: number | null;
  kilometers: number | null;
  notes: string | null;
  status: TimeEntryStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  archived_at?: string | null;
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
  auto_generated: boolean;
  generation_source: string;
  last_auto_synced_at: string | null;
  source_hash: string | null;
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
  auto_generated: boolean;
  source_type: string | null;
  source_ref: string | null;
  required_vehicle_id: string | null;
  created_at: string;
  updated_at: string;
  inventory_items?: Pick<InventoryItem, "id" | "name" | "unit" | "stock" | "minimum_stock" | "location_id"> & {
    inventory_locations?: Pick<InventoryLocation, "id" | "name" | "location_type" | "vehicle_id"> | null;
  };
};

export type BringListAuditLog = {
  id: string;
  company_id: string;
  bring_list_id: string;
  actor_id: string | null;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
  profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
};

export type MaterialAvailabilityRisk = "green" | "yellow" | "red" | "blue";

export type UserHelpState = {
  id: string;
  user_id: string;
  company_id: string;
  feature_key: string;
  first_seen_at: string;
  dismissed_at: string | null;
  first_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BringListAvailabilitySnapshot = {
  id: string;
  company_id: string;
  bring_list_id: string;
  bring_list_item_id: string | null;
  inventory_item_id: string | null;
  required_quantity: number;
  available_quantity: number;
  reserved_quantity: number;
  missing_quantity: number;
  risk_level: MaterialAvailabilityRisk;
  status_label: string;
  source: string;
  created_at: string;
};

export type MaterialMovementType = "purchase" | "transfer" | "reserve" | "consume" | "return" | "correction" | "loss" | "break";

export type MaterialMovement = {
  id: string;
  company_id: string;
  inventory_item_id: string;
  from_location_id: string | null;
  to_location_id: string | null;
  jobsite_id: string | null;
  bring_list_id: string | null;
  quantity: number;
  unit: string;
  movement_type: MaterialMovementType;
  created_by: string | null;
  created_at: string;
  notes: string | null;
  inventory_items?: Pick<InventoryItem, "id" | "name" | "unit" | "stock" | "minimum_stock" | "location_id"> | null;
  jobsites?: Pick<Jobsite, "id" | "name" | "address" | "customer"> | null;
  profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
};

export type DeliveryNote = {
  id: string;
  company_id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  document_date: string | null;
  status: DeliveryNoteStatus;
  storage_path: string;
  file_name: string;
  content_type: string;
  recognition_model: string | null;
  recognition_confidence: number | null;
  recognized_json: Record<string, unknown>;
  notes: string | null;
  created_by: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  suppliers?: Pick<Supplier, "id" | "name"> | null;
  profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
};

export type DeliveryNoteItem = {
  id: string;
  company_id: string;
  delivery_note_id: string;
  inventory_item_id: string | null;
  supplier_article_number: string | null;
  article_name: string;
  quantity: number;
  unit: string;
  target_location_id: string | null;
  recognition_confidence: number | null;
  created_at: string;
  updated_at: string;
  inventory_items?: Pick<InventoryItem, "id" | "name" | "unit" | "stock" | "minimum_stock" | "location_id"> | null;
  inventory_locations?: Pick<InventoryLocation, "id" | "name" | "location_type"> | null;
};

export type DeliveryNoteItemPrice = {
  id: string;
  company_id: string;
  delivery_note_item_id: string;
  unit_price: number | null;
  total_price: number | null;
  currency: string;
  created_at: string;
  updated_at: string;
};

export type MaterialUsageReport = {
  id: string;
  company_id: string;
  inventory_item_id: string;
  jobsite_id: string;
  bring_list_id: string | null;
  quantity: number;
  unit: string;
  booking_type: MaterialUsageBookingType;
  status: MaterialUsageReportStatus;
  movement_id: string | null;
  reported_by: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  inventory_items?: Pick<InventoryItem, "id" | "name" | "unit" | "stock" | "minimum_stock" | "location_id"> & {
    inventory_locations?: Pick<InventoryLocation, "id" | "name" | "location_type" | "vehicle_id"> | null;
  };
  jobsites?: Pick<Jobsite, "id" | "name" | "address" | "customer"> | null;
  reported_profile?: Pick<Profile, "id" | "full_name" | "email" | "role"> | null;
  confirmed_profile?: Pick<Profile, "id" | "full_name" | "email" | "role"> | null;
  material_movements?: Pick<MaterialMovement, "id" | "movement_type" | "created_at"> | null;
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
  status?: PlanningResourceStatus | null;
  inspection_due_date?: string | null;
  maintenance_interval_days?: number | null;
  last_maintenance_at?: string | null;
  next_maintenance_at?: string | null;
  location_text?: string | null;
  responsible_employee_id?: string | null;
  qr_code?: string | null;
  nfc_tag_id?: string | null;
  notes: string | null;
  archived_at?: string | null;
  responsible_profile?: Pick<Profile, "id" | "full_name" | "email"> | null;
};

export type VehicleMaterial = {
  id: string;
  vehicle_id: string;
  material_id: string;
  quantity: number;
  notes: string | null;
  archived_at?: string | null;
  materials?: Pick<Material, "id" | "name" | "unit"> | null;
};

export type PlanningResource = {
  id: string;
  company_id: string;
  name: string;
  resource_kind: PlanningResourceKind;
  status: PlanningResourceStatus;
  inspection_due_date: string | null;
  maintenance_interval_days: number | null;
  last_maintenance_at: string | null;
  next_maintenance_at: string | null;
  location_text: string | null;
  responsible_employee_id: string | null;
  vehicle_id: string | null;
  qr_code: string | null;
  nfc_tag_id: string | null;
  notes: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  responsible_profile?: Pick<Profile, "id" | "full_name" | "email"> | null;
  vehicles?: Pick<Vehicle, "id" | "name" | "license_plate"> | null;
};

export type ResourceDocumentType = "foto" | "dokument" | "pruefung" | "wartung" | "sonstiges";

export type ResourceDocument = {
  id: string;
  company_id: string;
  planning_resource_id: string | null;
  vehicle_id: string | null;
  document_type: ResourceDocumentType;
  title: string;
  storage_path: string;
  file_name: string;
  content_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type PlanningAssignment = {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  title: string;
  resource_type: PlanningResourceType;
  employee_id: string | null;
  vehicle_id: string | null;
  planning_resource_id: string | null;
  start_date: string;
  end_date: string;
  status: PlanningAssignmentStatus;
  color: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  jobsites?: Pick<
    Jobsite,
    "id" | "name" | "customer" | "address" | "assigned_employee_ids" | "status" | "latitude" | "longitude" | "weather_last_checked_at"
  > | null;
  profiles?: Pick<Profile, "id" | "full_name" | "email" | "role"> | null;
  vehicles?: Pick<Vehicle, "id" | "name" | "license_plate"> | null;
  planning_resources?: Pick<PlanningResource, "id" | "name" | "resource_kind" | "status"> | null;
};

export type PlanningWeatherCheck = {
  id: string;
  company_id: string;
  planning_assignment_id: string;
  jobsite_id: string;
  period_start: string;
  period_end: string;
  risk_level: PlanningWeatherRiskLevel;
  summary: string;
  rule_codes: string[];
  temperature_min_c: number | null;
  temperature_max_c: number | null;
  precipitation_mm: number | null;
  precipitation_probability: number | null;
  wind_kmh: number | null;
  wind_gust_kmh: number | null;
  weather_code: number | null;
  source: string;
  fetched_at: string;
  acknowledged_action: PlanningWeatherAcknowledgementAction | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  acknowledgment_note: string | null;
  created_at: string;
  updated_at: string;
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
  archived_at?: string | null;
  jobsites?: Pick<Jobsite, "id" | "name"> | null;
  profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
};

export type ChecklistTemplate = {
  id: string;
  company_id: string | null;
  name: string;
  category: ChecklistCategory;
  description: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type ChecklistTemplateItem = {
  id: string;
  template_id: string;
  company_id: string | null;
  label: string;
  help_text: string | null;
  required: boolean;
  photo_required: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type JobsiteChecklist = {
  id: string;
  company_id: string;
  jobsite_id: string;
  template_id: string | null;
  title: string;
  category: ChecklistCategory;
  status: JobsiteChecklistStatus;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  signature_name: string | null;
  signature_data_url: string | null;
  signature_role: Role | null;
  signature_signed_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  jobsites?: Pick<Jobsite, "id" | "name" | "customer" | "address" | "assigned_employee_ids"> | null;
  profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
};

export type JobsiteChecklistItem = {
  id: string;
  company_id: string;
  checklist_id: string;
  template_item_id: string | null;
  jobsite_id: string;
  label: string;
  help_text: string | null;
  required: boolean;
  photo_required: boolean;
  status: ChecklistItemStatus;
  notes: string | null;
  problem_description: string | null;
  resolved_task_id: string | null;
  checked_by: string | null;
  checked_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  checklist_item_photos?: ChecklistItemPhoto[];
  tasks?: Pick<Task, "id" | "title" | "status"> | null;
};

export type ChecklistItemPhoto = {
  id: string;
  company_id: string;
  checklist_id: string;
  checklist_item_id: string;
  jobsite_id: string;
  storage_path: string;
  file_name: string;
  content_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
  archived_at: string | null;
};

export type Defect = {
  id: string;
  company_id: string;
  jobsite_id: string;
  title: string;
  description: string | null;
  priority: DefectPriority;
  status: DefectStatus;
  assigned_to: string | null;
  due_date: string | null;
  visible_to_customer: boolean;
  customer_released_at: string | null;
  customer_released_by: string | null;
  source_type: DefectSourceType;
  source_report_id: string | null;
  source_report_photo_id: string | null;
  source_checklist_id: string | null;
  source_checklist_item_id: string | null;
  source_customer_message_id: string | null;
  source_task_id: string | null;
  closed_at: string | null;
  accepted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  jobsites?: Pick<Jobsite, "id" | "name" | "customer" | "address" | "assigned_employee_ids"> | null;
  profiles?: Pick<Profile, "id" | "full_name" | "email" | "role"> | null;
  reports?: Pick<Report, "id" | "report_date" | "activities" | "issues"> | null;
  report_photos?: Pick<ReportPhoto, "id" | "file_name" | "storage_path"> | null;
  jobsite_checklists?: Pick<JobsiteChecklist, "id" | "title" | "category"> | null;
  jobsite_checklist_items?: Pick<JobsiteChecklistItem, "id" | "label" | "status" | "problem_description"> | null;
  customer_portal_messages?: Pick<CustomerPortalMessage, "id" | "sender_name" | "message" | "created_at"> | null;
  tasks?: Pick<Task, "id" | "title" | "status"> | null;
};

export type DefectPhoto = {
  id: string;
  company_id: string;
  defect_id: string;
  jobsite_id: string;
  storage_path: string;
  file_name: string;
  content_type: string | null;
  size_bytes: number | null;
  visible_to_customer: boolean;
  uploaded_by: string | null;
  created_at: string;
  archived_at: string | null;
};

export type DefectNotification = {
  id: string;
  company_id: string;
  defect_id: string;
  user_id: string | null;
  notification_type: DefectNotificationType;
  title: string;
  body: string | null;
  due_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  archived_at: string | null;
  defects?: Pick<Defect, "id" | "title" | "priority" | "status" | "due_date" | "jobsite_id"> | null;
};
