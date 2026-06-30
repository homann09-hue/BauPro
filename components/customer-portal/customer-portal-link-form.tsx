"use client";

import { type FormEvent, useState, useSyncExternalStore } from "react";
import { Link2, Loader2 } from "lucide-react";

type LinkState = {
  success?: string;
  error?: string;
  portalToken?: string;
};

function statusUrl(orderId: string, state: Required<Pick<LinkState, "success" | "portalToken">>) {
  const params = new URLSearchParams({ success: state.success, portal_token: state.portalToken });
  return `/orders/${orderId}?${params.toString()}`;
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
      const body = (await response.json()) as LinkState;

      if (!response.ok || body.error || !body.portalToken) {
        setState({ error: body.error ?? "Kundenportal-Link konnte nicht erstellt werden." });
        setPending(false);
        return;
      }

      const success = body.success ?? "Kundenportal-Link wurde erstellt.";
      const portalToken = body.portalToken;
      setState({ success, portalToken });
      setPending(false);
      window.setTimeout(() => window.location.assign(statusUrl(orderId, { success, portalToken })), 250);
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
      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 sm:col-span-3" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
