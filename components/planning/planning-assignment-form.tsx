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

export function PlanningAssignmentForm({
  returnTo,
  employeeOptions,
  vehicleOptions,
  resourceOptions,
  jobsiteOptions,
  statusOptions,
  defaultDate
}: {
  returnTo: string;
  employeeOptions: Option[];
  vehicleOptions: Option[];
  resourceOptions: Option[];
  jobsiteOptions: Option[];
  statusOptions: Option[];
  defaultDate: string;
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
      const response = await fetch("/api/planning/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          resourceKey: String(formData.get("resource_key") ?? ""),
          jobsiteId: String(formData.get("jobsite_id") ?? ""),
          title: String(formData.get("title") ?? ""),
          status: String(formData.get("status") ?? ""),
          startDate: String(formData.get("start_date") ?? ""),
          endDate: String(formData.get("end_date") ?? ""),
          color: String(formData.get("color") ?? ""),
          notes: String(formData.get("notes") ?? "")
        })
      });
      const payload = (await response.json()) as ActionState;

      if (!response.ok || payload.error) {
        setState({ error: payload.error ?? "Planung konnte nicht gespeichert werden." });
        setPending(false);
        return;
      }

      const success = payload.success ?? "Planung wurde gespeichert.";
      setState({ success });
      window.setTimeout(() => window.location.assign(statusUrl(returnTo, "success", success)), 250);
    } catch {
      setState({ error: "Planung konnte nicht gespeichert werden." });
      setPending(false);
    }
  }

  return (
    <form
      className="grid gap-3 lg:grid-cols-2"
      data-testid="planning-assignment-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
    >
      <div>
        <label className="field-label" htmlFor="resource_key">
          Ressource
        </label>
        <select className="field-input" id="resource_key" name="resource_key" required disabled={disabled}>
          <option value="">Auswählen</option>
          {employeeOptions.length > 0 ? (
            <optgroup label="Mitarbeiter">
              {employeeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ) : null}
          {vehicleOptions.length > 0 ? (
            <optgroup label="Fahrzeuge">
              {vehicleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ) : null}
          {resourceOptions.length > 0 ? (
            <optgroup label="Geräte & Ressourcen">
              {resourceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor="jobsite_id">
          Baustelle
        </label>
        <select className="field-input" id="jobsite_id" name="jobsite_id" disabled={disabled}>
          <option value="">Ohne Baustelle / interner Blocker</option>
          {jobsiteOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor="title">
          Titel
        </label>
        <input className="field-input" id="title" name="title" placeholder="z. B. Baustelle Müller oder Werkstatt" disabled={disabled} />
      </div>
      <div>
        <label className="field-label" htmlFor="status">
          Status
        </label>
        <select className="field-input" id="status" name="status" defaultValue="geplant" disabled={disabled}>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor="start_date">
          Von
        </label>
        <input className="field-input" id="start_date" name="start_date" type="date" defaultValue={defaultDate} required disabled={disabled} />
      </div>
      <div>
        <label className="field-label" htmlFor="end_date">
          Bis
        </label>
        <input className="field-input" id="end_date" name="end_date" type="date" defaultValue={defaultDate} required disabled={disabled} />
      </div>
      <div>
        <label className="field-label" htmlFor="color">
          Farbe
        </label>
        <input className="field-input h-12" id="color" name="color" type="color" defaultValue="#2E7D32" disabled={disabled} />
      </div>
      <div className="lg:col-span-2">
        <label className="field-label" htmlFor="notes">
          Notiz
        </label>
        <textarea className="field-input min-h-24" id="notes" name="notes" placeholder="Teamhinweis, Besonderheit, Materialrisiko ..." disabled={disabled} />
      </div>
      <div className="lg:col-span-2">
        <button className="btn-primary w-full sm:w-auto" type="submit" disabled={disabled}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? "Speichern..." : state.success ? "Gespeichert" : "Planung speichern"}
        </button>
      </div>
      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 lg:col-span-2" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-md border border-primary/30 bg-mint px-3 py-2 text-sm font-bold text-primary-dark lg:col-span-2" role="status">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
