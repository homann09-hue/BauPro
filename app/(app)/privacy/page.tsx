import Link from "next/link";
import { Download, FileCheck2, ShieldCheck, UserCheck } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { createPrivacyRequestAction } from "@/lib/actions/privacy-actions";
import { dataMap, retentionConcept, subprocessors } from "@/lib/compliance/data-map";
import { requireAppContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { formatDateTime, searchParamMessage } from "@/lib/utils";

type PrivacyRequestRow = {
  id: string;
  request_type: string;
  status: string;
  description: string | null;
  due_at: string | null;
  created_at: string;
};

const requestTypeLabels: Record<string, string> = {
  access: "Auskunft",
  rectification: "Berichtigung",
  erasure: "Loeschung/Anonymisierung",
  restriction: "Einschraenkung",
  portability: "Datenuebertragbarkeit",
  objection: "Widerspruch",
  contract_end_export: "Firmenexport Vertragsende"
};

export default async function PrivacyPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);
  const requestResult = await supabase
    .from("privacy_requests")
    .select("id, request_type, status, description, due_at, created_at")
    .eq("company_id", context.companyId)
    .order("created_at", { ascending: false })
    .limit(context.canManage ? 20 : 8);
  const privacyMigrationMissing = Boolean(requestResult.error && isMissingSchemaError(requestResult.error));
  const requests = privacyMigrationMissing ? [] : ((requestResult.data ?? []) as PrivacyRequestRow[]);

  return (
    <>
      <PageHeader
        title="Datenschutz-Center"
        description="Auskunft, Exporte, Datenschutzanfragen und transparente Datenlandkarte. Entwuerfe muessen rechtlich final geprueft werden."
      />
      <MessageBox error={error} success={success} />

      {privacyMigrationMissing ? (
        <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          Datenschutzanfragen sind im Code vorbereitet, aber die Supabase-Migration fuer `privacy_requests` fehlt noch. Datenexporte funktionieren
          trotzdem.
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <section className="surface p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-mint text-moss">
              <Download className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="meta-label">Betroffenenrechte</p>
              <h2 className="section-title">Datenexport und Anfrage</h2>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/privacy/export" className="btn-primary">
              Eigene Daten exportieren
            </Link>
            {context.canManage ? (
              <Link href="/privacy/company-export" className="btn-secondary">
                Firmendaten exportieren
              </Link>
            ) : null}
            <Link href="/profile" className="btn-secondary">
              Profil berichtigen
            </Link>
          </div>

          <form action={createPrivacyRequestAction} className="mt-5 grid gap-3">
            <label>
              <span className="field-label">Anfragetyp</span>
              <select className="field-input" name="request_type" defaultValue="access">
                {Object.entries(requestTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Beschreibung</span>
              <textarea
                className="field-input min-h-28"
                name="description"
                placeholder="Kurz beschreiben, welche Daten oder welchen Vorgang die Anfrage betrifft."
              />
            </label>
            <button className="btn-secondary" type="submit">
              Anfrage speichern
            </button>
            <p className="field-help">
              Loeschung und Anonymisierung muessen gegen Aufbewahrungs- und Nachweispflichten geprueft werden. Die App bereitet den Prozess vor,
              ersetzt aber keine rechtliche Entscheidung.
            </p>
          </form>
        </section>

        <aside className="surface p-4 sm:p-5">
          <ShieldCheck className="mb-3 h-5 w-5 text-moss" aria-hidden="true" />
          <p className="meta-label">Transparenz</p>
          <h2 className="section-title">Wichtige Hinweise</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            <li>Keine heimliche Ueberwachung: Zeiten und Baustellenbezug werden sichtbar dokumentiert.</li>
            <li>KI ist optional, serverseitig und mit reduzierten Mitarbeiterdaten vorbereitet.</li>
            <li>Fotos nur zweckbezogen hochladen; private Inhalte vermeiden.</li>
            <li>Preis- und Margendaten bleiben fuer Mitarbeiter verborgen.</li>
          </ul>
        </aside>
      </div>

      <section className="surface mt-5 p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <FileCheck2 className="h-5 w-5 text-moss" aria-hidden="true" />
          <h2 className="section-title">Meine/aktuelle Datenschutzanfragen</h2>
        </div>
        {requests.length ? (
          <div className="grid gap-2">
            {requests.map((request) => (
              <div key={request.id} className="rounded-md border border-line bg-white p-3 text-sm">
                <p className="font-black text-ink">
                  {requestTypeLabels[request.request_type] ?? request.request_type} · {request.status}
                </p>
                <p className="mt-1 text-slate-600">{request.description || "Keine Beschreibung"}</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  Erstellt {formatDateTime(request.created_at)}
                  {request.due_at ? ` · Zieltermin ${formatDateTime(request.due_at)}` : ""}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-line bg-fog p-4 text-sm text-slate-600">
            Noch keine Datenschutzanfragen gespeichert.
          </p>
        )}
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="surface p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <UserCheck className="h-5 w-5 text-moss" aria-hidden="true" />
            <h2 className="section-title">Datenlandkarte</h2>
          </div>
          <div className="space-y-3">
            {dataMap.map((entry) => (
              <details key={entry.area} className="rounded-md border border-line bg-white p-3">
                <summary className="cursor-pointer font-black text-ink">{entry.area}</summary>
                <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  <p>Daten: {entry.data.join(", ")}</p>
                  <p>Zweck: {entry.purpose}</p>
                  <p>Sichtbarkeit: {entry.visibility}</p>
                  <p>Aufbewahrung: {entry.retention}</p>
                </div>
              </details>
            ))}
          </div>
        </div>

        <div className="surface p-4 sm:p-5">
          <h2 className="section-title">Subprozessoren und Aufbewahrung</h2>
          <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
            {subprocessors.map((processor) => (
              <p key={processor.name}>
                <span className="font-black text-ink">{processor.name}:</span> {processor.role}. Status: {processor.status}.
              </p>
            ))}
            <div className="rounded-md border border-line bg-fog p-3">
              <p className="font-black text-ink">Retention-Entwurf</p>
              <ul className="mt-2 space-y-1">
                {retentionConcept.slice(0, 4).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
