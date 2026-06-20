import { RotateCcw } from "lucide-react";
import { HelpCenter } from "@/components/help/HelpCenter";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { resetHelpTipsAction, showHelpTipAgainAction } from "@/lib/actions/help-actions";
import { requireAppContext } from "@/lib/auth";
import { canSeeHelpTip, helpTips } from "@/lib/help/help-content";
import { searchParamMessage } from "@/lib/utils";

export default async function HelpPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const { error, success } = searchParamMessage(await searchParams);
  const visibleTips = helpTips.filter((tip) => canSeeHelpTip(context.profile.role, tip.audience));

  return (
    <>
      <PageHeader title="Hilfe" description="Kurze Antworten, einfache Schritte und Tipps für BauPro." />
      <MessageBox error={error} success={success} />

      <section className="dashboard-band mb-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="section-title">Tipps steuern</h2>
            <p className="mt-1 text-sm text-slate-500">
              Geschlossene Hinweise bleiben weg. Hier kannst du einzelne Tipps erneut anzeigen oder alle zurücksetzen.
            </p>
          </div>
          <form action={resetHelpTipsAction}>
            <input type="hidden" name="return_to" value="/hilfe" />
            <button className="btn-secondary" type="submit">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Alle Tipps zurücksetzen
            </button>
          </form>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {visibleTips.map((tip) => (
            <form key={tip.featureKey} action={showHelpTipAgainAction}>
              <input type="hidden" name="feature_key" value={tip.featureKey} />
              <input type="hidden" name="return_to" value="/hilfe" />
              <button className="btn-secondary min-h-10 px-3 py-2 text-xs" type="submit">
                {tip.title} erneut anzeigen
              </button>
            </form>
          ))}
        </div>
      </section>

      <HelpCenter tips={visibleTips} />
    </>
  );
}
