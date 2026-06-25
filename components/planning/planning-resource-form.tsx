"use client";

import { useState, useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";

type Option = {
  value: string;
  label: string;
};

type ActionState = {
  success?: string;
  error?: string;
};

function statusUrl(returnTo: string, type: "success" | "error", message: string) {
  const separator = returnTo.includes("?") ? "&" : "?";
  return `${returnTo}${separator}${type}=${encodeURIComponent(message)}`;
}

export function PlanningResourceForm({
  returnTo,
  kindOptions,
  statusOptions
}: {
  returnTo: string;
  kindOptions: Option[];
  statusOptions: Option[];
}) {
  const [state, setState] = useState<ActionState>({});
  const [pending, setPending] = useState(false);
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const disabled = pending || !hydrated || Boolean(state.success);

  async function submit(formData: FormData) {
    setPending(true);
    setState({});

    try {
      const response = await fetch("/api/planning/resources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          resourceKind: String(formData.get("resource_kind") ?? ""),
          status: String(formData.get("status") ?? ""),
          notes: String(formData.get("notes") ?? "")
        })
      });
      const payload = (await response.json()) as ActionState;

      if (!response.ok || payload.error) {
        setState({ error: payload.error ?? "Ressource konnte nicht angelegt werden." });
        setPending(false);
        return;
      }

      const success = payload.success ?? "Ressource wurde angelegt.";
      window.location.assign(statusUrl(returnTo, "success", success));
    } catch {
      setState({ error: "Ressource konnte nicht angelegt werden." });
      setPending(false);
    }
  }

  return (
    <form
      className="grid gap-3"
      data-testid="planning-resource-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
    >
      <div>
        <label className="field-label" htmlFor="name">
          Name
        </label>
        <input className="field-input" id="name" name="name" placeholder="z. B. Kran, Brenner, Geruest" required disabled={disabled} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="resource_kind">
            Art
          </label>
          <select className="field-input" id="resource_kind" name="resource_kind" defaultValue="maschine" disabled={disabled}>
            {kindOptions.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="resource_status">
            Status
          </label>
          <select className="field-input" id="resource_status" name="status" defaultValue="verfuegbar" disabled={disabled}>
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="resource_notes">
          Notiz
        </label>
        <textarea className="field-input min-h-24" id="resource_notes" name="notes" disabled={disabled} />
      </div>
      <button className="btn-secondary w-full" type="submit" disabled={disabled}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {pending ? "Speichern..." : state.success ? "Gespeichert" : "Ressource anlegen"}
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
