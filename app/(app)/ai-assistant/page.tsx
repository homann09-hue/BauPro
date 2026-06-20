import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { aiRuntimeState, loadAiSettings } from "@/lib/ai/permissions";
import { requireAppContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";

export default async function AiAssistantPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);
  const settings = await loadAiSettings(supabase, context.companyId);
  const runtime = aiRuntimeState(context, settings);
  const disabledMessage = runtime.enabled
    ? null
    : runtime.message ?? "KI ist in den Einstellungen für diese Rolle deaktiviert.";

  return (
    <>
      <PageHeader
        title="KI-Assistent"
        description="Fragen, Diktate und Entwürfe für Baustellen, Zeiten, Lager, Kunden und Tagesberichte. Ergebnisse immer prüfen."
      />
      <MessageBox error={error} success={success} />
      <AiAssistantPanel canManage={context.canManage} configured={runtime.configured} enabledMessage={disabledMessage} />
    </>
  );
}
