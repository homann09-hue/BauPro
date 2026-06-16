import Link from "next/link";
import { signInAction } from "@/lib/actions/auth-actions";
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
    <div className="surface-strong construction-rail p-5 sm:p-7">
      <p className="section-kicker mb-2">Willkommen zurück</p>
      <h1 className="text-2xl font-black text-ink">Einloggen</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Melde dich mit deinem Firmenaccount an.
      </p>

      <div className="mt-5">
        <MessageBox error={error} success={success} />
      </div>

      <form action={signInAction} className="mt-5 space-y-4">
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

      <p className="mt-6 rounded-md bg-fog px-3 py-3 text-center text-sm text-slate-600">
        Noch kein Account?{" "}
        <Link href="/register" className="font-semibold text-primary">
          Firma registrieren
        </Link>
      </p>
    </div>
  );
}
