import Link from "next/link";
import { CalendarCheck, FileText, Hammer, Plus, ShieldCheck, TriangleAlert, Truck, Wrench } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { requireAppContext } from "@/lib/auth";
import { planningAssignmentSelect, planningResourceSelect, vehicleOptionSelect } from "@/lib/data/selects";
import { hasAppPermission } from "@/lib/permissions";
import { assignmentResourceKey, detectPlanningConflicts } from "@/lib/planning";
import { maintenanceDueState, resourceKindLabels, resourceStatusBadgeClasses, resourceStatusLabels } from "@/lib/resources";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, searchParamMessage } from "@/lib/utils";
import type { PlanningAssignment, PlanningResource, Vehicle } from "@/types/app";

export default async function VehiclesPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const { error, success } = searchParamMessage(await searchParams);
  const canManageResources = hasAppPermission(context.profile.role, context.permissions, "vehicles.manage");

  if (!canManageResources) {
    return (
      <>
        <PageHeader title="Fahrzeuge & Geräte" description="Ressourcenverwaltung." />
        <MessageBox error={error} success={success} />
        <EmptyState
          icon={TriangleAlert}
          title="Kein Zugriff"
          description="Fahrzeuge und Geräte werden von Admin oder Chef verwaltet."
        />
      </>
    );
  }

  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const [vehiclesResult, resourcesResult, assignmentsResult] = await Promise.all([
    supabase
      .from("vehicles")
      .select(vehicleOptionSelect)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("planning_resources")
      .select(planningResourceSelect)
      .eq("company_id", context.companyId)
      .eq("active", true)
      .is("archived_at", null)
      .order("resource_kind", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("planning_assignments")
      .select(planningAssignmentSelect)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .gte("end_date", today)
      .order("start_date", { ascending: true })
      .limit(120)
  ]);

  const vehicles = (vehiclesResult.data ?? []) as Vehicle[];
  const resources = ((resourcesResult.data ?? []) as unknown) as PlanningResource[];
  const assignments = ((assignmentsResult.data ?? []) as unknown) as PlanningAssignment[];
  const conflictMap = detectPlanningConflicts(assignments, []);
  const conflictByResource = new Map<string, number>();

  for (const conflicts of conflictMap.values()) {
    for (const conflict of conflicts) {
      const assignment = assignments.find((item) => item.id === conflict.assignmentId);
      if (!assignment) continue;
      const key = assignmentResourceKey(assignment);
      conflictByResource.set(key, (conflictByResource.get(key) ?? 0) + 1);
    }
  }

  const conflictCount = [...conflictByResource.values()].reduce((sum, value) => sum + value, 0);
  const unavailableCount =
    resources.filter((resource) => resource.status === "defekt" || resource.status === "werkstatt").length +
    vehicles.filter((vehicle) => vehicle.status === "defekt" || vehicle.status === "werkstatt").length;

  return (
    <>
      <PageHeader
        title="Fahrzeuge & Geräte"
        description="Fahrzeuge, Maschinen, Anhänger, Werkzeuge und Prüftermine zentral verwalten."
        actionHref="/fahrzeuge/neu"
        actionLabel="Fahrzeug anlegen"
        actionIcon={Plus}
      />
      <MessageBox error={error} success={success} />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <p className="meta-label">Fahrzeuge</p>
          <p className="mt-2 text-3xl font-black text-ink">{vehicles.length}</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <p className="meta-label">Geräte & Werkzeuge</p>
          <p className="mt-2 text-3xl font-black text-ink">{resources.length}</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <p className="meta-label">Konfliktwarnungen</p>
          <p className="mt-2 text-3xl font-black text-ink">{conflictCount}</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <p className="meta-label">Defekt / Werkstatt</p>
          <p className="mt-2 text-3xl font-black text-ink">{unavailableCount}</p>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-2 sm:flex-row">
        <Link href="/fahrzeuge/neu" className="btn-primary">
          <Truck className="h-4 w-4" aria-hidden="true" />
          Fahrzeug anlegen
        </Link>
        <Link href="/fahrzeuge/ressourcen/neu" className="btn-secondary">
          <Wrench className="h-4 w-4" aria-hidden="true" />
          Gerät / Werkzeug anlegen
        </Link>
        <Link href="/plantafel" className="btn-secondary">
          <CalendarCheck className="h-4 w-4" aria-hidden="true" />
          In Plantafel planen
        </Link>
      </div>

      {vehicles.length === 0 && resources.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Noch keine Ressourcen"
          description="Lege Transporter, Anhänger, Maschinen oder Werkzeuge an."
          actionHref="/fahrzeuge/neu"
          actionLabel="Fahrzeug anlegen"
        />
      ) : (
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="section-title">Fahrzeuge</h2>
              <Link href="/fahrzeuge/neu" className="text-sm font-black text-primary hover:text-primary-dark">
                Neu
              </Link>
            </div>
            {vehicles.length === 0 ? (
              <p className="rounded-md border border-dashed border-line bg-white p-4 text-sm font-semibold text-slate-500">
                Noch keine Fahrzeuge angelegt.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {vehicles.map((vehicle) => {
                  const conflicts = conflictByResource.get(`vehicle:${vehicle.id}`) ?? 0;
                  const due = maintenanceDueState(vehicle.next_maintenance_at, vehicle.tuv_date ?? vehicle.inspection_due_date);
                  return (
                    <Link
                      href={`/fahrzeuge/${vehicle.id}/bearbeiten`}
                      key={vehicle.id}
                      className="interactive-surface block overflow-hidden p-0"
                    >
                      <div className="h-1.5 bg-gradient-to-r from-steel via-moss to-signal" />
                      <div className="p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-black text-ink">{vehicle.name}</h3>
                            <p className="mt-1 inline-flex rounded-md bg-ink px-2.5 py-1 text-sm font-bold text-white">
                              {vehicle.license_plate}
                            </p>
                          </div>
                          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-mint text-moss">
                            <Truck className="h-5 w-5" aria-hidden="true" />
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className={`rounded-md px-2 py-1 text-xs font-black ${resourceStatusBadgeClasses[vehicle.status ?? "verfuegbar"]}`}>
                            {resourceStatusLabels[vehicle.status ?? "verfuegbar"]}
                          </span>
                          {conflicts > 0 ? (
                            <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-black text-red-700">
                              {conflicts} Konflikt(e)
                            </span>
                          ) : null}
                          {due === "overdue" || due === "soon" ? (
                            <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-black text-amber-800">
                              {due === "overdue" ? "Prüfung fällig" : "Prüfung bald"}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-md bg-fog p-3">
                            <p className="meta-label">TÜV</p>
                            <p className="mt-1 flex items-center gap-2 font-bold text-ink">
                              <CalendarCheck className="h-4 w-4 text-moss" aria-hidden="true" />
                              {formatDate(vehicle.tuv_date)}
                            </p>
                          </div>
                          <div className="rounded-md bg-fog p-3">
                            <p className="meta-label">Standort</p>
                            <p className="mt-1 font-bold text-ink">{vehicle.location_text || "Keine Angabe"}</p>
                          </div>
                        </div>
                        {vehicle.notes ? (
                          <p className="mt-3 line-clamp-2 flex gap-2 rounded-md border border-line bg-white p-3 text-sm text-slate-600">
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-steel" aria-hidden="true" />
                            {vehicle.notes}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="section-title">Geräte, Maschinen & Werkzeuge</h2>
              <Link href="/fahrzeuge/ressourcen/neu" className="text-sm font-black text-primary hover:text-primary-dark">
                Neu
              </Link>
            </div>
            {resources.length === 0 ? (
              <p className="rounded-md border border-dashed border-line bg-white p-4 text-sm font-semibold text-slate-500">
                Noch keine Geräte oder Werkzeuge angelegt.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {resources.map((resource) => {
                  const conflicts = conflictByResource.get(`equipment:${resource.id}`) ?? 0;
                  const due = maintenanceDueState(resource.next_maintenance_at, resource.inspection_due_date);
                  return (
                    <Link
                      href={`/fahrzeuge/ressourcen/${resource.id}/bearbeiten`}
                      key={resource.id}
                      className="interactive-surface block overflow-hidden p-0"
                    >
                      <div className="h-1.5 bg-gradient-to-r from-warning via-moss to-steel" />
                      <div className="p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-black text-ink">{resource.name}</h3>
                            <p className="mt-1 text-sm font-bold text-slate-600">{resourceKindLabels[resource.resource_kind]}</p>
                          </div>
                          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-fog text-moss">
                            {resource.resource_kind === "werkzeug" ? <Hammer className="h-5 w-5" aria-hidden="true" /> : <Wrench className="h-5 w-5" aria-hidden="true" />}
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className={`rounded-md px-2 py-1 text-xs font-black ${resourceStatusBadgeClasses[resource.status]}`}>
                            {resourceStatusLabels[resource.status]}
                          </span>
                          {conflicts > 0 ? (
                            <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-black text-red-700">
                              {conflicts} Konflikt(e)
                            </span>
                          ) : null}
                          {due === "overdue" || due === "soon" ? (
                            <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-black text-amber-800">
                              {due === "overdue" ? "Prüfung fällig" : "Prüfung bald"}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-md bg-fog p-3">
                            <p className="meta-label">Prüftermin</p>
                            <p className="mt-1 flex items-center gap-2 font-bold text-ink">
                              <ShieldCheck className="h-4 w-4 text-moss" aria-hidden="true" />
                              {formatDate(resource.inspection_due_date)}
                            </p>
                          </div>
                          <div className="rounded-md bg-fog p-3">
                            <p className="meta-label">Standort</p>
                            <p className="mt-1 font-bold text-ink">{resource.location_text || resource.vehicles?.name || "Keine Angabe"}</p>
                          </div>
                        </div>
                        {resource.notes ? (
                          <p className="mt-3 line-clamp-2 flex gap-2 rounded-md border border-line bg-white p-3 text-sm text-slate-600">
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-steel" aria-hidden="true" />
                            {resource.notes}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
