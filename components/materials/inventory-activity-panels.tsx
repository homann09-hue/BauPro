"use client";

import { useCallback, useEffect, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { MaterialConfirmationForm } from "@/components/forms/material-confirmation-form";
import { formatQuantity } from "@/lib/inventory";
import { formatDateTime } from "@/lib/utils";
import type { MaterialMovement, MaterialMovementType, MaterialUsageBookingType, MaterialUsageReport } from "@/types/app";

type InventoryActivityResponse = {
  usageReports?: MaterialUsageReport[];
  movements?: MaterialMovement[];
  error?: string;
};

type ActivityState =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: Required<Pick<InventoryActivityResponse, "usageReports" | "movements">>; error: null }
  | { status: "error"; data: null; error: string };

const bookingLabels: Record<MaterialUsageBookingType, string> = {
  consume: "Verbrauch",
  return: "Rückgabe",
  loss: "Verlust",
  break: "Bruch"
};

const movementLabels: Record<MaterialMovementType, string> = {
  purchase: "Einkauf",
  transfer: "Umlagerung",
  reserve: "Reservierung",
  consume: "Verbrauch",
  return: "Rückgabe",
  correction: "Korrektur",
  loss: "Verlust",
  break: "Bruch"
};

function ActivitySkeleton() {
  return (
    <div className="grid gap-3" aria-label="Aktivitäten werden geladen">
      {[0, 1, 2].map((index) => (
        <div key={index} className="rounded-lg border border-line bg-white p-3">
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-slate-100" />
          <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800" role="alert">
      <p>{message}</p>
      <button className="btn-secondary mt-3 min-h-11" type="button" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Erneut laden
      </button>
    </div>
  );
}

export function InventoryActivityPanels({ canOperate, returnTo }: { canOperate: boolean; returnTo: string }) {
  const [state, setState] = useState<ActivityState>({ status: "loading", data: null, error: null });

  const fetchActivity = useCallback(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);

    void fetch("/api/materials/inventory/activity", {
      method: "GET",
      signal: controller.signal,
      headers: {
        accept: "application/json"
      }
    })
      .then(async (response) => {
        const payload = (await response.json()) as InventoryActivityResponse;
        if (!response.ok || payload.error) {
          throw new Error(payload.error ?? "Aktivitäten konnten nicht geladen werden.");
        }

        setState({
          status: "ready",
          data: {
            usageReports: payload.usageReports ?? [],
            movements: payload.movements ?? []
          },
          error: null
        });
      })
      .catch((error: unknown) => {
        setState({
          status: "error",
          data: null,
          error: error instanceof DOMException && error.name === "AbortError"
            ? "Aktivitäten dauern zu lange. Bitte erneut laden."
            : "Aktivitäten konnten nicht geladen werden."
        });
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const retryActivity = useCallback(() => {
    setState({ status: "loading", data: null, error: null });
    void fetchActivity();
  }, [fetchActivity]);

  useEffect(() => fetchActivity(), [fetchActivity]);

  const usageReports = state.status === "ready" ? state.data.usageReports : [];
  const movements = state.status === "ready" ? state.data.movements : [];

  return (
    <section className="mb-5 grid gap-4 xl:grid-cols-2">
      <div className="surface p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="section-title">Offene Materialmeldungen</h2>
            <p className="mt-1 text-sm text-slate-500">
              {canOperate ? "Direkt bestätigen oder ablehnen." : "Deine Meldungen warten auf Bestätigung."}
            </p>
          </div>
          <span className="rounded-md bg-fog px-2.5 py-1 text-xs font-black text-ink">
            {state.status === "ready" ? usageReports.length : "..."}
          </span>
        </div>

        {state.status === "loading" ? <ActivitySkeleton /> : null}
        {state.status === "error" ? <ErrorPanel message={state.error} onRetry={retryActivity} /> : null}
        {state.status === "ready" && usageReports.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-fog p-4 text-sm font-semibold text-slate-600">
            Keine offenen Materialmeldungen.
          </p>
        ) : null}
        {state.status === "ready" && usageReports.length > 0 ? (
          <div className="grid gap-3">
            {usageReports.map((report) => (
              <article key={report.id} className="rounded-lg border border-line bg-white p-3" data-testid="material-usage-report">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-black text-ink">{report.inventory_items?.name ?? "Material"}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {bookingLabels[report.booking_type]} · {formatQuantity(report.quantity)} {report.unit} · {report.jobsites?.name ?? "Baustelle"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Gemeldet von {report.reported_profile?.full_name ?? "Mitarbeiter"} · {formatDateTime(report.created_at)}
                    </p>
                    {report.notes ? <p className="mt-2 text-sm text-slate-600">{report.notes}</p> : null}
                  </div>
                  <span className="inline-flex w-fit rounded-md bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-200">
                    offen
                  </span>
                </div>

                {canOperate ? <MaterialConfirmationForm reportId={report.id} returnTo={returnTo} /> : null}
              </article>
            ))}
          </div>
        ) : null}
      </div>

      <div className="surface p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <span className="rounded-md bg-fog p-2 text-ink">
            <History className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="section-title">Letzte Bewegungen</h2>
            <p className="mt-1 text-sm text-slate-500">Verbrauch, Rückgabe, Reservierung, Umlagerung und Korrekturen ohne Preisfelder.</p>
          </div>
        </div>

        {state.status === "loading" ? <ActivitySkeleton /> : null}
        {state.status === "error" ? <ErrorPanel message={state.error} onRetry={retryActivity} /> : null}
        {state.status === "ready" && movements.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-fog p-4 text-sm font-semibold text-slate-600">
            Noch keine Materialbewegungen gebucht.
          </p>
        ) : null}
        {state.status === "ready" && movements.length > 0 ? (
          <div className="grid gap-2">
            {movements.map((movement) => (
              <div key={movement.id} className="rounded-lg border border-line bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-ink">{movement.inventory_items?.name ?? "Material"}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {movementLabels[movement.movement_type]} · {formatQuantity(movement.quantity)} {movement.unit}
                      {movement.jobsites?.name ? ` · ${movement.jobsites.name}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(movement.created_at)}</p>
                  </div>
                  <span className="rounded-md bg-fog px-2.5 py-1 text-xs font-black text-ink">
                    {movementLabels[movement.movement_type]}
                  </span>
                </div>
                {movement.notes ? <p className="mt-2 text-sm text-slate-600">{movement.notes}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
