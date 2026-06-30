"use client";

import { useState, useSyncExternalStore } from "react";
import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";

type ActionState = {
  success?: string;
  error?: string;
};

function statusUrl(returnTo: string, type: "success" | "error", message: string) {
  const separator = returnTo.includes("?") ? "&" : "?";
  return `${returnTo}${separator}${type}=${encodeURIComponent(message)}`;
}

export function MaterialConfirmationForm({ reportId, returnTo }: { reportId: string; returnTo: string }) {
  const [state, setState] = useState<ActionState>({});
  const [pending, setPending] = useState(false);
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );

  const message = state.error ?? state.success;
  const disabled = pending || Boolean(state.success) || !hydrated;

  async function submit(decision: "confirmed" | "rejected", formData: FormData) {
    setPending(true);
    setState({});

    try {
      const response = await fetch("/api/materials/usage-reports/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reportId,
          decision,
          note: String(formData.get("confirmation_note") ?? "")
        })
      });
      const payload = (await response.json()) as ActionState;

      if (!response.ok || payload.error) {
        const error = payload.error ?? "Materialmeldung konnte nicht verarbeitet werden.";
        setState({ error });
        setPending(false);
        return;
      }

      const success = payload.success ?? "Materialmeldung wurde verarbeitet.";
      setState({ success });
      setPending(false);
      window.setTimeout(() => window.location.assign(statusUrl(returnTo, "success", success)), 250);
    } catch {
      setState({ error: "Materialmeldung konnte nicht verarbeitet werden." });
      setPending(false);
    }
  }

  return (
    <form
      className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"
      data-testid="material-confirmation-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit("confirmed", new FormData(event.currentTarget));
      }}
    >
      <input className="field-input" name="confirmation_note" placeholder="Kommentar / Grund optional" disabled={disabled} />
      <button className="btn-primary" type="submit" disabled={disabled}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
        {pending ? "Wird bestätigt..." : "Bestätigen"}
      </button>
      <button
        className="btn-secondary"
        type="button"
        disabled={disabled}
        onClick={(event) => {
          const form = event.currentTarget.form;
          if (!form) return;
          void submit("rejected", new FormData(form));
        }}
      >
        <XCircle className="h-4 w-4" aria-hidden="true" />
        Ablehnen
      </button>
      {message ? (
        <div
          className={
            state.error
              ? "flex min-h-11 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 sm:col-span-3"
              : "flex min-h-11 items-center gap-2 rounded-md border border-primary/30 bg-mint px-3 py-2 text-sm font-bold text-primary-dark sm:col-span-3"
          }
          role={state.error ? "alert" : "status"}
        >
          {state.error ? <AlertCircle className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          {message}
        </div>
      ) : null}
    </form>
  );
}
