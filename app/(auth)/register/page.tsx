import Link from "next/link";
import { signUpCompanyAction } from "@/lib/actions/auth-actions";
import { MessageBox } from "@/components/message-box";
import { SubmitButton } from "@/components/submit-button";
import { searchParamMessage } from "@/lib/utils";

export default async function RegisterPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error, success } = searchParamMessage(await searchParams);

  return (
    <div className="surface-strong construction-rail p-5 sm:p-7">
      <p className="section-kicker mb-2">Start in 2 Minuten</p>
      <h1 className="text-2xl font-black text-ink">Firmenaccount anlegen</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Der erste Nutzer wird automatisch Admin der Firma.
      </p>

      <div className="mt-5">
        <MessageBox error={error} success={success} />
      </div>

      <form action={signUpCompanyAction} className="mt-5 space-y-4">
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
        <div>
          <label className="field-label" htmlFor="password">
            Passwort
          </label>
          <input
            className="field-input"
            id="password"
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
          <p className="field-help">Mindestens 8 Zeichen.</p>
        </div>
        <SubmitButton className="w-full">Account erstellen</SubmitButton>
      </form>

      <p className="mt-6 rounded-md bg-fog px-3 py-3 text-center text-sm text-slate-600">
        Erst ohne Eingabe testen?{" "}
        <Link href="/demo" className="font-semibold text-primary">
          Demo starten
        </Link>
      </p>

      <p className="mt-3 rounded-md bg-fog px-3 py-3 text-center text-sm text-slate-600">
        Bereits registriert?{" "}
        <Link href="/login" className="font-semibold text-primary">
          Einloggen
        </Link>
      </p>
    </div>
  );
}
