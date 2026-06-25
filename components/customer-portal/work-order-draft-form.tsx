"use client";

import { type FormEvent, useState, useSyncExternalStore } from "react";
import { FileSignature, Loader2 } from "lucide-react";

type ActionState = {
  success?: string;
  error?: string;
};

function statusUrl(path: string, type: "success" | "error", message: string) {
  return `${path}?${type}=${encodeURIComponent(message)}`;
}

export function WorkOrderDraftForm({
  orderId,
  orderNumber,
  defaultDescription
}: {
  orderId: string;
  orderNumber: string;
  defaultDescription: string | null;
}) {
  const [state, setState] = useState<ActionState>({});
  const [pending, setPending] = useState(false);
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const disabled = pending || !hydrated;
  const fallbackDescription = defaultDescription ?? "Bitte Leistung, Umfang und Besonderheiten für den Kunden eintragen.";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState({});

    const formData = new FormData(event.currentTarget);
    const payload = {
      orderId,
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      scopeOfWork: String(formData.get("scope_of_work") ?? ""),
      priceNote: String(formData.get("price_note") ?? "")
    };

    try {
      const response = await fetch("/api/customer-portal/work-orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = (await response.json()) as ActionState;

      if (!response.ok || body.error) {
        setState({ error: body.error ?? "Arbeitsauftrag konnte nicht erstellt werden." });
        setPending(false);
        return;
      }

      const success = body.success ?? "Arbeitsauftrag wurde als Entwurf angelegt.";
      setState({ success });
      window.setTimeout(() => window.location.assign(statusUrl(`/orders/${orderId}`, "success", success)), 250);
    } catch {
      setState({ error: "Arbeitsauftrag konnte nicht erstellt werden." });
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 grid gap-3 rounded-lg border border-line bg-fog p-3" data-testid="work-order-form">
      <label>
        <span className="field-label">Titel</span>
        <input className="field-input" name="title" defaultValue={`Arbeitsauftrag ${orderNumber}`} disabled={disabled} />
      </label>
      <label>
        <span className="field-label">Kurzbeschreibung</span>
        <input className="field-input" name="description" defaultValue={defaultDescription ?? ""} disabled={disabled} />
      </label>
      <label>
        <span className="field-label">Leistungsbeschreibung für Kunden</span>
        <textarea className="field-input min-h-28" name="scope_of_work" defaultValue={fallbackDescription} disabled={disabled} />
      </label>
      <label>
        <span className="field-label">Preis-/Angebotshinweis für Kunden</span>
        <input className="field-input" name="price_note" placeholder="z. B. gemäß Angebot vom ..." disabled={disabled} />
      </label>
      <button className="btn-secondary justify-self-start" type="submit" disabled={disabled}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileSignature className="h-4 w-4" aria-hidden="true" />}
        {pending ? "Entwurf wird angelegt..." : state.success ? "Entwurf angelegt" : "Entwurf anlegen"}
      </button>
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
