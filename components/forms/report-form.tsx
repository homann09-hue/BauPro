/* eslint-disable @next/next/no-img-element */
import { Trash2 } from "lucide-react";
import { deleteReportPhotoAction } from "@/lib/actions/report-actions";
import { ReportDraftAssistant } from "@/components/ai/report-draft-assistant";
import { PhotoCaptureButton } from "@/components/forms/photo-capture-button";
import { SubmitButton } from "@/components/submit-button";
import { VoiceInputField } from "@/components/voice/VoiceInputField";
import { VoiceTextarea } from "@/components/voice/VoiceTextarea";
import { WeatherSuggestionField } from "@/components/weather/WeatherSuggestionField";
import type { Jobsite, Profile, Report, ReportPhoto, TimeEntry, Vehicle } from "@/types/app";

type ReportTimeEntryOption = Pick<
  TimeEntry,
  "id" | "employee_id" | "job_id" | "date" | "start_time" | "end_time" | "break_minutes" | "net_minutes" | "activity"
> & {
  profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
  jobsites?: Pick<Jobsite, "id" | "name" | "customer"> | null;
};

export function ReportForm({
  action,
  report,
  jobsites,
  employees,
  vehicles = [],
  availableTimeEntries = [],
  photos = [],
  canManage,
  currentUserId,
  defaultJobsiteId,
  submitLabel
}: {
  action: (formData: FormData) => Promise<void>;
  report?: Report;
  jobsites: Jobsite[];
  employees: Profile[];
  vehicles?: Vehicle[];
  availableTimeEntries?: ReportTimeEntryOption[];
  photos?: ReportPhoto[];
  canManage: boolean;
  currentUserId: string;
  defaultJobsiteId?: string | null;
  submitLabel: string;
}) {
  const selectedEmployees = new Set(report?.employee_ids ?? [currentUserId]);
  const selectedVehicles = new Set(report?.vehicle_ids ?? []);
  const selectedTimeEntries = new Set(report?.linked_time_entry_ids ?? []);
  const currentEmployee = employees.find((employee) => employee.id === currentUserId);
  const status = report?.report_status ?? "draft";

  return (
    <form action={action} className="surface p-4 sm:p-5">
      {report ? <input type="hidden" name="id" value={report.id} /> : null}
      <ReportDraftAssistant existingPhotos={photos.map((photo) => ({ id: photo.id, fileName: photo.file_name }))} />
      <div className="mb-5 rounded-lg border border-line bg-fog p-4">
        <p className="meta-label">Bautagesbericht</p>
        <h2 className="mt-1 text-xl font-black text-ink">{statusLabel(status)}</h2>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          Sprache, Arbeitszeiten, Wetter, Material, Fahrzeuge und Fotos in einem Bericht.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="jobsite_id">
            Baustelle
          </label>
          <select className="field-input" id="jobsite_id" name="jobsite_id" defaultValue={report?.jobsite_id ?? defaultJobsiteId ?? ""}>
            <option value="">Keine Baustelle auswählen</option>
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
        <section className="rounded-lg border border-line bg-fog p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="meta-label">Arbeitszeiten übernehmen</p>
              <h2 className="section-title">Zeiterfassung verknüpfen</h2>
            </div>
            <p className="text-xs font-semibold text-slate-500">Start/Ende werden beim Speichern automatisch ergänzt.</p>
          </div>
          {availableTimeEntries.length === 0 ? (
            <p className="mt-3 rounded-md border border-dashed border-line bg-white p-3 text-sm font-semibold text-slate-600">
              Für die aktuelle Auswahl wurden noch keine passenden Zeiten gefunden.
            </p>
          ) : (
            <div className="mt-3 grid gap-2">
              {availableTimeEntries.map((entry) => (
                <label key={entry.id} className="flex items-start gap-3 rounded-md border border-line bg-white p-3 text-sm">
                  <input
                    type="checkbox"
                    name="linked_time_entry_ids"
                    value={entry.id}
                    defaultChecked={selectedTimeEntries.has(entry.id)}
                    className="mt-1 h-4 w-4 rounded border-line text-moss"
                  />
                  <span className="min-w-0">
                    <span className="block font-black text-ink">
                      {entry.profiles?.full_name || entry.profiles?.email || "Mitarbeiter"} · {timeLabel(entry.start_time)}-{timeLabel(entry.end_time)}
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-slate-500">
                      {entry.jobsites?.name ?? "Baustelle"} · {formatNetMinutes(entry.net_minutes)} netto
                    </span>
                    <span className="mt-1 line-clamp-2 block text-slate-600">{entry.activity}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>

        <div>
          <VoiceTextarea
            label="Tätigkeiten"
            id="activities"
            name="activities"
            defaultValue={report?.activities ?? ""}
            rows={5}
            required
            placeholder="Heute Unterspannbahn verlegt, alte Lattung entfernt..."
          />
        </div>
        <div>
          <VoiceTextarea
            label="Materialverbrauch"
            id="material_usage"
            name="material_usage"
            defaultValue={report?.material_usage ?? ""}
            rows={4}
            placeholder="z. B. 3 Rollen Unterspannbahn, 120 Dachlatten"
          />
        </div>
        <div>
          <VoiceTextarea
            label="Maschinen / Fahrzeuge"
            id="machine_usage"
            name="machine_usage"
            defaultValue={report?.machine_usage ?? ""}
            rows={3}
            placeholder="z. B. Kran, Brenner, Transporter, Dachaufzug"
          />
          {vehicles.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {vehicles.map((vehicle) => (
                <label key={vehicle.id} className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    name="vehicle_ids"
                    value={vehicle.id}
                    defaultChecked={selectedVehicles.has(vehicle.id)}
                    className="h-4 w-4 rounded border-line text-moss"
                  />
                  <span>
                    <span className="font-bold text-ink">{vehicle.name}</span>
                    <span className="ml-2 text-xs font-semibold text-slate-500">{vehicle.license_plate}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <VoiceTextarea
            label="Probleme / Besonderheiten"
            id="issues"
            name="issues"
            defaultValue={report?.issues ?? ""}
            rows={4}
            placeholder="Schaden, Kundenhinweis oder Material für morgen"
          />
        </div>
        <WeatherSuggestionField
          jobFieldName="jobsite_id"
          dateFieldName="report_date"
          canManage={canManage}
          defaultWeather={{
            summary: report?.weather_summary ?? report?.weather,
            temperatureC: report?.weather_temperature_c,
            precipitationMm: report?.weather_precipitation_mm,
            windKmh: report?.weather_wind_kmh,
            source: report?.weather_source,
            fetchedAt: report?.weather_fetched_at,
            lat: report?.weather_lat,
            lng: report?.weather_lng
          }}
        />
        <div>
          <p className="field-label">Fotos hochladen</p>
          <PhotoCaptureButton name="photos" multiple />
          <p className="field-help">
            Nur notwendige Baustellenfotos hochladen. Erlaubt: JPG, PNG, WebP, HEIC bis 10 MB je Foto. Personen, Kennzeichen und private
            Innenraeume nach Möglichkeit vermeiden.
          </p>
        </div>
        <div>
          <VoiceInputField
            label="Name für spätere Freigabe optional"
            id="signature_name"
            name="signature_name"
            placeholder="Name, der später beim Unterschreiben vorgeschlagen wird"
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
                  <img src={photo.signedUrl} alt={photo.file_name} className="h-40 w-full object-cover" loading="lazy" decoding="async" />
                ) : null}
                <div className="flex items-center justify-between gap-3 p-3">
                  <p className="truncate text-xs text-slate-600">{photo.file_name}</p>
                  <button
                    form={`delete-photo-${photo.id}`}
                    type="submit"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-700 hover:bg-red-50"
                    aria-label="Foto archivieren"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-2 sm:grid-cols-[1fr_1fr]">
        <SubmitButton variant="secondary" name="report_status" value="draft">
          Entwurf speichern
        </SubmitButton>
        <SubmitButton name="report_status" value="submitted">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Entwurf",
    submitted: "Eingereicht",
    reviewed: "Geprüft",
    approved: "Freigegeben"
  };
  return labels[status] ?? status;
}

function timeLabel(value?: string | null) {
  return value?.slice(0, 5) || "--:--";
}

function formatNetMinutes(minutes?: number | null) {
  const hours = Number(minutes ?? 0) / 60;
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(hours)} h`;
}

export function ReportPhotoDeleteForms({ photos, reportId }: { photos: ReportPhoto[]; reportId: string }) {
  return (
    <>
      {photos.map((photo) => (
        <form key={photo.id} id={`delete-photo-${photo.id}`} action={deleteReportPhotoAction}>
          <input type="hidden" name="id" value={photo.id} />
          <input type="hidden" name="report_id" value={reportId} />
        </form>
      ))}
    </>
  );
}
