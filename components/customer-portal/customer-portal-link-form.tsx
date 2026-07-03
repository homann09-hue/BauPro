"use client";

import { type FormEvent, useState, useSyncExternalStore } from "react";
import { ExternalLink, Link2, Loader2 } from "lucide-react";

type LinkState = {
  success?: string;
  error?: string;
  portalUrl?: string;
};

type LinkResponse = LinkState & {
  portalToken?: string;
};

function portalUrl(token: string) {
  return `${window.location.origin}/portal/${encodeURIComponent(token)}`;
}

export function CustomerPortalLinkForm({ orderId, defaultLabel }: { orderId: string; defaultLabel: string }) {
  const [state, setState] = useState<LinkState>({});
  const [pending, setPending] = useState(false);
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const disabled = pending || !hydrated;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState({});

    const formData = new FormData(event.currentTarget);
    const payload = {
      orderId,
      label: String(formData.get("label") ?? ""),
      expiresDays: String(formData.get("expires_days") ?? "45")
    };

    try {
      const response = await fetch("/api/customer-portal/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = (await response.json()) as LinkResponse;

      if (!response.ok || body.error || !body.portalToken) {
        setState({ error: body.error ?? "Kundenportal-Link konnte nicht erstellt werden." });
        setPending(false);
        return;
      }

      const success = body.success ?? "Kundenportal-Link wurde erstellt.";
      const portalToken = body.portalToken;
      setState({ success, portalUrl: portalUrl(portalToken) });
      setPending(false);
    } catch {
      setState({ error: "Kundenportal-Link konnte nicht erstellt werden." });
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-2 rounded-lg border border-line bg-fog p-3 sm:grid-cols-[1fr_120px_auto] lg:min-w-[520px]"
      data-testid="portal-link-form"
    >
      <label>
        <span className="field-label">Bezeichnung</span>
        <input className="field-input" name="label" defaultValue={defaultLabel} disabled={disabled} />
      </label>
      <label>
        <span className="field-label">Gültig Tage</span>
        <select className="field-input" name="expires_days" defaultValue="45" disabled={disabled}>
          <option value="14">14</option>
          <option value="30">30</option>
          <option value="45">45</option>
          <option value="90">90</option>
        </select>
      </label>
      <button className="btn-primary self-end" type="submit" disabled={disabled}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
        {pending ? "Link wird erzeugt..." : state.success ? "Link erzeugt" : "Link erzeugen"}
      </button>
      {state.success && state.portalUrl ? (
        <div
          className="rounded-lg border border-primary/20 bg-mint p-3 sm:col-span-3"
          data-testid="fresh-portal-link"
          role="status"
        >
          <p className="text-sm font-black text-ink">Neuer Kundenlink, nur jetzt voll sichtbar</p>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            Der Link wird bewusst nicht in der Adresszeile gespeichert. Jetzt kopieren oder direkt öffnen.
          </p>
          <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_auto]">
            <input className="field-input bg-white" readOnly value={state.portalUrl} aria-label="Neuer Kundenportal-Link" />
            <a href={state.portalUrl} target="_blank" rel="noreferrer" className="btn-secondary">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Öffnen
            </a>
          </div>
        </div>
      ) : null}
      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 sm:col-span-3" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
