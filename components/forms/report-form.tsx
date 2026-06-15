/* eslint-disable @next/next/no-img-element */
import { Trash2 } from "lucide-react";
import { deleteReportPhotoAction } from "@/lib/actions/report-actions";
import { ReportDraftAssistant } from "@/components/ai/report-draft-assistant";
import { SubmitButton } from "@/components/submit-button";
import type { Jobsite, Profile, Report, ReportPhoto } from "@/types/app";

export function ReportForm({
  action,
  report,
  jobsites,
  employees,
  photos = [],
  canManage,
  currentUserId,
  submitLabel
}: {
  action: (formData: FormData) => Promise<void>;
  report?: Report;
  jobsites: Jobsite[];
  employees: Profile[];
  photos?: ReportPhoto[];
  canManage: boolean;
  currentUserId: string;
  submitLabel: string;
}) {
  const selectedEmployees = new Set(report?.employee_ids ?? [currentUserId]);
  const currentEmployee = employees.find((employee) => employee.id === currentUserId);

  return (
    <form action={action} className="surface p-4 sm:p-5">
      {report ? <input type="hidden" name="id" value={report.id} /> : null}
      <ReportDraftAssistant />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="jobsite_id">
            Baustelle
          </label>
          <select className="field-input" id="jobsite_id" name="jobsite_id" defaultValue={report?.jobsite_id ?? ""}>
            <option value="">Keine Baustelle auswaehlen</option>
            {jobsites.map((jobsite) => (
              <option key={jobsite.id} value={jobsite.id}>
                {jobsite.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="report_date">
            Datum
          </label>
          <input
            className="field-input"
            id="report_date"
            name="report_date"
            type="date"
            defaultValue={report?.report_date ?? new Date().toISOString().slice(0, 10)}
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor="weather">
            Wetter
          </label>
          <input className="field-input" id="weather" name="weather" defaultValue={report?.weather ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="work_start">
              Von
            </label>
            <input
              className="field-input"
              id="work_start"
              name="work_start"
              type="time"
              defaultValue={report?.work_start?.slice(0, 5) ?? ""}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="work_end">
              Bis
            </label>
            <input
              className="field-input"
              id="work_end"
              name="work_end"
              type="time"
              defaultValue={report?.work_end?.slice(0, 5) ?? ""}
            />
          </div>
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="field-label">Mitarbeiter</legend>
        {canManage ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {employees.map((employee) => (
              <label
                key={employee.id}
                className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="employee_ids"
                  value={employee.id}
                  defaultChecked={selectedEmployees.has(employee.id)}
                  className="h-4 w-4 rounded border-line text-moss"
                />
                <span>{employee.full_name || employee.email}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-line bg-white px-3 py-2 text-sm">
            <input type="hidden" name="employee_ids" value={currentUserId} />
            {currentEmployee?.full_name || currentEmployee?.email || "Du"}
          </div>
        )}
      </fieldset>

      <div className="mt-5 grid gap-4">
        <div>
          <label className="field-label" htmlFor="activities">
            Tätigkeiten
          </label>
          <textarea
            className="field-input min-h-32"
            id="activities"
            name="activities"
            defaultValue={report?.activities ?? ""}
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor="material_usage">
            Materialverbrauch
          </label>
          <textarea
            className="field-input min-h-24"
            id="material_usage"
            name="material_usage"
            defaultValue={report?.material_usage ?? ""}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="issues">
            Probleme / Besonderheiten
          </label>
          <textarea className="field-input min-h-24" id="issues" name="issues" defaultValue={report?.issues ?? ""} />
        </div>
        <div>
          <label className="field-label" htmlFor="photos">
            Fotos hochladen
          </label>
          <input className="field-input" id="photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple />
          <p className="field-help">
            Nur notwendige Baustellenfotos hochladen. Erlaubt: JPG, PNG, WebP, HEIC bis 10 MB je Foto. Personen, Kennzeichen und private
            Innenraeume nach Moeglichkeit vermeiden.
          </p>
        </div>
        <div>
          <label className="field-label" htmlFor="signature_name">
            Unterschrift optional
          </label>
          <input
            className="field-input"
            id="signature_name"
            name="signature_name"
            placeholder="Name fuer Freigabe oder Unterschrift"
            defaultValue={report?.signature_name ?? ""}
          />
        </div>
      </div>

      {photos.length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-ink">Vorhandene Fotos</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo) => (
              <div key={photo.id} className="overflow-hidden rounded-md border border-line bg-white">
                {photo.signedUrl ? (
                  <img src={photo.signedUrl} alt={photo.file_name} className="h-40 w-full object-cover" />
                ) : null}
                <div className="flex items-center justify-between gap-3 p-3">
                  <p className="truncate text-xs text-slate-600">{photo.file_name}</p>
                  <button
                    form={`delete-photo-${photo.id}`}
                    type="submit"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-700 hover:bg-red-50"
                    aria-label="Foto loeschen"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

export function ReportPhotoDeleteForms({ photos, reportId }: { photos: ReportPhoto[]; reportId: string }) {
  return (
    <>
      {photos.map((photo) => (
        <form key={photo.id} id={`delete-photo-${photo.id}`} action={deleteReportPhotoAction}>
          <input type="hidden" name="id" value={photo.id} />
          <input type="hidden" name="report_id" value={reportId} />
          <input type="hidden" name="storage_path" value={photo.storage_path} />
        </form>
      ))}
    </>
  );
}
