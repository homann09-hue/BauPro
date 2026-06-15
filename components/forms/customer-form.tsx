import { SubmitButton } from "@/components/submit-button";
import { customerStatusLabels, customerTypeLabels } from "@/lib/order-labels";
import type { Customer, CustomerStatus, CustomerType } from "@/types/app";

type CustomerFormProps = {
  action: (formData: FormData) => Promise<void>;
  customer?: Customer;
  submitLabel: string;
};

const customerTypes = Object.keys(customerTypeLabels) as CustomerType[];
const customerStatuses = Object.keys(customerStatusLabels) as CustomerStatus[];

export function CustomerForm({ action, customer, submitLabel }: CustomerFormProps) {
  return (
    <form action={action} className="surface p-4 sm:p-5">
      {customer ? <input type="hidden" name="id" value={customer.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="field-label">Kundentyp</span>
          <select className="field-input" name="customer_type" defaultValue={customer?.customer_type ?? "privatkunde"}>
            {customerTypes.map((type) => (
              <option key={type} value={type}>
                {customerTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Status</span>
          <select className="field-input" name="status" defaultValue={customer?.status ?? "aktiv"}>
            {customerStatuses.map((status) => (
              <option key={status} value={status}>
                {customerStatusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Firma</span>
          <input className="field-input" name="company" defaultValue={customer?.company ?? ""} placeholder="z. B. Muster GmbH" />
        </label>
        <label>
          <span className="field-label">Ansprechpartner</span>
          <input
            className="field-input"
            name="contact_person"
            defaultValue={customer?.contact_person ?? ""}
            placeholder="optional"
          />
        </label>
        <label>
          <span className="field-label">Vorname</span>
          <input className="field-input" name="first_name" defaultValue={customer?.first_name ?? ""} />
        </label>
        <label>
          <span className="field-label">Nachname</span>
          <input className="field-input" name="last_name" defaultValue={customer?.last_name ?? ""} />
        </label>
        <label>
          <span className="field-label">Telefon</span>
          <input className="field-input" name="phone" type="tel" defaultValue={customer?.phone ?? ""} />
        </label>
        <label>
          <span className="field-label">E-Mail</span>
          <input className="field-input" name="email" type="email" defaultValue={customer?.email ?? ""} />
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">Rechnungsadresse</span>
          <textarea
            className="field-input min-h-24"
            name="billing_address"
            defaultValue={customer?.billing_address ?? ""}
            placeholder="Straße, PLZ Ort"
          />
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">Standard-Baustellenadresse</span>
          <textarea
            className="field-input min-h-24"
            name="jobsite_address"
            defaultValue={customer?.jobsite_address ?? ""}
            placeholder="falls abweichend"
          />
        </label>
        <label>
          <span className="field-label">Steuernummer/USt-ID</span>
          <input className="field-input" name="tax_id" defaultValue={customer?.tax_id ?? ""} />
        </label>
        <label>
          <span className="field-label">Zahlungsziel</span>
          <input className="field-input" name="payment_terms" defaultValue={customer?.payment_terms ?? ""} placeholder="z. B. 14 Tage netto" />
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">Notizen</span>
          <textarea className="field-input min-h-28" name="notes" defaultValue={customer?.notes ?? ""} />
        </label>
      </div>

      <div className="mt-6 flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
