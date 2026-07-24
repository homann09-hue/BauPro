"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Invoice, InvoiceItem, InvoiceType, Customer, Order } from "@/types/app";
import { formatMoney } from "@/lib/utils";

type InvoiceFormCustomer = Pick<Customer, "id" | "company" | "first_name" | "last_name" | "contact_person" | "billing_address">;
type InvoiceFormOrder = Pick<Order, "id" | "order_number" | "title" | "customer_id">;

type DraftItem = {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price_eur: string;
};

export type InvoiceFormProps = {
  customers: InvoiceFormCustomer[];
  orders: InvoiceFormOrder[];
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  invoice?: Invoice | null;
  items?: InvoiceItem[];
};

function customerName(customer: InvoiceFormCustomer) {
  return customer.company || [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.contact_person || "Unbenannter Kunde";
}

function defaultDueDate(type: InvoiceType) {
  if (type !== "rechnung") return "";
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
}

function decimalInput(value: number) {
  return Number(value ?? 0).toFixed(2);
}

function newDraftItem(): DraftItem {
  return {
    id: crypto.randomUUID(),
    description: "",
    quantity: "1",
    unit: "Stk.",
    unit_price_eur: "0.00"
  };
}

export function InvoiceForm({ customers, orders, action, submitLabel, invoice, items = [] }: InvoiceFormProps) {
  const [type, setType] = useState<InvoiceType>(invoice?.type ?? "rechnung");
  const [customerId, setCustomerId] = useState(invoice?.customer_id ?? customers[0]?.id ?? "");
  const [draftItems, setDraftItems] = useState<DraftItem[]>(
    items.length
      ? items.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: String(item.quantity),
          unit: item.unit,
          unit_price_eur: decimalInput(item.unit_price_eur)
        }))
      : [newDraftItem()]
  );
  const [taxRate, setTaxRate] = useState(String(invoice?.tax_rate_percent ?? 19));

  const visibleOrders = useMemo(
    () => orders.filter((order) => !customerId || order.customer_id === customerId),
    [customerId, orders]
  );
  const subtotal = draftItems.reduce((sum, item) => {
    const quantity = Number(item.quantity.replace(",", "."));
    const unitPrice = Number(item.unit_price_eur.replace(",", "."));
    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return sum;
    return sum + quantity * unitPrice;
  }, 0);
  const tax = subtotal * (Number(taxRate) || 0) / 100;
  const total = subtotal + tax;

  function updateItem(id: string, patch: Partial<DraftItem>) {
    setDraftItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    setDraftItems((current) => (current.length > 1 ? current.filter((item) => item.id !== id) : current));
  }

  function addItem() {
    setDraftItems((current) => [...current, newDraftItem()]);
  }

  return (
    <form action={action} className="grid gap-5 xl:grid-cols-[1fr_360px]">
      {invoice ? <input type="hidden" name="invoice_id" value={invoice.id} /> : null}

      <section className="space-y-5">
        <div className="surface p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="field-label">Belegtyp</span>
              <select className="field-input" name="type" value={type} onChange={(event) => setType(event.target.value as InvoiceType)}>
                <option value="angebot">Angebot</option>
                <option value="rechnung">Rechnung</option>
                <option value="gutschrift">Gutschrift</option>
              </select>
            </label>

            <label>
              <span className="field-label">Kunde</span>
              <select className="field-input" name="customer_id" required value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                <option value="">Kunde auswaehlen</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customerName(customer)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="field-label">Auftrag optional</span>
              <select className="field-input" name="order_id" defaultValue={invoice?.order_id ?? ""}>
                <option value="">Ohne Auftrag</option>
                {visibleOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.order_number} - {order.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="field-label">MwSt.</span>
              <select className="field-input" name="tax_rate_percent" value={taxRate} onChange={(event) => setTaxRate(event.target.value)}>
                <option value="19">19 %</option>
                <option value="7">7 %</option>
                <option value="0">0 %</option>
              </select>
            </label>

            <label>
              <span className="field-label">Datum</span>
              <input className="field-input" name="issue_date" type="date" required defaultValue={invoice?.issue_date ?? new Date().toISOString().slice(0, 10)} />
            </label>

            <label>
              <span className="field-label">Faelligkeit</span>
              <input className="field-input" name="due_date" type="date" defaultValue={invoice?.due_date ?? defaultDueDate(type)} />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="field-label">Notizen / Zahlungsbedingungen</span>
            <textarea
              className="field-input min-h-28"
              name="notes"
              defaultValue={invoice?.notes ?? "Zahlbar innerhalb von 14 Tagen ohne Abzug."}
              placeholder="Zahlungsbedingungen, Hinweise, Skonto..."
            />
          </label>
        </div>

        <div className="surface p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="section-kicker">Positionen</p>
              <h2 className="section-title">Leistungen und Material</h2>
            </div>
            <button className="btn-secondary min-h-11" type="button" onClick={addItem}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Position
            </button>
          </div>

          <div className="space-y-3">
            {draftItems.map((item, index) => (
              <div key={item.id} className="rounded-md border border-line bg-fog p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-black text-ink">Position {index + 1}</p>
                  <button
                    className="inline-flex min-h-10 items-center gap-1 rounded-md border border-red-200 px-3 text-sm font-bold text-danger"
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label={`Position ${index + 1} entfernen`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Entfernen
                  </button>
                </div>
                <div className="grid gap-3 lg:grid-cols-[1fr_110px_120px_140px]">
                  <label>
                    <span className="field-label">Beschreibung</span>
                    <input
                      className="field-input"
                      name="item_description"
                      required
                      value={item.description}
                      onChange={(event) => updateItem(item.id, { description: event.target.value })}
                      placeholder="z. B. Dachflaeche eindecken"
                    />
                  </label>
                  <label>
                    <span className="field-label">Menge</span>
                    <input
                      className="field-input"
                      name="item_quantity"
                      inputMode="decimal"
                      required
                      value={item.quantity}
                      onChange={(event) => updateItem(item.id, { quantity: event.target.value })}
                    />
                  </label>
                  <label>
                    <span className="field-label">Einheit</span>
                    <input
                      className="field-input"
                      name="item_unit"
                      required
                      value={item.unit}
                      onChange={(event) => updateItem(item.id, { unit: event.target.value })}
                    />
                  </label>
                  <label>
                    <span className="field-label">Einzelpreis netto</span>
                    <input
                      className="field-input"
                      name="item_unit_price_eur"
                      inputMode="decimal"
                      required
                      value={item.unit_price_eur}
                      onChange={(event) => updateItem(item.id, { unit_price_eur: event.target.value })}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <section className="surface-strong overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-moss via-steel to-signal" />
          <div className="p-4 sm:p-5">
            <p className="section-kicker">Live-Summe</p>
            <h2 className="section-title">Vorschau</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-slate-600">Netto</span>
                <span className="font-black text-ink">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-slate-600">MwSt. {taxRate} %</span>
                <span className="font-black text-ink">{formatMoney(tax)}</span>
              </div>
              <div className="flex justify-between gap-3 rounded-md bg-mint p-3 text-base">
                <span className="font-black text-primary-dark">Brutto</span>
                <span className="font-black text-primary-dark">{formatMoney(total)}</span>
              </div>
            </div>
            <button className="btn-primary mt-5 w-full min-h-12" type="submit">
              {submitLabel}
            </button>
          </div>
        </section>
      </aside>
    </form>
  );
}
