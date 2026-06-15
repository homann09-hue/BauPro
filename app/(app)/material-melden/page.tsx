import { BellPlus, Send } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { reportMaterialNeedAction } from "@/lib/actions/material-alert-actions";
import { requireAppContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { Jobsite } from "@/types/app";

export default async function MaterialReportPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);

  const { data: jobsites } = await supabase
    .from("jobsites")
    .select("*")
    .in("status", ["geplant", "aktiv"])
    .order("start_date", { ascending: true, nullsFirst: false })
    .limit(50);

  const visibleJobsites = (jobsites ?? []) as Jobsite[];

  return (
    <>
      <PageHeader
        title="Material melden"
        description="Fehlendes oder knappes Material direkt an Chef/Admin melden. Preis- und Einkaufsdaten bleiben ausgeblendet."
      />
      <MessageBox error={error} success={success} />

      <section className="surface p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-50 text-red-700">
            <BellPlus className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="meta-label">Schnellmeldung</p>
            <h2 className="section-title">Was fehlt auf der Baustelle?</h2>
          </div>
        </div>

        <form action={reportMaterialNeedAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="return_to" value="/material-melden" />
          <label className="sm:col-span-2">
            <span className="field-label">Material</span>
            <input className="field-input" name="material_name" placeholder="z. B. Unterspannbahn, Schrauben, Rinnenhalter" required />
          </label>
          <label>
            <span className="field-label">Menge</span>
            <input className="field-input" name="quantity" inputMode="decimal" defaultValue="1" />
          </label>
          <label>
            <span className="field-label">Einheit</span>
            <input className="field-input" name="unit" defaultValue="Stueck" />
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">Baustelle</span>
            <select className="field-input" name="job_id" defaultValue="">
              <option value="">Ohne Zuordnung</option>
              {visibleJobsites.map((jobsite) => (
                <option key={jobsite.id} value={jobsite.id}>
                  {jobsite.name} · {jobsite.customer}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">Hinweis</span>
            <input className="field-input" name="note" placeholder="optional, z. B. dringend fuer morgen" />
          </label>
          <button className="btn-primary sm:col-span-2 lg:col-span-4" type="submit">
            <Send className="h-4 w-4" aria-hidden="true" />
            Meldung senden
          </button>
        </form>
      </section>

      <p className="mt-4 rounded-md border border-line bg-white/80 p-3 text-sm text-slate-600">
        Chef/Admin sieht die Meldung im Dashboard als Materialwarnung und Einkaufsvorschlag. Mitarbeiter sehen keine EK-/VK-Preise
        und keine Preisquellen.
      </p>
    </>
  );
}
