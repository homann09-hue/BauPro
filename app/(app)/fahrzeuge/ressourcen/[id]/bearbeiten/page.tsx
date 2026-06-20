import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, Download, FileText, Upload } from "lucide-react";
import { ResourceForm } from "@/components/forms/resource-form";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import {
  archivePlanningResourceAction,
  archiveResourceDocumentAction,
  uploadResourceDocumentAction,
  updatePlanningResourceAction
} from "@/lib/actions/planning-actions";
import { requireManager } from "@/lib/auth";
import { planningAssignmentSelect, planningResourceSelect, profileOptionSelect, resourceDocumentSelect, vehicleOptionSelect } from "@/lib/data/selects";
import { planningStatusLabels } from "@/lib/planning";
import { resourceKindLabels, resourceStatusBadgeClasses, resourceStatusLabels } from "@/lib/resources";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, searchParamMessage } from "@/lib/utils";
import type { PlanningAssignment, PlanningResource, Profile, ResourceDocument, Vehicle } from "@/types/app";

export default async function EditResourcePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const { id } = await params;
  const { error, success } = searchParamMessage(await searchParams);
  const returnTo = `/fahrzeuge/ressourcen/${id}/bearbeiten`;
  const today = new Date().toISOString().slice(0, 10);

  const [resourceResult, employeesResult, vehiclesResult, documentsResult, assignmentsResult] = await Promise.all([
    supabase
      .from("planning_resources")
      .select(planningResourceSelect)
      .eq("company_id", context.companyId)
      .eq("id", id)
      .is("archived_at", null)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select(profileOptionSelect)
      .eq("company_id", context.companyId)
      .eq("active", true)
      .in("role", ["vorarbeiter", "mitarbeiter"])
      .order("full_name", { ascending: true }),
    supabase
      .from("vehicles")
      .select(vehicleOptionSelect)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("resource_documents")
      .select(resourceDocumentSelect)
      .eq("company_id", context.companyId)
      .eq("planning_resource_id", id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("planning_assignments")
      .select(planningAssignmentSelect)
      .eq("company_id", context.companyId)
      .eq("planning_resource_id", id)
      .is("archived_at", null)
      .gte("end_date", today)
      .order("start_date", { ascending: true })
      .limit(8)
  ]);

  if (!resourceResult.data) notFound();

  const resource = (resourceResult.data as unknown) as PlanningResource;
  const employees = (employeesResult.data ?? []) as Profile[];
  const vehicles = (vehiclesResult.data ?? []) as Vehicle[];
  const documents = (documentsResult.data ?? []) as ResourceDocument[];
  const assignments = ((assignmentsResult.data ?? []) as unknown) as PlanningAssignment[];

  return (
    <>
      <PageHeader title="Ressource bearbeiten" description={`${resource.name} · ${resourceKindLabels[resource.resource_kind]}`} />
      <MessageBox error={error} success={success} />

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <p className="meta-label">Status</p>
          <span className={`mt-2 inline-flex rounded-md px-2.5 py-1 text-sm font-black ${resourceStatusBadgeClasses[resource.status]}`}>
            {resourceStatusLabels[resource.status]}
          </span>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <p className="meta-label">Prüfung / Wartung</p>
          <p className="mt-2 text-sm font-bold text-ink">
            Prüfung: {formatDate(resource.inspection_due_date)}
            <br />
            Wartung: {formatDate(resource.next_maintenance_at)}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <p className="meta-label">Standort</p>
          <p className="mt-2 text-sm font-bold text-ink">{resource.location_text || resource.vehicles?.name || "Keine Angabe"}</p>
        </div>
      </div>

      <ResourceForm
        action={updatePlanningResourceAction}
        resource={resource}
        employees={employees}
        vehicles={vehicles}
        submitLabel="Änderungen speichern"
        returnTo={returnTo}
      />

      <section className="surface mt-5 p-4 sm:p-5">
        <h2 className="mb-3 text-lg font-semibold text-ink">Nächste Plantafel-Zuordnungen</h2>
        {assignments.length === 0 ? (
          <p className="rounded-md border border-dashed border-line bg-fog p-4 text-sm font-semibold text-slate-500">
            Diese Ressource ist aktuell nicht verplant.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {assignments.map((assignment) => (
              <article key={assignment.id} className="rounded-lg border border-line bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-ink">{assignment.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{assignment.jobsites?.name || "Ohne Baustelle"}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {formatDate(assignment.start_date)} bis {formatDate(assignment.end_date)}
                    </p>
                  </div>
                  <span className="rounded-md bg-mint px-2 py-1 text-xs font-black text-primary">
                    {planningStatusLabels[assignment.status]}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="surface mt-5 p-4 sm:p-5">
        <h2 className="mb-4 text-lg font-semibold text-ink">Fotos & Dokumente</h2>
        <form action={uploadResourceDocumentAction} className="grid gap-3 lg:grid-cols-[1fr_1fr_1.2fr_auto]">
          <input type="hidden" name="target_type" value="resource" />
          <input type="hidden" name="target_id" value={resource.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <div>
            <label className="field-label" htmlFor="document_type">
              Typ
            </label>
            <select className="field-input" id="document_type" name="document_type" defaultValue="dokument">
              <option value="foto">Foto</option>
              <option value="dokument">Dokument</option>
              <option value="pruefung">Prüfung</option>
              <option value="wartung">Wartung</option>
              <option value="sonstiges">Sonstiges</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="title">
              Titel
            </label>
            <input className="field-input" id="title" name="title" placeholder="z. B. UVV Prüfung" />
          </div>
          <div>
            <label className="field-label" htmlFor="document">
              Datei
            </label>
            <input className="field-input" id="document" name="document" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required />
          </div>
          <div className="flex items-end">
            <SubmitButton>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Hochladen
            </SubmitButton>
          </div>
        </form>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {documents.map((document) => (
            <article key={document.id} className="rounded-lg border border-line bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-ink">{document.title}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {document.document_type} · {formatDate(document.created_at.slice(0, 10))}
                  </p>
                </div>
                <FileText className="h-5 w-5 text-moss" aria-hidden="true" />
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Link href={`/fahrzeuge/documents/${document.id}`} className="btn-secondary flex-1">
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Öffnen
                </Link>
                <form action={archiveResourceDocumentAction} className="flex-1">
                  <input type="hidden" name="document_id" value={document.id} />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <SubmitButton variant="secondary" className="w-full">
                    Archivieren
                  </SubmitButton>
                </form>
              </div>
            </article>
          ))}
          {documents.length === 0 ? (
            <p className="rounded-md border border-dashed border-line bg-fog p-4 text-sm font-semibold text-slate-500">
              Noch keine Dateien an der Ressource gespeichert.
            </p>
          ) : null}
        </div>
      </section>

      <form action={archivePlanningResourceAction} className="mt-4 flex justify-end">
        <input type="hidden" name="resource_id" value={resource.id} />
        <input type="hidden" name="return_to" value="/fahrzeuge" />
        <SubmitButton variant="danger">
          <Archive className="h-4 w-4" aria-hidden="true" />
          Ressource archivieren
        </SubmitButton>
      </form>
    </>
  );
}
