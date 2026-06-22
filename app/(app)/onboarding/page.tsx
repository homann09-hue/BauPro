import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  HardHat,
  ListChecks,
  PlayCircle,
  Sparkles,
  type LucideIcon,
  Users
} from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import {
  completeOnboardingAction,
  createOnboardingDemoDataAction,
  importOnboardingEmployeesAction,
  importOnboardingJobsitesAction,
  updateOnboardingCompanyAction
} from "@/lib/actions/onboarding-actions";
import { requireManager } from "@/lib/auth";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";

type CompanySetup = {
  id: string;
  name: string;
  contact_email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  onboarding_completed_at?: string | null;
};

const employeeExample = `Name;E-Mail;Rolle
Max Becker;max.becker@example.de;mitarbeiter
Lena Koch;lena.koch@example.de;vorarbeiter`;

const jobsiteExample = `Baustelle;Kunde;Adresse;Startdatum;Status;Notizen
Dachsanierung Hauptstraße;Müller GmbH;Hauptstraße 12, 50667 Köln;2026-06-22;aktiv;Gerüst steht
Rinnenreparatur Gartenweg;Schneider;Gartenweg 4, 53111 Bonn;2026-06-24;geplant;Material prüfen`;

export default async function OnboardingPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);

  const [companyResult, employeesResult, jobsitesResult, reportsResult, inventoryResult] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, contact_email, phone, address, website, onboarding_completed_at")
      .eq("id", context.companyId)
      .maybeSingle(),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).eq("active", true),
    supabase.from("jobsites").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).is("archived_at", null),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).is("archived_at", null),
    supabase.from("inventory_items").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).is("archived_at", null)
  ]);

  const company = (companyResult.data ?? { id: context.companyId, name: context.companyName }) as CompanySetup;
  const employees = employeesResult.count ?? 0;
  const jobsites = jobsitesResult.count ?? 0;
  const reports = reportsResult.count ?? 0;
  const inventoryItems = inventoryResult.count ?? 0;
  const queryError =
    safeQueryErrorMessage(companyResult.error) ||
    safeQueryErrorMessage(employeesResult.error) ||
    safeQueryErrorMessage(jobsitesResult.error) ||
    safeQueryErrorMessage(reportsResult.error) ||
    safeQueryErrorMessage(inventoryResult.error);
  const completedSteps = [
    Boolean(company.name && company.name !== "Meine Firma"),
    employees > 1,
    jobsites > 0,
    inventoryItems > 0 || reports > 0,
    Boolean(company.onboarding_completed_at)
  ].filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Startassistent"
        description="In fünf Minuten arbeitsfähig: Firma einrichten, Team importieren, Baustellen anlegen und erste Demo-Abläufe verstehen."
      />
      <MessageBox error={error || queryError} success={success} />

      <section className="overflow-hidden rounded-lg border border-slate-800 bg-anthracite text-white shadow-lift">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="p-5 sm:p-7">
            <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-xs font-black text-white ring-1 ring-white/10">
              <PlayCircle className="h-4 w-4 text-warning" aria-hidden="true" />
              5-Minuten-Setup
            </div>
            <h1 className="max-w-3xl text-3xl font-black tracking-normal text-white sm:text-4xl">
              Ein Chef soll BauPro ohne Schulung starten können.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
              Der Assistent führt durch die wichtigsten ersten Schritte. Danach sind Dashboard, Team, Baustellen, Materialwarnungen
              und Tagesberichte sofort greifbar.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HeroStep icon={Building2} label="Firma" done={company.name !== "Meine Firma"} />
              <HeroStep icon={Users} label="Team" done={employees > 1} />
              <HeroStep icon={HardHat} label="Baustellen" done={jobsites > 0} />
              <HeroStep icon={CheckCircle2} label="Startklar" done={Boolean(company.onboarding_completed_at)} />
            </div>
          </div>
          <aside className="border-t border-white/10 bg-slate-900 p-5 sm:p-7 lg:border-l lg:border-t-0">
            <p className="text-sm font-semibold text-white/70">Fortschritt</p>
            <p className="mt-2 text-4xl font-black text-white">{completedSteps}/5</p>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Empfohlen: Erst Demo-Daten testen, dann echte Mitarbeiter und Baustellen importieren.
            </p>
            <div className="mt-5 grid gap-2">
              <Link href="/warum-baupro" className="btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/15">
                Warum BauPro? erklären
              </Link>
              <Link href="/dashboard" className="btn-primary bg-primary text-white hover:bg-primary-dark">
                Zum Dashboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <div className="mt-6 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="space-y-5">
          <SetupCard
            step="1"
            icon={Building2}
            title="Firma einrichten"
            description="Name, Kontakt und Standort für Wetter, Dokumente und spätere Angebote vorbereiten."
          >
            <form action={updateOnboardingCompanyAction} className="grid gap-3">
              <input type="hidden" name="return_to" value="/onboarding" />
              <label>
                <span className="field-label">Firmenname</span>
                <input className="field-input" name="name" defaultValue={company.name ?? context.companyName} required />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="field-label">E-Mail Betrieb</span>
                  <input className="field-input" name="contact_email" type="email" defaultValue={company.contact_email ?? ""} />
                </label>
                <label>
                  <span className="field-label">Telefon</span>
                  <input className="field-input" name="phone" defaultValue={company.phone ?? ""} />
                </label>
              </div>
              <label>
                <span className="field-label">Firmenadresse</span>
                <input className="field-input" name="address" defaultValue={company.address ?? ""} />
              </label>
              <label>
                <span className="field-label">Webseite optional</span>
                <input className="field-input" name="website" defaultValue={company.website ?? ""} />
              </label>
              <SubmitButton>Firmendaten speichern</SubmitButton>
            </form>
          </SetupCard>

          <SetupCard
            step="2"
            icon={Sparkles}
            title="Demo-Daten aktivieren"
            description="Sichere Beispieldaten für Verkauf, Schulung und erstes Verstehen. Keine echten Kundendaten."
          >
            <form action={createOnboardingDemoDataAction}>
              <input type="hidden" name="return_to" value="/onboarding" />
              <SubmitButton className="w-full" variant="secondary">
                Demo-Daten anlegen
              </SubmitButton>
            </form>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Legt Demo-Kunde, Demo-Baustelle, Lagerartikel, Aufgaben, Materialwarnung und Einkaufsvorschlag an.
            </p>
          </SetupCard>
        </section>

        <section className="space-y-5">
          <SetupCard
            step="3"
            icon={FileSpreadsheet}
            title="Mitarbeiter importieren"
            description="Aus Excel/Numbers kopieren und einfügen. Format: Name;E-Mail;Rolle."
          >
            <form action={importOnboardingEmployeesAction} className="grid gap-3">
              <input type="hidden" name="return_to" value="/onboarding" />
              <label>
                <span className="field-label">Gemeinsames Startpasswort</span>
                <input className="field-input" name="start_password" type="password" minLength={8} placeholder="Mindestens 8 Zeichen" required />
                <span className="field-help">Nur für den Import. Danach Passwörter im echten Betrieb individuell ändern lassen.</span>
              </label>
              <label>
                <span className="field-label">Mitarbeiter CSV</span>
                <textarea className="field-input min-h-36 font-mono text-sm" name="employees_csv" defaultValue={employeeExample} required />
              </label>
              <SubmitButton>Mitarbeiter importieren</SubmitButton>
            </form>
          </SetupCard>

          <SetupCard
            step="4"
            icon={HardHat}
            title="Baustellen importieren"
            description="Format: Baustelle;Kunde;Adresse;Startdatum;Status;Notizen."
          >
            <form action={importOnboardingJobsitesAction} className="grid gap-3">
              <input type="hidden" name="return_to" value="/onboarding" />
              <label>
                <span className="field-label">Baustellen CSV</span>
                <textarea className="field-input min-h-36 font-mono text-sm" name="jobsites_csv" defaultValue={jobsiteExample} required />
              </label>
              <SubmitButton>Baustellen importieren</SubmitButton>
            </form>
          </SetupCard>
        </section>
      </div>

      <section className="mt-6 dashboard-band">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-mint text-moss">
            <ListChecks className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="section-kicker">Schritt-für-Schritt Einführung</p>
            <h2 className="section-title">Was ein Chef nach 5 Minuten verstanden haben soll</h2>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-5">
          <IntroStep title="Dashboard" text="Heute, Materialwarnungen, offene Zeiten und Schnellaktionen lesen." href="/dashboard" />
          <IntroStep title="Auftrag" text="Auftrag mit Maßen öffnen und Materialbedarf erklären." href="/orders/new" />
          <IntroStep title="Team" text="Mitarbeiterrollen prüfen: Chef, Vorarbeiter, Mitarbeiter." href="/team" />
          <IntroStep title="Baustelle" text="Adresse, Aufgaben, Bericht und Material an einem Ort sehen." href="/baustellen" />
          <IntroStep title="Zeit" text="Tagesstunden prüfen und Stundenzettel als PDF vorbereiten." href="/time-tracking/daily" />
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Link href="/hilfe" className="btn-secondary">
            Hilfe-Center öffnen
          </Link>
          <form action={completeOnboardingAction}>
            <input type="hidden" name="return_to" value="/onboarding" />
            <button className="btn-primary w-full sm:w-auto" type="submit">
              Startassistent abschließen
            </button>
          </form>
        </div>
      </section>
    </>
  );
}

function HeroStep({ icon: Icon, label, done }: { icon: LucideIcon; label: string; done: boolean }) {
  return (
    <div className="rounded-md bg-white/10 p-3 ring-1 ring-white/10">
      <Icon className={done ? "h-5 w-5 text-mint" : "h-5 w-5 text-white/50"} aria-hidden="true" />
      <p className="mt-2 text-sm font-black text-white">{label}</p>
      <p className="mt-1 text-xs font-semibold text-white/60">{done ? "Erledigt" : "Offen"}</p>
    </div>
  );
}

function SetupCard({
  step,
  icon: Icon,
  title,
  description,
  children
}: {
  step: string;
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-anthracite text-white">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="meta-label">Schritt {step}</p>
          <h2 className="section-title">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function IntroStep({ title, text, href }: { title: string; text: string; href: string }) {
  return (
    <Link href={href} className="interactive-surface p-4">
      <ClipboardList className="mb-3 h-5 w-5 text-moss" aria-hidden="true" />
      <p className="font-black text-ink">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
      <p className="mt-3 inline-flex items-center gap-1 text-sm font-black text-moss">
        Öffnen
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </p>
    </Link>
  );
}
