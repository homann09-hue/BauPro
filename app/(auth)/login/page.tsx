import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { SubmitButton } from "@/components/submit-button";
import { searchParamMessage } from "@/lib/utils";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error, success } = searchParamMessage(await searchParams);

  return (
    <div>
      <p className="section-kicker mb-7">Firmen-Login</p>
      <h1 className="text-5xl font-normal uppercase leading-none tracking-wide text-ink [font-family:var(--font-display)]">Einloggen</h1>
      <p className="mt-2 text-sm font-semibold text-slate-600">Melde dich mit deinem Firmenaccount an.</p>

      <div className="mt-8">
        <MessageBox error={error} success={success} />

        <form action="/api/auth/login" method="post" className="space-y-4">
          <div>
            <label className="field-label" htmlFor="email">
              E-Mail
            </label>
            <input className="field-input" id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <label className="field-label" htmlFor="password">
              Passwort
            </label>
            <input
              className="field-input"
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <SubmitButton className="w-full">Einloggen</SubmitButton>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-700">oder</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <div className="border border-line bg-surface p-4">
          <div className="flex items-start gap-3">
            <PlayCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="font-black text-ink">BauPro ohne Eingabe testen</p>
              <p className="mt-1 text-sm leading-6 text-ash">
                Starte eine vorbereitete Demo-Firma mit Baustellen, Team, Lager, Aufträgen und Tagesstunden.
              </p>
            </div>
          </div>
          <form action="/api/auth/demo/start" method="post" className="mt-3">
            <input type="hidden" name="return_to" value="/login" />
            <SubmitButton className="w-full justify-between" variant="secondary">
              Demo-Modus starten
              <ArrowRight className="h-4 w-4 text-primary" aria-hidden="true" />
            </SubmitButton>
          </form>
        </div>

        <p className="mt-7 flex justify-between gap-4 border-t border-line pt-5 text-sm text-slate-600">
          <span>Noch kein Account?</span>
          <Link href="/register" className="font-semibold text-primary">
            Firma registrieren →
          </Link>
        </p>
      </div>
    </div>
  );
}
