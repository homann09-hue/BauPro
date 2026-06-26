"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, CloudSun, GripVertical, Truck, UserRound, Wrench } from "lucide-react";
import { movePlanningAssignmentAction, setPlanningWeatherWarningAction } from "@/lib/actions/planning-actions";
import { geocodeJobsiteWeatherLocationAction } from "@/lib/actions/weather-actions";
import {
  assignmentCoversDate,
  assignmentResourceKey,
  planningStatusColors,
  planningStatusLabels,
  resourceKey,
  type PlanningConflict,
  type PlanningRow
} from "@/lib/planning";
import { cn, formatDate } from "@/lib/utils";
import {
  planningWeatherRiskLabels,
  planningWeatherRuleLabels,
  type PlanningWeatherRisk
} from "@/lib/weather/planning-weather";
import type { PlanningAssignment, PlanningResourceType, PlanningView } from "@/types/app";

const rowGroupLabels: Record<PlanningResourceType, string> = {
  employee: "Mitarbeiter",
  vehicle: "Fahrzeuge",
  equipment: "Geräte & Ressourcen"
};

const rowIcons = {
  employee: UserRound,
  vehicle: Truck,
  equipment: Wrench
};

const weatherRiskStyles = {
  green: {
    badge: "bg-primary/10 text-primary-dark ring-primary/20",
    card: "border-primary/20 bg-primary/5 text-primary-dark"
  },
  yellow: {
    badge: "bg-warning/15 text-amber-900 ring-warning/30",
    card: "border-warning/30 bg-amber-50 text-amber-950"
  },
  red: {
    badge: "bg-red-50 text-danger ring-red-200",
    card: "border-red-200 bg-red-50 text-red-900"
  }
} as const;

function dayLabel(day: string, view: PlanningView) {
  const date = new Date(`${day}T00:00:00`);
  return new Intl.DateTimeFormat("de-DE", {
    weekday: view === "week" ? "short" : undefined,
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

function shortRange(assignment: Pick<PlanningAssignment, "start_date" | "end_date">) {
  if (assignment.start_date === assignment.end_date) return formatDate(assignment.start_date);
  return `${formatDate(assignment.start_date)} - ${formatDate(assignment.end_date)}`;
}

function conflictTone(conflicts: PlanningConflict[]) {
  if (conflicts.some((conflict) => conflict.severity === "critical")) return "border-danger bg-red-50";
  if (conflicts.length > 0) return "border-warning bg-amber-50";
  return "";
}

export function PlanningBoard({
  days,
  rows,
  assignments,
  conflicts,
  weatherRisks = {},
  view,
  canManage,
  returnTo
}: {
  days: string[];
  rows: PlanningRow[];
  assignments: PlanningAssignment[];
  conflicts: Record<string, PlanningConflict[]>;
  weatherRisks?: Record<string, PlanningWeatherRisk>;
  view: PlanningView;
  canManage: boolean;
  returnTo: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const assignmentsByRow = useMemo(() => {
    const grouped = new Map<string, PlanningAssignment[]>();
    for (const assignment of assignments) {
      const key = assignmentResourceKey(assignment);
      grouped.set(key, [...(grouped.get(key) ?? []), assignment]);
    }
    return grouped;
  }, [assignments]);
  const rowsByType = useMemo(
    () => ({
      employee: rows.filter((row) => row.type === "employee"),
      vehicle: rows.filter((row) => row.type === "vehicle"),
      equipment: rows.filter((row) => row.type === "equipment")
    }),
    [rows]
  );

  const dropAssignment = (assignmentId: string, row: PlanningRow, day: string) => {
    if (!canManage) return;
    setPendingId(assignmentId);
    setMessage(null);
    startTransition(async () => {
      const result = await movePlanningAssignmentAction({
        assignmentId,
        targetDate: day,
        resourceType: row.type,
        resourceId: row.id
      });
      setPendingId(null);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("Planung wurde verschoben.");
      router.refresh();
    });
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-white p-6 text-center">
        <CalendarDays className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
        <h2 className="mt-3 text-lg font-black text-ink">Noch keine Ressourcen für die Plantafel</h2>
        <p className="mt-1 text-sm text-slate-600">Lege Mitarbeiter, Fahrzeuge oder Geräte an, dann wird die Planung hier sichtbar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div
          className={cn(
            "rounded-md border p-3 text-sm font-semibold",
            message.includes("nicht") || message.includes("konnte") ? "border-red-200 bg-red-50 text-red-700" : "border-primary/20 bg-mint text-primary"
          )}
        >
          {message}
        </div>
      ) : null}

      <div className="hidden overflow-x-auto rounded-lg border border-line bg-white shadow-sm lg:block">
        <div
          className="min-w-max"
          style={{ display: "grid", gridTemplateColumns: `260px repeat(${days.length}, minmax(${view === "week" ? "132px" : "108px"}, 1fr))` }}
        >
          <div className="sticky left-0 z-20 border-b border-r border-line bg-anthracite px-4 py-3 text-sm font-black text-white">
            Ressource
          </div>
          {days.map((day) => (
            <div key={day} className="border-b border-r border-line bg-anthracite px-3 py-3 text-center text-xs font-black text-white">
              {dayLabel(day, view)}
            </div>
          ))}

          {(["employee", "vehicle", "equipment"] as const).map((type) => (
            <RowGroup
              key={type}
              type={type}
              rows={rowsByType[type]}
              days={days}
              assignmentsByRow={assignmentsByRow}
              conflicts={conflicts}
              weatherRisks={weatherRisks}
              canManage={canManage}
              returnTo={returnTo}
              pendingId={pendingId}
              onDrop={dropAssignment}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:hidden">
        {(["employee", "vehicle", "equipment"] as const).map((type) => {
          const groupRows = rowsByType[type];
          if (groupRows.length === 0) return null;
          const Icon = rowIcons[type];
          return (
            <section key={type} className="rounded-lg border border-line bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <h2 className="font-black text-ink">{rowGroupLabels[type]}</h2>
              </div>
              <div className="grid gap-3">
                {groupRows.map((row) => {
                  const rowAssignments = (assignmentsByRow.get(resourceKey(row.type, row.id)) ?? [])
                    .filter((assignment) => days.some((day) => assignmentCoversDate(assignment, day)))
                    .sort((left, right) => left.start_date.localeCompare(right.start_date));
                  return (
                    <article key={`${row.type}:${row.id}`} className="rounded-md border border-line bg-fog p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-ink">{row.label}</p>
                          <p className="text-xs font-semibold text-slate-500">{row.subLabel}</p>
                        </div>
                        {row.unavailable ? <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-black text-red-700">nicht verfuegbar</span> : null}
                      </div>
                      {rowAssignments.length === 0 ? (
                        <p className="mt-3 rounded-md border border-dashed border-line bg-white p-3 text-sm font-semibold text-slate-500">Keine Planung im Zeitraum.</p>
                      ) : (
                        <div className="mt-3 grid gap-2">
                          {rowAssignments.map((assignment) => (
                            <AssignmentCard
                              key={assignment.id}
                              assignment={assignment}
                              conflicts={conflicts[assignment.id] ?? []}
                              weatherRisk={weatherRisks[assignment.id]}
                              draggable={false}
                              pending={pendingId === assignment.id || isPending}
                              canManage={canManage}
                              returnTo={returnTo}
                            />
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function RowGroup({
  type,
  rows,
  days,
  assignmentsByRow,
  conflicts,
  weatherRisks,
  canManage,
  returnTo,
  pendingId,
  onDrop
}: {
  type: PlanningResourceType;
  rows: PlanningRow[];
  days: string[];
  assignmentsByRow: Map<string, PlanningAssignment[]>;
  conflicts: Record<string, PlanningConflict[]>;
  weatherRisks: Record<string, PlanningWeatherRisk>;
  canManage: boolean;
  returnTo: string;
  pendingId: string | null;
  onDrop: (assignmentId: string, row: PlanningRow, day: string) => void;
}) {
  if (rows.length === 0) return null;
  const Icon = rowIcons[type];

  return (
    <>
      <div className="sticky left-0 z-10 col-span-full border-b border-line bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-normal text-slate-600">
        <span className="inline-flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          {rowGroupLabels[type]}
        </span>
      </div>
      {rows.map((row) => {
        const rowAssignments = assignmentsByRow.get(resourceKey(row.type, row.id)) ?? [];
        return (
          <div key={`${row.type}:${row.id}`} className="contents">
            <div className="sticky left-0 z-10 min-h-28 border-b border-r border-line bg-white px-4 py-3">
              <p className="font-black text-ink">{row.label}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{row.subLabel}</p>
              {row.unavailable ? (
                <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs font-black text-red-700">nicht verfuegbar</p>
              ) : null}
            </div>
            {days.map((day) => {
              const cellAssignments = rowAssignments.filter((assignment) => assignmentCoversDate(assignment, day));
              return (
                <div
                  key={`${row.type}:${row.id}:${day}`}
                  className={cn(
                    "min-h-28 border-b border-r border-line bg-white p-2 transition",
                    canManage && "hover:bg-mint/60",
                    row.unavailable && "bg-red-50/30"
                  )}
                  onDragOver={(event) => {
                    if (canManage) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    if (!canManage) return;
                    event.preventDefault();
                    const assignmentId = event.dataTransfer.getData("text/plain");
                    if (assignmentId) onDrop(assignmentId, row, day);
                  }}
                >
                  <div className="space-y-2">
                    {cellAssignments.map((assignment) => (
                      <AssignmentCard
                        key={`${assignment.id}:${day}`}
                        assignment={assignment}
                        conflicts={conflicts[assignment.id] ?? []}
                        weatherRisk={weatherRisks[assignment.id]}
                        draggable={canManage}
                        pending={pendingId === assignment.id}
                        canManage={canManage}
                        returnTo={returnTo}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function AssignmentCard({
  assignment,
  conflicts,
  weatherRisk,
  draggable,
  pending,
  canManage,
  returnTo
}: {
  assignment: PlanningAssignment;
  conflicts: PlanningConflict[];
  weatherRisk?: PlanningWeatherRisk;
  draggable: boolean;
  pending: boolean;
  canManage: boolean;
  returnTo: string;
}) {
  const colors = planningStatusColors[assignment.status] ?? planningStatusColors.geplant;
  const weatherStyle = weatherRisk ? weatherRiskStyles[weatherRisk.riskLevel] : null;

  return (
    <div
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", assignment.id);
      }}
      className={cn(
        "rounded-md border p-2 text-xs shadow-sm transition",
        colors.block,
        conflicts.length > 0 && conflictTone(conflicts),
        draggable && "cursor-grab active:cursor-grabbing",
        pending && "opacity-55"
      )}
      style={{ borderLeftColor: assignment.color, borderLeftWidth: 5 }}
    >
      <div className="flex items-start gap-2">
        {draggable ? <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" /> : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 font-black">{assignment.title}</p>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-black", colors.badge)}>
                {planningStatusLabels[assignment.status]}
              </span>
              {weatherRisk ? (
                <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-black ring-1", weatherStyle?.badge)}>
                  <CloudSun className="h-3 w-3" aria-hidden="true" />
                  {planningWeatherRiskLabels[weatherRisk.riskLevel]}
                </span>
              ) : null}
            </div>
          </div>
          <p className="mt-1 line-clamp-1 font-semibold text-slate-600">
            {assignment.jobsites?.name ?? assignment.jobsites?.address ?? shortRange(assignment)}
          </p>
          <p className="mt-1 font-semibold text-slate-500">{shortRange(assignment)}</p>
          {conflicts.length > 0 ? (
            <div className="mt-2 space-y-1">
              {conflicts.slice(0, 2).map((conflict, index) => (
                <p key={`${conflict.type}:${index}`} className="flex items-start gap-1 rounded bg-white/70 px-1.5 py-1 font-black text-red-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {conflict.message}
                </p>
              ))}
            </div>
          ) : null}
          {assignment.notes ? <p className="mt-2 line-clamp-2 text-slate-600">{assignment.notes}</p> : null}
          {weatherRisk ? (
            <div className={cn("mt-2 rounded-md border p-2", weatherStyle?.card)}>
              <p className="flex items-start gap-1 font-black">
                <CloudSun className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {weatherRisk.summary}
              </p>
              <p className="mt-1 text-[11px] font-semibold opacity-80">
                {weatherRisk.ruleCodes.length > 0
                  ? weatherRisk.ruleCodes.map((rule) => planningWeatherRuleLabels[rule]).join(" · ")
                  : weatherRisk.missingLocation
                    ? "Koordinaten fehlen"
                    : "Keine Dachdecker-Wetterregel aktiv"}
              </p>
              <p className="mt-1 text-[11px] font-semibold opacity-80">
                Regen {weatherRisk.precipitationMm ?? "-"} mm · Wind {weatherRisk.windGustKmh ?? weatherRisk.windKmh ?? "-"} km/h · Temp.{" "}
                {weatherRisk.temperatureMinC ?? "-"} bis {weatherRisk.temperatureMaxC ?? "-"} °C
              </p>
              {weatherRisk.acknowledgedAction ? (
                <p className="mt-2 rounded bg-white/70 px-2 py-1 text-[11px] font-black">
                  {weatherRisk.acknowledgedAction === "ignored" ? "Von Chef ignoriert" : "Von Chef bestätigt"}
                  {weatherRisk.acknowledgedAt ? ` · ${new Date(weatherRisk.acknowledgedAt).toLocaleDateString("de-DE")}` : ""}
                </p>
              ) : canManage && weatherRisk.missingLocation && assignment.jobsite_id ? (
                <form action={geocodeJobsiteWeatherLocationAction} className="mt-2">
                  <input type="hidden" name="return_to" value={returnTo} />
                  <input type="hidden" name="jobsite_id" value={assignment.jobsite_id} />
                  <button type="submit" className="min-h-9 w-full rounded bg-white px-2 text-[11px] font-black text-ink ring-1 ring-black/10">
                    Adresse geocodieren
                  </button>
                </form>
              ) : canManage && weatherRisk.checkId && weatherRisk.riskLevel !== "green" ? (
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  <form action={setPlanningWeatherWarningAction}>
                    <input type="hidden" name="return_to" value={returnTo} />
                    <input type="hidden" name="check_id" value={weatherRisk.checkId} />
                    <input type="hidden" name="action" value="confirmed" />
                    <button type="submit" className="min-h-9 w-full rounded bg-white px-2 text-[11px] font-black text-ink ring-1 ring-black/10">
                      Bestätigen
                    </button>
                  </form>
                  <form action={setPlanningWeatherWarningAction}>
                    <input type="hidden" name="return_to" value={returnTo} />
                    <input type="hidden" name="check_id" value={weatherRisk.checkId} />
                    <input type="hidden" name="action" value="ignored" />
                    <button type="submit" className="min-h-9 w-full rounded bg-white px-2 text-[11px] font-black text-ink ring-1 ring-black/10">
                      Ignorieren
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
