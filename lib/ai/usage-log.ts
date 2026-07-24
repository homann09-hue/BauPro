import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AiUsageStatus } from "@/lib/ai/types";
import { logServerWarning } from "@/lib/security/logging";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function isMissingAiTable(message?: string) {
  return Boolean(message?.includes("Could not find the table") || message?.includes("does not exist"));
}

export async function logAiUsage({
  supabase,
  companyId,
  userId,
  feature,
  model,
  inputTokens,
  outputTokens,
  status,
  errorMessage
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  userId: string;
  feature: string;
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  status: AiUsageStatus;
  errorMessage?: string | null;
}) {
  const { error } = await supabase.from("ai_usage_logs").insert({
    company_id: companyId,
    user_id: userId,
    feature,
    model,
    input_tokens: inputTokens ?? null,
    output_tokens: outputTokens ?? null,
    status,
    error_message: errorMessage ?? null
  });

  if (error && !isMissingAiTable(error.message)) {
    logServerWarning("ai-usage-log-failed", error, { companyId, userId, feature, status });
  }
}
