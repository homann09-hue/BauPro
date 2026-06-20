import { SubmitButton } from "@/components/submit-button";
import { resourceKindLabels, resourceKinds, resourceStatusLabels, resourceStatuses } from "@/lib/resources";
import type { PlanningResource, Profile, Vehicle } from "@/types/app";

type EmployeeOption = Pick<Profile, "id" | "full_name" | "email" | "role">;
type VehicleOption = Pick<Vehicle, "id" | "name" | "license_plate">;

export function ResourceForm({
  action,
  resource,
  employees,
  vehicles,
  submitLabel,
  returnTo
}: {
  action: (formData: FormData) => Promise<void>;
  resource?: PlanningResource;
  employees: EmployeeOption[];
  vehicles: VehicleOption[];
  submitLabel: string;
  returnTo?: string;
}) {
  return (
    <form action={action} className="surface p-4 sm:p-5">
      {resource ? <input type="hidden" name="resource_id" value={resource.id} /> : null}
      {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="name">
            Name
          </label>
          <input className="field-input" id="name" name="name" defaultValue={resource?.name} placeholder="z. B. Schraegaufzug, Brenner, Leiter" required />
        </div>
        <div>
          <label className="field-label" htmlFor="resource_kind">
            Ressourcenart
          </label>
          <select className="field-input" id="resource_kind" name="resource_kind" defaultValue={resource?.resource_kind ?? "maschine"}>
            {resourceKinds.map((kind) => (
              <option key={kind} value={kind}>
                {resourceKindLabels[kind]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="status">
            Status
          </label>
          <select className="field-input" id="status" name="status" defaultValue={resource?.status ?? "verfuegbar"}>
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
          <label className="field-label" htmlFor="location_text">
            Standort
          </label>
          <input className="field-input" id="location_text" name="location_text" defaultValue={resource?.location_text ?? ""} placeholder="Hauptlager, Fahrzeug, Baustelle ..." />
        </div>
        <div>
          <label className="field-label" htmlFor="responsible_employee_id">
            Verantwortlicher
          </label>
          <select className="field-input" id="responsible_employee_id" name="responsible_employee_id" defaultValue={resource?.responsible_employee_id ?? ""}>
            <option value="">Nicht zugeordnet</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name || employee.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="vehicle_id">
            Liegt im Fahrzeug
          </label>
          <select className="field-input" id="vehicle_id" name="vehicle_id" defaultValue={resource?.vehicle_id ?? ""}>
            <option value="">Kein Fahrzeug</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.name}
                {vehicle.license_plate ? ` (${vehicle.license_plate})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="inspection_due_date">
            Prüftermin
          </label>
          <input className="field-input" id="inspection_due_date" name="inspection_due_date" type="date" defaultValue={resource?.inspection_due_date ?? ""} />
        </div>
        <div>
          <label className="field-label" htmlFor="maintenance_interval_days">
            Wartungsintervall in Tagen
          </label>
          <input className="field-input" id="maintenance_interval_days" name="maintenance_interval_days" type="number" min={1} max={3650} defaultValue={resource?.maintenance_interval_days ?? ""} />
        </div>
        <div>
          <label className="field-label" htmlFor="last_maintenance_at">
            Letzte Wartung
          </label>
          <input className="field-input" id="last_maintenance_at" name="last_maintenance_at" type="date" defaultValue={resource?.last_maintenance_at ?? ""} />
        </div>
        <div>
          <label className="field-label" htmlFor="next_maintenance_at">
            Nächste Wartung
          </label>
          <input className="field-input" id="next_maintenance_at" name="next_maintenance_at" type="date" defaultValue={resource?.next_maintenance_at ?? ""} />
        </div>
        <div>
          <label className="field-label" htmlFor="qr_code">
            QR-Code Kennung
          </label>
          <input className="field-input" id="qr_code" name="qr_code" defaultValue={resource?.qr_code ?? ""} placeholder="Optional vorbereiten" />
        </div>
        <div>
          <label className="field-label" htmlFor="nfc_tag_id">
            NFC-Code Kennung
          </label>
          <input className="field-input" id="nfc_tag_id" name="nfc_tag_id" defaultValue={resource?.nfc_tag_id ?? ""} placeholder="Optional vorbereiten" />
        </div>
        <div className="lg:col-span-2">
          <label className="field-label" htmlFor="notes">
            Notizen
          </label>
          <textarea className="field-input min-h-28" id="notes" name="notes" defaultValue={resource?.notes ?? ""} />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
