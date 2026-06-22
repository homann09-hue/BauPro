import Link from "next/link";
import { signUpCompanyAction } from "@/lib/actions/auth-actions";
import { MessageBox } from "@/components/message-box";
import { PasswordInputWithStrength } from "@/components/forms/password-strength-indicator";
import { SubmitButton } from "@/components/submit-button";
import { searchParamMessage } from "@/lib/utils";

export default async function RegisterPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error, success } = searchParamMessage(await searchParams);

  return (
    <div>
      <p className="section-kicker mb-7">Start in 2 Minuten</p>
      <h1 className="text-5xl font-normal uppercase leading-none tracking-wide text-ink [font-family:var(--font-display)]">
        Firmenaccount
      </h1>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
        Der erste Nutzer wird Admin. Danach richtest du Team, Baustellen und Demo-Daten ein.
      </p>

      <div className="mt-8">
        <MessageBox error={error} success={success} />

        <form action={signUpCompanyAction} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="company_name">
              Firmenname
            </label>
            <input className="field-input" id="company_name" name="company_name" required />
          </div>
          <div>
            <label className="field-label" htmlFor="full_name">
              Dein Name
            </label>
            <input className="field-input" id="full_name" name="full_name" autoComplete="name" required />
          </div>
          <div>
            <label className="field-label" htmlFor="email">
              E-Mail
            </label>
            <input className="field-input" id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <PasswordInputWithStrength
            id="password"
            helpText="Mindestens 8 Zeichen. Vermeide Namen, Firmenname und einfache Muster."
          />
          <SubmitButton className="w-full">Account erstellen</SubmitButton>
        </form>

        <p className="mt-7 flex justify-between gap-4 border-t border-line pt-5 text-sm text-slate-600">
          <span>Erst ohne Eingabe testen?</span>
          <Link href="/demo" className="font-semibold text-primary">
            Demo starten →
          </Link>
        </p>

        <p className="mt-3 flex justify-between gap-4 text-sm text-slate-600">
          <span>Bereits registriert?</span>
          <Link href="/login" className="font-semibold text-primary">
            Einloggen →
          </Link>
        </p>
      </div>
    </div>
  );
}
