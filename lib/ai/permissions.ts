import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppContext } from "@/lib/auth";
import type { AiFeature, AiRuntimeState, AiSettings } from "@/lib/ai/types";
import { aiSettingsSelect } from "@/lib/data/selects";
import { getOpenAiModel, isOpenAiConfigured } from "@/lib/ai/openai";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export const DEFAULT_AI_SETTINGS = {
  enabled: true,
  allow_employee_ai: true,
  allow_ai_daily_reports: true,
  allow_ai_time_tracking: true,
  allow_ai_material_matching: true
};

export async function loadAiSettings(supabase: SupabaseServerClient, companyId: string): Promise<AiSettings> {
  const { data, error } = await supabase.from("ai_settings").select(aiSettingsSelect).eq("company_id", companyId).maybeSingle();

  if (error || !data) {
    return {
      company_id: companyId,
      default_model: getOpenAiModel(),
      ...DEFAULT_AI_SETTINGS
    };
  }

  return {
    company_id: companyId,
    default_model: getOpenAiModel(),
    ...DEFAULT_AI_SETTINGS,
    ...(data as Partial<AiSettings>)
  };
}

export function canUseAiFeature(context: AppContext, settings: AiSettings, feature: AiFeature) {
  if (!settings.enabled) return false;
  if (!context.canManage && !settings.allow_employee_ai) return false;
  if (feature === "daily_report" && !settings.allow_ai_daily_reports) return false;
  if (feature === "time_tracking" && !settings.allow_ai_time_tracking) return false;
  if ((feature === "material_matching" || feature === "material_calculation") && !settings.allow_ai_material_matching) return false;
  return true;
}

export function canSeePrices(context: Pick<AppContext, "canManage">) {
  return context.canManage;
}

export function aiRuntimeState(context: AppContext, settings: AiSettings): AiRuntimeState {
  const configured = isOpenAiConfigured();
  const enabled = configured && settings.enabled && (context.canManage || settings.allow_employee_ai);

  return {
    configured,
    enabled,
    model: getOpenAiModel(),
    role: context.profile.role,
    message: configured ? null : "KI-Funktionen sind noch nicht konfiguriert."
  };
}

export function removePricesForEmployees<T extends Record<string, unknown>>(context: AppContext, row: T) {
  if (context.canManage) return row;

  const hiddenFields = new Set([
    "purchase_price",
    "sales_price",
    "price_net",
    "price_gross",
    "total_price_gross",
    "purchase_total",
    "sales_total",
    "margin_total",
    "markup_percent",
    "supplier_price",
    "online_price",
    "profit",
    "margin"
  ]);

  return Object.fromEntries(Object.entries(row).filter(([key]) => !hiddenFields.has(key))) as T;
}
