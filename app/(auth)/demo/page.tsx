import Link from "next/link";
import { ArrowRight, Clock3, HardHat, PackageCheck, ShieldCheck, Users } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { SubmitButton } from "@/components/submit-button";
import { startDemoModeAction } from "@/lib/actions/auth-actions";
import { DEMO_USER_SHORTCUTS } from "@/lib/demo/constants";
import { searchParamMessage } from "@/lib/utils";

export default async function DemoPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error, success } = searchParamMessage(await searchParams);

  return (
    <div>
      <p className="section-kicker mb-7">Demo-Modus</p>
      <h1 className="text-5xl font-normal uppercase leading-none tracking-wide text-ink [font-family:var(--font-display)]">BauPro ohne Eingabe testen</h1>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
        Starte direkt mit einer realistischen Dachdeckerfirma: Baustellen, Team, Lager, Aufträge,
        Zeiten, Berichte und Materialwarnungen sind bereits vorbereitet.
      </p>

      <div className="mt-5">
        <MessageBox error={error} success={success} />
      </div>

      <form action={startDemoModeAction} className="mt-5">
        <input type="hidden" name="return_to" value="/demo" />
        <SubmitButton className="min-h-14 w-full text-base">
          Demo in 2 Minuten starten
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </SubmitButton>
      </form>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <DemoPoint icon={HardHat} title="Baustellen" text="Aktive und geplante Aufträge mit Aufmass." />
        <DemoPoint icon={PackageCheck} title="Lager" text="Bestand, Mindestbestand und Einkaufsvorschläge." />
        <DemoPoint icon={Clock3} title="Zeiten" text="Eingereichte Stunden und Chef-Freigaben." />
        <DemoPoint icon={Users} title="Team" text="Chef, Vorarbeiter und Mitarbeiterrollen." />
      </div>

      <div className="mt-5 border border-line bg-surface p-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-moss" aria-hidden="true" />
          <p className="text-sm leading-6 text-slate-600">
            Die Demo nutzt ausschließlich fiktive Daten. In Production muss der Demo-Modus explizit aktiviert werden.
          </p>
        </div>
        <div className="mt-3 grid gap-2">
          {DEMO_USER_SHORTCUTS.map((user) => (
            <div key={user.email} className="flex items-center justify-between gap-3 border border-line bg-mint px-3 py-2 text-xs font-semibold text-slate-500">
              <span>{user.label}</span>
              <span className="truncate font-mono">{user.email}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-6 flex justify-between gap-4 border-t border-line pt-5 text-sm text-slate-600">
        <span>Lieber mit eigener Firma starten?</span>
        <Link href="/register" className="font-semibold text-primary">
          Account anlegen →
        </Link>
      </p>
    </div>
  );
}

function DemoPoint({ icon: Icon, title, text }: { icon: typeof HardHat; title: string; text: string }) {
  return (
    <div className="border border-line bg-surface p-3">
      <Icon className="mb-2 h-5 w-5 text-moss" aria-hidden="true" />
      <p className="font-black text-ink">{title}</p>
      <p className="mt-1 text-sm leading-5 text-slate-600">{text}</p>
    </div>
  );
}
