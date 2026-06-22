"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, HardHat, Upload, Users, type LucideIcon } from "lucide-react";
import { PasswordInputWithStrength } from "@/components/forms/password-strength-indicator";
import { createEmployeeAction, updateCompanyProfileAction } from "@/lib/actions/auth-actions";
import { createJobsiteAction } from "@/lib/actions/jobsite-actions";
import { completeOnboardingAction } from "@/lib/actions/onboarding-actions";

type OnboardingCompany = {
  name: string;
  trade: string | null;
  sessionTimeoutMinutes: number;
};

type OnboardingSummary = {
  employees: number;
  jobsites: number;
};

type OnboardingWizardProps = {
  company: OnboardingCompany;
  summary: OnboardingSummary;
  initialStep: number;
};

const steps = [
  {
    id: 1,
    title: "Willkommen",
    description: "Firma einrichten",
    icon: Building2
  },
  {
    id: 2,
    title: "Baustelle",
    description: "Ersten Auftrag greifbar machen",
    icon: HardHat
  },
  {
    id: 3,
    title: "Team",
    description: "Mitarbeiter einladen",
    icon: Users
  },
  {
    id: 4,
    title: "Bereit",
    description: "Start abschließen",
    icon: CheckCircle2
  }
] as const;

const tradeOptions = [
  { value: "dachdecker", label: "Dachdecker" },
  { value: "zimmermann", label: "Zimmermann" },
  { value: "klempner", label: "Klempner" },
  { value: "maler", label: "Maler" },
  { value: "sonstiges", label: "Sonstiges" }
];

const roleOptions = [
  { value: "mitarbeiter", label: "Mitarbeiter" },
  { value: "vorarbeiter", label: "Vorarbeiter" }
];

function clampStep(step: number) {
  if (!Number.isInteger(step)) return 1;
  return Math.min(4, Math.max(1, step));
}

function nextStepUrl(step: number) {
  return `/onboarding?step=${clampStep(step)}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function OnboardingWizard({ company, summary, initialStep }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(clampStep(initialStep));
  const progress = useMemo(() => (currentStep / steps.length) * 100, [currentStep]);

  return (
    <section className="mx-auto max-w-5xl">
      <div className="surface p-3 sm:p-5">
        <div className="mb-5 h-2 overflow-hidden rounded-full bg-coal">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          {steps.map((step) => (
            <button
              key={step.id}
              type="button"
              className={`rounded-md border p-3 text-left transition ${
                currentStep === step.id ? "border-primary bg-primary/10" : "border-line bg-coal hover:border-primary/40"
              }`}
              onClick={() => setCurrentStep(step.id)}
              aria-current={currentStep === step.id ? "step" : undefined}
            >
              <div className="flex items-center gap-2">
                <step.icon className={currentStep >= step.id ? "h-5 w-5 text-primary" : "h-5 w-5 text-slate-500"} aria-hidden="true" />
                <span className="text-xs font-black uppercase text-slate-500">Schritt {step.id}</span>
              </div>
              <p className="mt-2 font-display text-2xl uppercase leading-none text-ink">{step.title}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">{step.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {currentStep === 1 ? <CompanyStep company={company} /> : null}
        {currentStep === 2 ? <JobsiteStep onBack={() => setCurrentStep(1)} /> : null}
        {currentStep === 3 ? <EmployeeStep onBack={() => setCurrentStep(2)} onSkip={() => setCurrentStep(4)} /> : null}
        {currentStep === 4 ? <DoneStep summary={summary} onBack={() => setCurrentStep(3)} /> : null}
      </div>
    </section>
  );
}

function StepShell({
  icon: Icon,
  kicker,
  title,
  description,
  children
}: {
  icon: LucideIcon;
  kicker: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[0.85fr_1.15fr]">
        <aside className="border-b border-line bg-coal p-5 sm:p-7 lg:border-b-0 lg:border-r">
          <div className="flex h-14 w-14 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-primary">
            <Icon className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="mt-5 section-kicker">{kicker}</p>
          <h2 className="mt-2 font-display text-5xl uppercase leading-none text-ink sm:text-6xl">{title}</h2>
          <p className="mt-4 text-sm leading-6 text-slate-500">{description}</p>
        </aside>
        <div className="p-5 sm:p-7">{children}</div>
      </div>
    </section>
  );
}

function WizardActions({
  backLabel = "Zurück",
  nextLabel,
  onBack,
  children
}: {
  backLabel?: string;
  nextLabel: string;
  onBack?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {onBack ? (
        <button className="btn-secondary" type="button" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {backLabel}
        </button>
      ) : (
        <span />
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        {children}
        <button className="btn-primary" type="submit">
          {nextLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function CompanyStep({ company }: { company: OnboardingCompany }) {
  return (
    <StepShell
      icon={Building2}
      kicker="5-Minuten-Setup"
      title="Willkommen bei BauPro"
      description="Bestätige kurz den Betrieb. Das Gewerk hilft BauPro später bei Materialvorschlägen, Begriffen und Demo-Abläufen."
    >
      <form action={updateCompanyProfileAction} className="grid gap-4">
        <input type="hidden" name="return_to" value={nextStepUrl(2)} />
        <input type="hidden" name="session_timeout_minutes" value={company.sessionTimeoutMinutes} />
        <label>
          <span className="field-label">Firmenname</span>
          <input className="field-input" name="name" defaultValue={company.name} required />
        </label>
        <label>
          <span className="field-label">Gewerk</span>
          <select className="field-input" name="trade" defaultValue={company.trade ?? "dachdecker"}>
            {tradeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="rounded-md border border-dashed border-line bg-coal p-4">
          <span className="flex items-center gap-2 font-black text-ink">
            <Upload className="h-5 w-5 text-primary" aria-hidden="true" />
            Firmenlogo optional hochladen
          </span>
          <span className="mt-1 block text-sm text-slate-500">PNG, JPG, WebP oder SVG bis 1 MB.</span>
          <input className="mt-4 block w-full text-sm text-slate-400 file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-3 file:font-black file:text-ink" name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
        </label>
        <WizardActions nextLabel="Weiter zur Baustelle" />
      </form>
    </StepShell>
  );
}

function JobsiteStep({ onBack }: { onBack: () => void }) {
  return (
    <StepShell
      icon={HardHat}
      kicker="Erstes Ziel"
      title="Erste Baustelle anlegen"
      description="Eine echte Baustelle macht das Dashboard sofort verständlich: Termine, Berichte, Material und Zeiten hängen daran."
    >
      <form action={createJobsiteAction} className="grid gap-4">
        <input type="hidden" name="return_to" value={nextStepUrl(3)} />
        <label>
          <span className="field-label">Baustellenname</span>
          <input className="field-input" name="name" placeholder="z. B. Dachsanierung Hauptstraße" required />
        </label>
        <label>
          <span className="field-label">Kunde / Objekt</span>
          <input className="field-input" name="customer" placeholder="z. B. Familie Müller" required />
        </label>
        <label>
          <span className="field-label">Baustellenadresse</span>
          <input className="field-input" name="address" placeholder="Straße, PLZ Ort" required />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="field-label">Startdatum</span>
            <input className="field-input" name="start_date" type="date" defaultValue={todayIso()} required />
          </label>
          <label>
            <span className="field-label">Status</span>
            <select className="field-input" name="status" defaultValue="geplant">
              <option value="geplant">Geplant</option>
              <option value="aktiv">Aktiv</option>
            </select>
          </label>
        </div>
        <label>
          <span className="field-label">Notizen optional</span>
          <textarea className="field-input min-h-24" name="notes" placeholder="Was soll der Betrieb direkt wissen?" />
        </label>
        <WizardActions nextLabel="Baustelle speichern" onBack={onBack} />
      </form>
    </StepShell>
  );
}

function EmployeeStep({ onBack, onSkip }: { onBack: () => void; onSkip: () => void }) {
  return (
    <StepShell
      icon={Users}
      kicker="Team"
      title="Ersten Mitarbeiter einladen"
      description="Lege einen Mitarbeiter oder Vorarbeiter an. Du kannst diesen Schritt überspringen und das Team später pflegen."
    >
      <form action={createEmployeeAction} className="grid gap-4">
        <input type="hidden" name="return_to" value={nextStepUrl(4)} />
        <label>
          <span className="field-label">Name</span>
          <input className="field-input" name="full_name" placeholder="z. B. Max Becker" required />
        </label>
        <label>
          <span className="field-label">E-Mail</span>
          <input className="field-input" name="email" type="email" placeholder="max@betrieb.de" required />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="field-label">Rolle</span>
            <select className="field-input" name="role" defaultValue="mitarbeiter">
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <PasswordInputWithStrength
            id="onboarding-employee-password"
            label="Startpasswort"
            placeholder="Mindestens 8 Zeichen"
            helpText="Wird vor dem Speichern auf bekannte Datenlecks geprüft."
          />
        </div>
        <WizardActions nextLabel="Mitarbeiter speichern" onBack={onBack}>
          <button className="btn-secondary" type="button" onClick={onSkip}>
            Überspringen
          </button>
        </WizardActions>
      </form>
    </StepShell>
  );
}

function DoneStep({ summary, onBack }: { summary: OnboardingSummary; onBack: () => void }) {
  return (
    <StepShell
      icon={CheckCircle2}
      kicker="Startklar"
      title="Alles bereit!"
      description="BauPro hat jetzt genug Struktur, damit ein Chef das Produkt ohne Schulung versteht und direkt weiterarbeiten kann."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryCard label="Mitarbeiter in der Firma" value={summary.employees} />
        <SummaryCard label="Baustellen angelegt" value={summary.jobsites} />
      </div>
      <div className="mt-5 rounded-md border border-primary/30 bg-primary/10 p-4">
        <p className="font-black text-ink">Nächster sinnvoller Schritt</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Öffne das Dashboard, prüfe die erste Baustelle und nutze danach die Schnellaktionen für Zeit, Bericht und Material.
        </p>
      </div>
      <form action={completeOnboardingAction}>
        <WizardActions nextLabel="Zum Dashboard" onBack={onBack} />
      </form>
    </StepShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-coal p-4">
      <p className="font-display text-4xl uppercase leading-none text-ink">{value}</p>
      <p className="mt-2 text-sm font-black uppercase text-slate-500">{label}</p>
    </div>
  );
}
