import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { SubmitButton } from "@/components/submit-button";
import { verifyLoginMfaChallengeAction } from "@/lib/actions/mfa-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MfaChallengePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!aal.error && aal.data?.currentLevel === "aal2") redirect("/dashboard");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.[0];

  if (!factor) {
    redirect("/login?error=Kein+aktiver+2FA-Faktor+gefunden.");
  }

  return (
    <div>
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center border border-line bg-surface-container-high text-ocher">
        <ShieldCheck className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="section-kicker mb-7">Zweiter Faktor</p>
      <h1 className="text-5xl font-extrabold leading-tight tracking-tight text-ink">2FA-Code</h1>
      <p className="mt-2 text-sm font-semibold leading-6 text-ash">
        Öffne deine Authenticator-App und gib den 6-stelligen Code ein.
      </p>

      <div className="mt-5">
        <MessageBox error={error} success={success} />
      </div>

      <form action={verifyLoginMfaChallengeAction} className="mt-5 space-y-4">
        <input type="hidden" name="factor_id" value={factor.id} />
        <label>
          <span className="field-label">Authenticator-Code</span>
          <input
            autoComplete="one-time-code"
            className="field-input text-center text-2xl font-black"
            inputMode="numeric"
            maxLength={6}
            minLength={6}
            name="code"
            pattern="[0-9]{6}"
            required
          />
        </label>
        <SubmitButton className="w-full" pendingLabel="Code wird geprüft...">
          Weiter
        </SubmitButton>
      </form>
    </div>
  );
}
