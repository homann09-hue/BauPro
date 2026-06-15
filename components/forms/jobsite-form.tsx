import type { Jobsite, Profile } from "@/types/app";
import { SubmitButton } from "@/components/submit-button";

type JobsiteFormProps = {
  action: (formData: FormData) => Promise<void>;
  jobsite?: Jobsite;
  employees: Profile[];
  submitLabel: string;
};

export function JobsiteForm({ action, jobsite, employees, submitLabel }: JobsiteFormProps) {
  const assigned = new Set(jobsite?.assigned_employee_ids ?? []);

  return (
    <form action={action} className="surface p-4 sm:p-5">
      {jobsite ? <input type="hidden" name="id" value={jobsite.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="name">
            Baustellenname
          </label>
          <input className="field-input" id="name" name="name" defaultValue={jobsite?.name} required />
        </div>
        <div>
          <label className="field-label" htmlFor="customer">
            Kunde
          </label>
          <input className="field-input" id="customer" name="customer" defaultValue={jobsite?.customer} required />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="address">
            Adresse
          </label>
          <input className="field-input" id="address" name="address" defaultValue={jobsite?.address} required />
        </div>
        <div>
          <label className="field-label" htmlFor="start_date">
            Startdatum
          </label>
          <input
            className="field-input"
            id="start_date"
            name="start_date"
            type="date"
            defaultValue={jobsite?.start_date ?? ""}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="status">
            Status
          </label>
          <select className="field-input" id="status" name="status" defaultValue={jobsite?.status ?? "geplant"}>
            <option value="geplant">Geplant</option>
            <option value="aktiv">Aktiv</option>
            <option value="abgeschlossen">Abgeschlossen</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="notes">
            Notizen
          </label>
          <textarea
            className="field-input min-h-28"
            id="notes"
            name="notes"
            defaultValue={jobsite?.notes ?? ""}
          />
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="field-label">Zugeordnete Mitarbeiter</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {employees.map((employee) => (
            <label
              key={employee.id}
              className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                name="assigned_employee_ids"
                value={employee.id}
                defaultChecked={assigned.has(employee.id)}
                className="h-4 w-4 rounded border-line text-moss"
              />
              <span>{employee.full_name || employee.email}</span>
            </label>
          ))}
        </div>
        {employees.length === 0 ? (
          <p className="field-help">Noch keine Mitarbeiter oder Vorarbeiter vorhanden.</p>
        ) : null}
      </fieldset>

      <div className="mt-6 flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
