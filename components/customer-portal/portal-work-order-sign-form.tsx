"use client";

import { type FormEvent, useRef, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { SignaturePad } from "@/components/signature/signature-pad";

type SignState = {
  success?: string;
  error?: string;
};

function portalStatusUrl(token: string, type: "success" | "error", message: string) {
  return `/portal/${encodeURIComponent(token)}?${type}=${encodeURIComponent(message)}`;
}

export function PortalWorkOrderSignForm({ token, workOrderId }: { token: string; workOrderId: string }) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, setState] = useState<SignState>({});
  const [pendingDecision, setPendingDecision] = useState<"sign" | "reject" | null>(null);
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const disabled = Boolean(pendingDecision) || !hydrated || Boolean(state.success);

  async function send(decision: "sign" | "reject") {
    const form = formRef.current;
    if (!form) return;

    setPendingDecision(decision);
    setState({});

    const formData = new FormData(form);
    const payload = {
      token,
      workOrderId,
      decision,
      signerName: String(formData.get("signer_name") ?? ""),
      signatureDataUrl: String(formData.get("signature_data_url") ?? ""),
      rejectionReason: String(formData.get("rejection_reason") ?? "")
    };

    try {
      const response = await fetch("/api/customer-portal/work-orders/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = (await response.json()) as SignState;

      if (!response.ok || body.error) {
        setState({ error: body.error ?? "Arbeitsauftrag konnte nicht verarbeitet werden." });
        setPendingDecision(null);
        return;
      }

      const success = body.success ?? "Arbeitsauftrag wurde verarbeitet.";
      setState({ success });
      setPendingDecision(null);
      window.setTimeout(() => window.location.assign(portalStatusUrl(token, "success", success)), 250);
    } catch {
      setState({ error: "Arbeitsauftrag konnte nicht verarbeitet werden." });
      setPendingDecision(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <form ref={formRef} onSubmit={submit} className="mt-4 grid gap-3 rounded-lg border border-line bg-fog p-3" data-testid="portal-work-order-sign-form">
      <label>
        <span className="field-label">Ihr Name</span>
        <input className="field-input" name="signer_name" required maxLength={120} placeholder="Vor- und Nachname" disabled={disabled} />
      </label>
      <SignaturePad label="Unterschrift für Bestätigung" required />
      <label>
        <span className="field-label">Rückmeldung bei Ablehnung</span>
        <textarea
          className="field-input min-h-20"
          name="rejection_reason"
          maxLength={1000}
          placeholder="Bei Ablehnung bitte kurz angeben, was der Betrieb anpassen soll."
          disabled={disabled}
        />
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button className="btn-primary" type="button" disabled={disabled} onClick={() => void send("sign")}>
          {pendingDecision === "sign" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          {pendingDecision === "sign" ? "Wird bestätigt..." : "Auftrag bestätigen"}
        </button>
        <button className="btn-secondary" type="button" disabled={disabled} onClick={() => void send("reject")}>
          {pendingDecision === "reject" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
          {pendingDecision === "reject" ? "Wird gespeichert..." : "Ablehnen"}
        </button>
      </div>
      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-md border border-primary/30 bg-mint px-3 py-2 text-sm font-bold text-primary-dark" role="status">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
