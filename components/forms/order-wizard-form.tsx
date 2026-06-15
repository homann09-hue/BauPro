"use client";

import { useMemo, useState } from "react";
import { Calculator, ClipboardCheck, UserRound } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { createOrderAction } from "@/lib/actions/order-actions";
import {
  customerDisplayName,
  customerTypeLabels,
  orderPriorityLabels,
  orderStatusLabels,
  orderTypeLabels
} from "@/lib/order-labels";
import type { Customer, CustomerType, OrderPriority, OrderStatus, OrderType, Profile } from "@/types/app";

type CustomerOption = Pick<
  Customer,
  "id" | "company" | "first_name" | "last_name" | "contact_person" | "jobsite_address" | "billing_address"
>;

type OrderWizardFormProps = {
  customers: CustomerOption[];
  employees: Profile[];
  defaultCustomerId?: string;
  defaultWastePercent: number;
};

const orderTypes = Object.keys(orderTypeLabels) as OrderType[];
const orderStatuses = Object.keys(orderStatusLabels) as OrderStatus[];
const orderPriorities = Object.keys(orderPriorityLabels) as OrderPriority[];
const customerTypes = Object.keys(customerTypeLabels) as CustomerType[];

function decimalValue(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function OrderWizardForm({
  customers,
  employees,
  defaultCustomerId,
  defaultWastePercent
}: OrderWizardFormProps) {
  const initialCustomerId = defaultCustomerId && customers.some((customer) => customer.id === defaultCustomerId)
    ? defaultCustomerId
    : customers[0]?.id ?? "new";
  const initialCustomer = customers.find((customer) => customer.id === initialCustomerId);
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [jobsiteAddress, setJobsiteAddress] = useState(
    initialCustomer?.jobsite_address ?? initialCustomer?.billing_address ?? ""
  );
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [area, setArea] = useState("");

  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const calculatedArea = useMemo(() => {
    const lengthValue = decimalValue(length);
    const widthValue = decimalValue(width);

    if (!lengthValue || !widthValue) return "";
    return String(Math.round(lengthValue * widthValue * 100) / 100).replace(".", ",");
  }, [length, width]);

  function updateCustomer(nextCustomerId: string) {
    setCustomerId(nextCustomerId);
    const customer = customers.find((item) => item.id === nextCustomerId);
    setJobsiteAddress(customer?.jobsite_address ?? customer?.billing_address ?? "");
  }

  function updateLength(value: string) {
    setLength(value);
    const widthValue = decimalValue(width);
    const lengthValue = decimalValue(value);
    if (lengthValue && widthValue) setArea(String(Math.round(lengthValue * widthValue * 100) / 100).replace(".", ","));
  }

  function updateWidth(value: string) {
    setWidth(value);
    const widthValue = decimalValue(value);
    const lengthValue = decimalValue(length);
    if (lengthValue && widthValue) setArea(String(Math.round(lengthValue * widthValue * 100) / 100).replace(".", ","));
  }

  return (
    <form action={createOrderAction} className="space-y-5">
      <section className="surface p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-mint text-moss">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="meta-label">Schritt 1</p>
            <h2 className="section-title">Kunde</h2>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="field-label">Kunde auswählen</span>
            <select
              className="field-input"
              name="customer_id"
              value={customerId}
              onChange={(event) => updateCustomer(event.target.value)}
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customerDisplayName(customer)}
                  {customer.contact_person ? ` · ${customer.contact_person}` : ""}
                </option>
              ))}
              <option value="new">Neuen Kunden anlegen</option>
            </select>
          </label>

          {customerId === "new" ? (
            <>
              <label>
                <span className="field-label">Kundentyp</span>
                <select className="field-input" name="new_customer_type" defaultValue="privatkunde">
                  {customerTypes.map((type) => (
                    <option key={type} value={type}>
                      {customerTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">Firma</span>
                <input className="field-input" name="new_customer_company" placeholder="optional" />
              </label>
              <label>
                <span className="field-label">Vorname</span>
                <input className="field-input" name="new_customer_first_name" />
              </label>
              <label>
                <span className="field-label">Nachname</span>
                <input className="field-input" name="new_customer_last_name" />
              </label>
              <label>
                <span className="field-label">Ansprechpartner</span>
                <input className="field-input" name="new_customer_contact_person" />
              </label>
              <label>
                <span className="field-label">Telefon</span>
                <input className="field-input" name="new_customer_phone" type="tel" />
              </label>
              <label>
                <span className="field-label">E-Mail</span>
                <input className="field-input" name="new_customer_email" type="email" />
              </label>
              <label>
                <span className="field-label">Rechnungsadresse</span>
                <input className="field-input" name="new_customer_billing_address" />
              </label>
            </>
          ) : selectedCustomer ? (
            <div className="rounded-md border border-line bg-fog p-3 text-sm text-slate-600 sm:col-span-2">
              <p className="font-black text-ink">{customerDisplayName(selectedCustomer)}</p>
              {selectedCustomer.contact_person ? <p>Ansprechpartner: {selectedCustomer.contact_person}</p> : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="surface p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-steel/10 text-steel">
            <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="meta-label">Schritt 2</p>
            <h2 className="section-title">Auftrag</h2>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="sm:col-span-2">
            <span className="field-label">Auftragstitel</span>
            <input className="field-input" name="title" placeholder="z. B. Sanierung Hauptdach Müller" required />
          </label>
          <label>
            <span className="field-label">Auftragsart</span>
            <select className="field-input" name="order_type" defaultValue="steildach">
              {orderTypes.map((type) => (
                <option key={type} value={type}>
                  {orderTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Status</span>
            <select className="field-input" name="status" defaultValue="anfrage">
              {orderStatuses.map((status) => (
                <option key={status} value={status}>
                  {orderStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Priorität</span>
            <select className="field-input" name="priority" defaultValue="normal">
              {orderPriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {orderPriorityLabels[priority]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Start</span>
            <input className="field-input" name="start_date" type="date" />
          </label>
          <label>
            <span className="field-label">Ende</span>
            <input className="field-input" name="end_date" type="date" />
          </label>
          <label className="sm:col-span-2 lg:col-span-4">
            <span className="field-label">Baustellenadresse</span>
            <textarea
              className="field-input min-h-24"
              name="jobsite_address"
              value={jobsiteAddress}
              onChange={(event) => setJobsiteAddress(event.target.value)}
              required
            />
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">Beschreibung</span>
            <textarea className="field-input min-h-28" name="description" />
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">Interne Chef-Notizen</span>
            <textarea className="field-input min-h-28" name="internal_notes" />
          </label>
        </div>

        <fieldset className="mt-5">
          <legend className="field-label">Mitarbeiter zuordnen</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {employees.map((employee) => (
              <label key={employee.id} className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  name="assigned_employee_ids"
                  value={employee.id}
                  className="h-4 w-4 rounded border-line text-moss"
                />
                <span>{employee.full_name || employee.email}</span>
              </label>
            ))}
          </div>
          {employees.length === 0 ? <p className="field-help">Noch keine Mitarbeiter oder Vorarbeiter vorhanden.</p> : null}
        </fieldset>
      </section>

      <section className="surface p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-signal/15 text-amber-700">
            <Calculator className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="meta-label">Schritt 3</p>
            <h2 className="section-title">Maße und Material</h2>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className="field-label">Länge m</span>
            <input className="field-input" name="length_m" inputMode="decimal" value={length} onChange={(event) => updateLength(event.target.value)} />
          </label>
          <label>
            <span className="field-label">Breite m</span>
            <input className="field-input" name="width_m" inputMode="decimal" value={width} onChange={(event) => updateWidth(event.target.value)} />
          </label>
          <label>
            <span className="field-label">Fläche m²</span>
            <input
              className="field-input"
              name="area_m2"
              inputMode="decimal"
              value={area || calculatedArea}
              onChange={(event) => setArea(event.target.value)}
              placeholder="automatisch"
            />
          </label>
          <label>
            <span className="field-label">Verschnitt %</span>
            <input className="field-input" name="waste_percent" inputMode="decimal" defaultValue={String(defaultWastePercent).replace(".", ",")} />
          </label>
          <label>
            <span className="field-label">Dachneigung °</span>
            <input className="field-input" name="roof_pitch" inputMode="decimal" />
          </label>
          <label>
            <span className="field-label">Traufe m</span>
            <input className="field-input" name="eaves_length_m" inputMode="decimal" />
          </label>
          <label>
            <span className="field-label">First m</span>
            <input className="field-input" name="ridge_length_m" inputMode="decimal" />
          </label>
          <label>
            <span className="field-label">Ortgang m</span>
            <input className="field-input" name="verge_length_m" inputMode="decimal" />
          </label>
          <label>
            <span className="field-label">Kehle m</span>
            <input className="field-input" name="valley_length_m" inputMode="decimal" />
          </label>
          <label>
            <span className="field-label">Wandanschluss m</span>
            <input className="field-input" name="wall_connection_length_m" inputMode="decimal" />
          </label>
          <label>
            <span className="field-label">Gebäudehöhe m</span>
            <input className="field-input" name="building_height_m" inputMode="decimal" />
          </label>
          <label>
            <span className="field-label">Fallrohrlänge m</span>
            <input className="field-input" name="downpipe_length_m" inputMode="decimal" />
          </label>
          <label>
            <span className="field-label">Dachfenster</span>
            <input className="field-input" name="roof_windows_count" inputMode="numeric" />
          </label>
          <label>
            <span className="field-label">Durchdringungen</span>
            <input className="field-input" name="penetrations_count" inputMode="numeric" />
          </label>
          <label>
            <span className="field-label">Dachabläufe</span>
            <input className="field-input" name="roof_drains_count" inputMode="numeric" />
          </label>
          <label>
            <span className="field-label">Notüberläufe</span>
            <input className="field-input" name="emergency_overflows_count" inputMode="numeric" />
          </label>
          <label className="sm:col-span-2 lg:col-span-4">
            <span className="field-label">Notizen zur Berechnung</span>
            <input className="field-input" name="dimension_notes" />
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button className="btn-secondary opacity-70" type="button" disabled title="Vorbereitet fuer die Angebots- und Exportstrecke">
            PDF/Export vorbereitet
          </button>
          <SubmitButton>
            <Calculator className="h-4 w-4" aria-hidden="true" />
            Auftrag speichern
          </SubmitButton>
        </div>
      </section>
    </form>
  );
}
