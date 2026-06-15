import { SubmitButton } from "@/components/submit-button";
import type { Vehicle } from "@/types/app";

export function VehicleForm({
  action,
  vehicle,
  submitLabel
}: {
  action: (formData: FormData) => Promise<void>;
  vehicle?: Vehicle;
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
