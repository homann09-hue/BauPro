"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { KeyRound, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import {
  enrollMfaAction,
  unenrollMfaAction,
  verifyMfaEnrollmentAction,
  type MfaEnrollmentResult,
  type MfaFactorSummary
} from "@/lib/actions/mfa-actions";
import { SubmitButton } from "@/components/submit-button";

type MfaSettingsPanelProps = {
  factors: MfaFactorSummary[];
};

export function MfaSettingsPanel({ factors }: MfaSettingsPanelProps) {
  const verifiedFactors = factors.filter((factor) => factor.status === "verified");
  const [enrollment, setEnrollment] = useState<MfaEnrollmentResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const mfaActive = verifiedFactors.length > 0;

  function startEnrollment() {
    startTransition(async () => {
      const result = await enrollMfaAction();
      setEnrollment(result);
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
      <section className="surface p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-mint text-moss">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="meta-label">Account-Schutz</p>
            <h2 className="section-title">Zwei-Faktor-Authentifizierung</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Empfohlen für Admin- und Chef-Accounts. Der Login benötigt dann zusätzlich einen Code aus deiner Authenticator-App.
            </p>
          </div>
        </div>

        <div className={mfaActive ? "rounded-md border border-emerald-200 bg-emerald-50 p-3" : "rounded-md border border-warning/30 bg-warning/10 p-3"}>
          <p className={mfaActive ? "font-black text-emerald-900" : "font-black text-amber-900"}>
            Status: {mfaActive ? "2FA aktiv" : "2FA nicht aktiv"}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {mfaActive
              ? "Dieser Account ist zusätzlich mit einem TOTP-Faktor geschützt."
              : "Aktiviere 2FA, um Passwortdiebstahl deutlich weniger gefährlich zu machen."}
          </p>
        </div>

        {!mfaActive ? (
          <div className="mt-5">
            {!enrollment || !enrollment.ok ? (
              <>
                {enrollment && !enrollment.ok ? (
                  <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                    {enrollment.error}
                  </p>
                ) : null}
                <button className="btn-primary w-full sm:w-auto" disabled={isPending} onClick={startEnrollment} type="button">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
                  2FA einrichten
                </button>
              </>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
                <div className="rounded-lg border border-line bg-white p-3 shadow-sm">
                  <Image
                    alt="QR-Code für die Authenticator-App"
                    className="h-auto w-full rounded-md"
                    height={240}
                    src={enrollment.qrCodeDataUrl}
                    unoptimized
                    width={240}
                  />
                </div>
                <div>
                  <h3 className="font-black text-ink">Authenticator-App verbinden</h3>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-600">
                    <li>Scanne den QR-Code mit deiner Authenticator-App.</li>
                    <li>Gib danach den 6-stelligen Code ein.</li>
                    <li>Erst nach Bestätigung ist 2FA aktiv.</li>
                  </ol>
                  <details className="mt-3 rounded-md border border-line bg-fog p-3 text-sm text-slate-700">
                    <summary className="cursor-pointer font-bold text-ink">Manueller Schlüssel</summary>
                    <code className="mt-2 block break-all rounded bg-white p-2 text-xs">{enrollment.secret}</code>
                  </details>

                  <form action={verifyMfaEnrollmentAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <input type="hidden" name="factor_id" value={enrollment.factorId} />
                    <label>
                      <span className="field-label">Bestätigungscode</span>
                      <input
                        autoComplete="one-time-code"
                        className="field-input text-center text-xl font-black"
                        inputMode="numeric"
                        maxLength={6}
                        minLength={6}
                        name="code"
                        pattern="[0-9]{6}"
                        required
                      />
                    </label>
                    <SubmitButton className="self-end" pendingLabel="Wird geprüft...">
                      Aktivieren
                    </SubmitButton>
                  </form>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="surface p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
            <ShieldOff className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="meta-label">Verwaltung</p>
            <h2 className="section-title">Aktive Faktoren</h2>
          </div>
        </div>

        {verifiedFactors.length === 0 ? (
          <p className="rounded-md border border-line bg-fog p-3 text-sm text-slate-600">Noch kein aktiver TOTP-Faktor vorhanden.</p>
        ) : (
          <div className="space-y-3">
            {verifiedFactors.map((factor) => (
              <div key={factor.id} className="rounded-lg border border-line bg-white p-3">
                <p className="font-black text-ink">{factor.friendlyName ?? "Authenticator-App"}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Aktiv seit {factor.createdAt.slice(0, 10)}</p>
                <form action={unenrollMfaAction} className="mt-3 grid gap-2">
                  <input type="hidden" name="factor_id" value={factor.id} />
                  <label>
                    <span className="field-label">Passwort zur Bestätigung</span>
                    <input className="field-input" name="password" type="password" autoComplete="current-password" required />
                  </label>
                  <SubmitButton variant="danger" pendingLabel="Wird entfernt...">
                    2FA entfernen
                  </SubmitButton>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
