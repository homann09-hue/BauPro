import { SubmitButton } from "@/components/submit-button";
import { resourceStatusLabels, resourceStatuses } from "@/lib/resources";
import type { Profile, Vehicle } from "@/types/app";

export function VehicleForm({
  action,
  vehicle,
  employees = [],
  submitLabel
}: {
  action: (formData: FormData) => Promise<void>;
  vehicle?: Vehicle;
  employees?: Array<Pick<Profile, "id" | "full_name" | "email" | "role">>;
  submitLabel: string;
}) {
  return (
    <form action={action} className="surface p-4 sm:p-5">
      {vehicle ? <input type="hidden" name="id" value={vehicle.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="name">
            Fahrzeugname
          </label>
          <input className="field-input" id="name" name="name" defaultValue={vehicle?.name} required />
        </div>
        <div>
          <label className="field-label" htmlFor="license_plate">
            Kennzeichen
          </label>
          <input
            className="field-input"
            id="license_plate"
            name="license_plate"
            defaultValue={vehicle?.license_plate}
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor="tuv_date">
            TÜV-Datum
          </label>
          <input
            className="field-input"
            id="tuv_date"
            name="tuv_date"
            type="date"
            defaultValue={vehicle?.tuv_date ?? ""}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="status">
            Status
          </label>
          <select className="field-input" id="status" name="status" defaultValue={vehicle?.status ?? "verfuegbar"}>
            {resourceStatuses
              .filter((status) => status !== "archiviert")
              .map((status) => (
                <option key={status} value={status}>
                  {resourceStatusLabels[status]}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="inspection_due_date">
            Prüftermin
          </label>
          <input
            className="field-input"
            id="inspection_due_date"
            name="inspection_due_date"
            type="date"
            defaultValue={vehicle?.inspection_due_date ?? ""}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="maintenance_interval_days">
            Wartungsintervall in Tagen
          </label>
          <input
            className="field-input"
            id="maintenance_interval_days"
            name="maintenance_interval_days"
            type="number"
            min={1}
            max={3650}
            defaultValue={vehicle?.maintenance_interval_days ?? ""}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="last_maintenance_at">
            Letzte Wartung
          </label>
          <input
            className="field-input"
            id="last_maintenance_at"
            name="last_maintenance_at"
            type="date"
            defaultValue={vehicle?.last_maintenance_at ?? ""}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="next_maintenance_at">
            Nächste Wartung
          </label>
          <input
            className="field-input"
            id="next_maintenance_at"
            name="next_maintenance_at"
            type="date"
            defaultValue={vehicle?.next_maintenance_at ?? ""}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="location_text">
            Standort
          </label>
          <input
            className="field-input"
            id="location_text"
            name="location_text"
            defaultValue={vehicle?.location_text ?? ""}
            placeholder="Hauptlager, Baustelle, Fahrzeughof ..."
          />
        </div>
        <div>
          <label className="field-label" htmlFor="responsible_employee_id">
            Verantwortlicher
          </label>
          <select
            className="field-input"
            id="responsible_employee_id"
            name="responsible_employee_id"
            defaultValue={vehicle?.responsible_employee_id ?? ""}
          >
            <option value="">Nicht zugeordnet</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name || employee.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="qr_code">
            QR-Code Kennung
          </label>
          <input className="field-input" id="qr_code" name="qr_code" defaultValue={vehicle?.qr_code ?? ""} placeholder="Optional vorbereiten" />
        </div>
        <div>
          <label className="field-label" htmlFor="nfc_tag_id">
            NFC-Code Kennung
          </label>
          <input className="field-input" id="nfc_tag_id" name="nfc_tag_id" defaultValue={vehicle?.nfc_tag_id ?? ""} placeholder="Optional vorbereiten" />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="notes">
            Notizen
          </label>
          <textarea
            className="field-input min-h-28"
            id="notes"
            name="notes"
            defaultValue={vehicle?.notes ?? ""}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
