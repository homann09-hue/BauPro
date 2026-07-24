import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Clock3, FileText, PackageCheck, ShieldCheck, Sparkles, UserRoundCheck } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { requireAppContext } from "@/lib/auth";
import { DEMO_COMPANY_NAME, DEMO_CUSTOMER_PORTAL_TOKEN } from "@/lib/demo/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";

const baseTourCards = [
  {
    title: "1. Dashboard: Betrieb heute verstehen",
    text: "Dashboard öffnen: aktive Baustellen, offene Zeiten, Materialwarnungen und Schnellaktionen zeigen sofort den Zustand.",
    href: "/dashboard",
    label: "Dashboard zeigen",
    icon: Sparkles
  },
  {
    title: "2. Baustelle öffnen",
    text: "Steildach Schmidt zeigt Maße, Aufmaßpositionen, 20 % Verschnitt und automatisch erzeugte Materialliste.",
    href: "/orders",
    label: "Aufträge öffnen",
    icon: BriefcaseBusiness
  },
  {
    title: "3. Materialbedarf sehen",
    text: "Konterlatten und Spenglerschrauben sind knapp. Chef sieht Einkaufsvorschläge, Mitarbeiter keine Preise.",
    href: "/materials/control-center",
    label: "Material-Zentrale",
    icon: PackageCheck
  },
  {
    title: "4. Zeit und Bericht erfassen",
    text: "Eingereichte Zeiten zeigen Baustelle, Ort, Pause und Nettozeit. Berichte dokumentieren Wetter, Tätigkeit und Material.",
    href: "/time-tracking/daily",
    label: "Tagesstunden",
    icon: Clock3
  },
  {
    title: "5. Kundenportal zeigen",
    text: "Der Kunde sieht nur freigegebene Updates, Berichte, Dokumente und Arbeitsaufträge. Keine internen Notizen, keine Preise.",
    href: `/portal/${encodeURIComponent(DEMO_CUSTOMER_PORTAL_TOKEN)}`,
    label: "Kundenportal öffnen",
    icon: UserRoundCheck,
    demoOnly: true
  },
  {
    title: "6. Chef-Auswertung prüfen",
    text: "Mitbringlisten, offene Zeiten, Materialwarnungen und Einkaufsvorschläge zeigen, wo der Betrieb heute handeln muss.",
    href: "/bring-lists",
    label: "Mitbringlisten",
    icon: FileText
  }
];

export default async function DemoTourPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);
  const [jobsitesResult, ordersResult, inventoryResult, timeResult] = await Promise.all([
    supabase.from("jobsites").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).is("archived_at", null),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).is("archived_at", null),
    supabase.from("inventory_items").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).is("archived_at", null),
    supabase.from("time_entries").select("id", { count: "exact", head: true }).eq("company_id", context.companyId)
  ]);
  const isDemoCompany = context.companyName === DEMO_COMPANY_NAME;
  const tourCards = baseTourCards.map((card) =>
    card.demoOnly && !isDemoCompany
      ? {
          ...card,
          href: "/orders",
          label: "Kundenportal am Auftrag"
        }
      : card
  );

  return (
    <>
      <PageHeader
        title="Demo-Tour"
        description="In zwei Minuten zeigen: Warum BauPro Zeit spart, Fehler vermeidet und Material/Team/Zeiten zusammenbringt."
        actionHref="/dashboard"
        actionLabel="Zum Dashboard"
        actionIcon={ArrowRight}
      />
      <MessageBox error={error} success={success} />

      <section className="overflow-hidden rounded-lg border border-slate-800 bg-anthracite text-white shadow-lift">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="p-5 sm:p-7">
            <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-xs font-black text-white ring-1 ring-white/10">
              <ShieldCheck className="h-4 w-4 text-mint" aria-hidden="true" />
              {isDemoCompany ? "Demo-Firma aktiv" : "Tour auch für echte Daten nutzbar"}
            </div>
            <h1 className="max-w-3xl text-3xl font-black tracking-normal text-white sm:text-4xl">
              Zeige zuerst Nutzen, nicht Menues.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
              Folge den Karten von oben nach unten. Jede Station beantwortet eine Chef-Frage: Was ist heute los?
              Was fehlt? Was muss morgen mit? Was sieht der Kunde? Was muss ich freigeben?
            </p>
          </div>
          <aside className="border-t border-white/10 bg-slate-900 p-5 sm:p-7 lg:border-l lg:border-t-0">
            <p className="text-sm font-semibold text-white/70">Vorbereitete Daten</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="Baustellen" value={jobsitesResult.count ?? 0} />
              <Metric label="Aufträge" value={ordersResult.count ?? 0} />
              <Metric label="Lagerartikel" value={inventoryResult.count ?? 0} />
              <Metric label="Zeiten" value={timeResult.count ?? 0} />
            </div>
          </aside>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        {tourCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.href} className="interactive-surface p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-mint text-moss">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-black text-ink">{card.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{card.text}</p>
                  <Link href={card.href} className="btn-primary mt-4">
                    {card.label}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="mt-6 rounded-lg border border-primary/20 bg-mint p-4 sm:p-5">
        <p className="font-black text-primary-dark">Merksatz für Interessenten</p>
        <p className="mt-2 text-sm leading-6 text-primary-dark/80">
          BauPro ist nicht nur digitale Ablage. BauPro verbindet Auftrag, Aufmaß, Material, Mitbringliste,
          Zeiten, Berichte und Chef-Auswertung in einem Ablauf.
        </p>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white/10 p-3 ring-1 ring-white/10">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-semibold text-white/65">{label}</p>
    </div>
  );
}
