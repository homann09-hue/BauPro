import type { Role } from "@/types/app";

export type AiIntent =
  | "customer_note"
  | "new_task"
  | "time_entry"
  | "bring_list"
  | "material_request"
  | "job_note"
  | "report_entry"
  | "appointment"
  | "unknown";

export type AiFeature =
  | "business_input"
  | "daily_report"
  | "order_assistant"
  | "material_matching"
  | "inventory_assistant"
  | "customer_assistant"
  | "time_tracking"
  | "timesheet_review"
  | "assistant_chat"
  | "text_generator";

export type AiUsageStatus = "success" | "disabled" | "error";
export type AiActionStatus = "proposed" | "confirmed" | "rejected" | "executed";

export type AiMaterialSuggestion = {
  name: string;
  quantity: number;
  unit: string;
  notes: string;
};

export type AiToolSuggestion = {
  name: string;
  quantity: number;
  unit: string;
  notes: string;
};

export type ClassifiedBusinessInput = {
  intent: AiIntent;
  confidence: number;
  customer_name: string | null;
  job_name: string | null;
  date: string | null;
  time_start: string | null;
  time_end: string | null;
  break_minutes: number | null;
  materials: AiMaterialSuggestion[];
  tools: AiToolSuggestion[];
  notes: string;
  follow_up_questions: string[];
};

export type DailyReportDraft = {
  activities: string;
  material_usage: string;
  issues: string;
  weather: string | null;
  summary: string;
  follow_up_questions: string[];
};

export type MaterialMatchDraft = {
  original_name: string;
  normalized_name: string;
  unit: string;
  confidence: number;
  explanation: string;
  candidates: Array<{
    catalog_id: string | null;
    name: string;
    unit: string;
    reason: string;
  }>;
};

export type AiAssistantAnswer = {
  answer: string;
  warnings: string[];
  suggested_action:
    | "none"
    | "create_time_entry"
    | "create_bring_list"
    | "create_task"
    | "create_report_draft"
    | "create_material_request";
  action_draft: string;
  needs_confirmation: boolean;
  follow_up_questions: string[];
};

export type AiJobDimensionDraft = {
  length_m: number | null;
  width_m: number | null;
  area_m2: number | null;
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
};

export type AiJobDraftParsed = {
  customer_name: string | null;
  existing_customer_id: string | null;
  title: string;
  order_type: "steildach" | "flachdach" | "reparatur" | "dachrinne" | "blech" | "wartung" | "sonstiges";
  priority: "niedrig" | "normal" | "hoch";
  jobsite_name: string | null;
  jobsite_address: string | null;
  start_date: string | null;
  end_date: string | null;
  timeframe_text: string | null;
  description: string;
  internal_notes: string;
  customer_friendly_description: string;
  internal_work_instructions: string;
  dimensions: AiJobDimensionDraft;
  material_system: string | null;
  suggested_materials: AiMaterialSuggestion[];
  labor_hours_estimated: number | null;
  missing_fields: string[];
  follow_up_questions: string[];
  confidence: number;
};

export type AiJobDraftPreviewItem = {
  material_name: string;
  unit: string;
  base_quantity: number;
  waste_percent: number;
  waste_quantity: number;
  total_quantity: number;
  inventory_item_id: string | null;
  stock: number | null;
  available_quantity: number;
  missing_quantity: number;
  purchase_price: number | null;
  sales_price: number | null;
  purchase_total: number | null;
  sales_total: number | null;
  margin_total: number | null;
  location_name: string | null;
  price_source: string;
};

export type AiJobEstimatePreview = {
  material_ek_total: number;
  material_vk_total: number;
  labor_hours_estimated: number;
  labor_rate_net: number;
  labor_total_net: number;
  overhead_percent: number;
  overhead_total: number;
  profit_markup_percent: number;
  profit_total: number;
  travel_flat_rate: number;
  subtotal_net: number;
  vat_rate: number;
  vat_total: number;
  total_gross: number;
  margin_total: number;
  price_source_summary: Record<string, number>;
};

export type AiJobDraftPreview = {
  parsed: AiJobDraftParsed;
  items: AiJobDraftPreviewItem[];
  estimate: AiJobEstimatePreview;
  warning: string;
};

export type AiJobDraftRow = {
  id: string;
  company_id: string;
  created_by: string;
  raw_input: string;
  parsed_json: AiJobDraftParsed;
  preview_json: AiJobDraftPreview;
  confidence: number;
  status: "proposed" | "incomplete" | "confirmed" | "rejected" | "converted_to_job";
  missing_fields: string[];
  converted_order_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type CalculationSettings = {
  id?: string;
  company_id: string;
  default_waste_percent: number;
  default_vat_rate: number;
  default_labor_rate_net: number;
  default_internal_hourly_cost: number;
  default_profit_markup_percent: number;
  default_overhead_percent: number;
  default_travel_flat_rate: number;
  allow_ai_job_creation: boolean;
  require_admin_confirmation: boolean;
  created_at?: string;
  updated_at?: string;
};

export type AiSettings = {
  id?: string;
  company_id: string;
  enabled: boolean;
  default_model: string;
  allow_employee_ai: boolean;
  allow_ai_daily_reports: boolean;
  allow_ai_time_tracking: boolean;
  allow_ai_material_matching: boolean;
  created_at?: string;
  updated_at?: string;
};

export type AiRuntimeState = {
  configured: boolean;
  enabled: boolean;
  model: string;
  role: Role;
  message: string | null;
};

export type StructuredAiResult<T> =
  | {
      ok: true;
      data: T;
      model: string;
      inputTokens: number | null;
      outputTokens: number | null;
    }
  | {
      ok: false;
      disabled: boolean;
      model: string;
      message: string;
      inputTokens?: number | null;
      outputTokens?: number | null;
    };

export type AiActionRow = {
  id: string;
  company_id: string;
  user_id: string;
  action_type: AiIntent | string;
  raw_input: string;
  parsed_json: ClassifiedBusinessInput;
  confidence: number;
  status: AiActionStatus;
  linked_customer_id: string | null;
  linked_job_id: string | null;
  linked_time_entry_id: string | null;
  linked_bring_list_id: string | null;
  created_at: string;
  confirmed_at: string | null;
};
