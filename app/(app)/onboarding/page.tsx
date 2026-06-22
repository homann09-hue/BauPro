import { MessageBox } from "@/components/message-box";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { PageHeader } from "@/components/page-header";
import { requireManager } from "@/lib/auth";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";

type CompanySetup = {
  id: string;
  name: string;
  trade?: string | null;
  session_timeout_minutes?: number | null;
  onboarding_completed_at?: string | null;
};

function stepFromSearch(searchParams?: Record<string, string | string[] | undefined>) {
  const raw = searchParams?.step;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value ?? "1");
  return Number.isInteger(parsed) ? Math.min(4, Math.max(1, parsed)) : 1;
}

export default async function OnboardingPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const resolvedSearchParams = await searchParams;
  const { error, success } = searchParamMessage(resolvedSearchParams);

  const companyResult = await supabase
    .from("companies")
    .select("id, name, trade, session_timeout_minutes, onboarding_completed_at")
    .eq("id", context.companyId)
    .maybeSingle();

  const companyFallback =
    companyResult.error && safeQueryErrorMessage(companyResult.error)
      ? await supabase
          .from("companies")
          .select("id, name, session_timeout_minutes, onboarding_completed_at")
          .eq("id", context.companyId)
          .maybeSingle()
      : null;

  const activeCompany = (companyResult.data ?? companyFallback?.data ?? {
    id: context.companyId,
    name: context.companyName,
    session_timeout_minutes: context.company.session_timeout_minutes,
    onboarding_completed_at: context.company.onboarding_completed_at
  }) as CompanySetup;

  const [employeesResult, jobsitesResult] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).eq("active", true),
    supabase.from("jobsites").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).is("archived_at", null)
  ]);

  const queryError =
    safeQueryErrorMessage(companyResult.error) ||
    safeQueryErrorMessage(companyFallback?.error) ||
    safeQueryErrorMessage(employeesResult.error) ||
    safeQueryErrorMessage(jobsitesResult.error);

  return (
    <>
      <PageHeader
        title="Startassistent"
        description="In wenigen Minuten arbeitsfähig: Betrieb bestätigen, erste Baustelle anlegen, Team starten."
      />
      <MessageBox error={error || queryError} success={success} />
      <OnboardingWizard
        initialStep={stepFromSearch(resolvedSearchParams)}
        company={{
          name: activeCompany.name ?? context.companyName,
          trade: activeCompany.trade ?? "dachdecker",
          sessionTimeoutMinutes: Number(activeCompany.session_timeout_minutes ?? context.company.session_timeout_minutes ?? 30)
        }}
        summary={{
          employees: employeesResult.count ?? 0,
          jobsites: jobsitesResult.count ?? 0
        }}
      />
    </>
  );
}
