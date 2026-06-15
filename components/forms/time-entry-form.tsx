import { SubmitButton } from "@/components/submit-button";
import type { Jobsite, Profile, TimeEntry } from "@/types/app";

export function TimeEntryForm({
  action,
  entry,
  jobsites,
  employees,
  canManage,
  currentUserId,
  submitLabel
}: {
  action: (formData: FormData) => Promise<void>;
  entry?: TimeEntry;
  jobsites: Jobsite[];
  employees: Profile[];
  canManage: boolean;
  currentUserId: string;
  submitLabel: string;
}) {
  const selectedEmployeeId = entry?.employee_id ?? currentUserId;
  const selectedJobsite = jobsites.find((jobsite) => jobsite.id === entry?.job_id);

  return (
    <form action={action} className="surface p-4 sm:p-5">
      {entry ? <input type="hidden" name="id" value={entry.id} /> : null}

      <div className="mb-5 rounded-md border border-line bg-fog p-3 text-sm text-slate-700">
        <strong className="text-ink">Hinweis:</strong> Die Zeiterfassung ersetzt keine Rechtsberatung. Sie erfasst die
        Daten vollstaendig, nachvollziehbar und exportierbar.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="date">
            Datum
          </label>
          <input
            className="field-input"
            id="date"
            name="date"
            type="date"
            defaultValue={entry?.date ?? new Date().toISOString().slice(0, 10)}
            required
          />
        </div>

        <div>
          <label className="field-label" htmlFor="employee_id">
            Mitarbeiter
          </label>
          {canManage ? (
            <select className="field-input" id="employee_id" name="employee_id" defaultValue={selectedEmployeeId} required>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name || employee.email || "Mitarbeiter"}
                </option>
              ))}
            </select>
          ) : (
            <div className="field-input bg-slate-50">
              <input type="hidden" name="employee_id" value={currentUserId} />
              {employees.find((employee) => employee.id === currentUserId)?.full_name ||
                employees.find((employee) => employee.id === currentUserId)?.email ||
                "Du"}
            </div>
          )}
        </div>

        <div>
          <label className="field-label" htmlFor="job_id">
            Baustelle / Auftrag
          </label>
          <select className="field-input" id="job_id" name="job_id" defaultValue={entry?.job_id ?? ""} required>
            <option value="">Baustelle auswaehlen</option>
            {jobsites.map((jobsite) => (
              <option key={jobsite.id} value={jobsite.id}>
                {jobsite.name} - {jobsite.customer}
              </option>
            ))}
          </select>
          <p className="field-help">Ort und Adresse werden aus der Baustelle uebernommen, koennen aber ergaenzt werden.</p>
        </div>

        <div>
          <label className="field-label" htmlFor="status">
            Status
          </label>
          <select className="field-input" id="status" name="status" defaultValue={entry?.status ?? "submitted"}>
            <option value="draft">Entwurf</option>
            <option value="submitted">Eingereicht</option>
            {canManage ? <option value="approved">Freigegeben</option> : null}
            {canManage ? <option value="rejected">Abgelehnt</option> : null}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="work_location">
            Ort / Baustellenname
          </label>
          <input
            className="field-input"
            id="work_location"
            name="work_location"
            defaultValue={entry?.work_location ?? selectedJobsite?.name ?? ""}
            placeholder="Wird sonst aus der Baustelle uebernommen"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="work_address">
            Baustellenadresse
          </label>
          <input
            className="field-input"
            id="work_address"
            name="work_address"
            defaultValue={entry?.work_address ?? selectedJobsite?.address ?? ""}
            placeholder="Wird sonst aus der Baustelle uebernommen"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="start_time">
              Beginn
            </label>
            <input
              className="field-input"
              id="start_time"
              name="start_time"
              type="time"
              defaultValue={entry?.start_time?.slice(0, 5) ?? "07:00"}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="end_time">
              Ende
            </label>
            <input
              className="field-input"
              id="end_time"
              name="end_time"
              type="time"
              defaultValue={entry?.end_time?.slice(0, 5) ?? "16:00"}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="break_minutes">
              Pause in Minuten
            </label>
            <input
              className="field-input"
              id="break_minutes"
              name="break_minutes"
              type="number"
              min="0"
              step="1"
              defaultValue={entry?.break_minutes ?? 30}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="kilometers">
              Kilometer optional
            </label>
            <input
              className="field-input"
              id="kilometers"
              name="kilometers"
              type="number"
              min="0"
              step="0.1"
              defaultValue={entry?.kilometers ?? ""}
            />
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="weather">
            Wetter optional
          </label>
          <input className="field-input" id="weather" name="weather" defaultValue={entry?.weather ?? ""} />
        </div>

        <div>
          <label className="field-label" htmlFor="change_reason">
            Aenderungsgrund
          </label>
          <input
            className="field-input"
            id="change_reason"
            name="change_reason"
            defaultValue=""
            placeholder={entry ? "z. B. Uhrzeit korrigiert" : "Optional"}
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="field-label" htmlFor="activity">
          Taetigkeit / Beschreibung
        </label>
        <textarea
          className="field-input min-h-28"
          id="activity"
          name="activity"
          defaultValue={entry?.activity ?? ""}
          required
        />
      </div>

      <div className="mt-4">
        <label className="field-label" htmlFor="notes">
          Notizen optional
        </label>
        <textarea className="field-input min-h-20" id="notes" name="notes" defaultValue={entry?.notes ?? ""} />
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
