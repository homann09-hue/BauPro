import { describe, expect, it } from "vitest";
import { buildOrderQuotePdf, orderQuoteFilename, type OrderQuotePdfData } from "@/lib/order-quote-export";

const quoteData: OrderQuotePdfData = {
  company: {
    id: "company-1",
    name: "Müller Dachtechnik GmbH",
    address: "Dachdeckerstraße 12, 30159 Hannover",
    contact_email: "info@example.test",
    phone: "0511 123456",
    tax_id: "DE123456789",
    payment_terms: "Zahlbar innerhalb von 14 Tagen ohne Abzug."
  },
  order: {
    id: "order-1",
    order_number: "AU-2026-0007",
    title: "Sanierung Hauptdach König",
    jobsite_address: "Dachdeckerstraße 20, 30159 Hannover",
    description: "Alte Eindeckung aufnehmen, Unterspannbahn erneuern und Dachfläche neu eindecken.",
    start_date: "2026-07-01",
    created_at: "2026-06-21T08:00:00.000Z",
    customers: {
      id: "customer-1",
      company: null,
      first_name: "Erika",
      last_name: "König",
      contact_person: null,
      phone: "0511 55555",
      email: "kundin@example.test",
      billing_address: "Dachdeckerstraße 20, 30159 Hannover",
      jobsite_address: "Dachdeckerstraße 20, 30159 Hannover",
      payment_terms: null
    }
  },
  estimate: {
    id: "estimate-1",
    material_vk_total: 2400,
    labor_total_net: 1600,
    subtotal_net: 4210,
    vat_rate: 19,
    vat_total: 799.9,
    total_gross: 5009.9,
    price_source_summary: {
      travel_total_net: 150,
      machine_extra_total_net: 60,
      labor_person_hours: 24,
      travel_billable_km: 120,
      purchase_price: 999,
      labor_margin_total: 500
    },
    job_estimate_items: [
      {
        id: "item-1",
        description: "Dachziegel rot engobiert",
        quantity: 1200,
        unit: "Stück",
        vk_total: 1800,
        notes: "Kundenfähiger Materialtext"
      }
    ]
  },
  generatedAt: "2026-06-21T10:00:00.000Z"
};

describe("order quote PDF", () => {
  it("erstellt ein sauberes Kunden-Angebots-PDF aus der Auftragskalkulation", () => {
    const pdf = buildOrderQuotePdf(quoteData);
    const source = pdf.toString("latin1");

    expect(pdf.subarray(0, 7).toString("utf8")).toBe("%PDF-1.");
    expect(source).toContain("Angebot");
    expect(source).toContain("Material und Zubeh");
    expect(source).toContain("Arbeitsleistung");
    expect(source).toContain("Fahrtkosten");
    expect(source).toContain("Zahlungsbedingungen");
  });

  it("legt keine internen EK- oder Margenbegriffe in das Kunden-PDF", () => {
    const source = buildOrderQuotePdf(quoteData).toString("latin1");

    expect(source).not.toMatch(/\bEK\b|Marge|purchase_price|labor_margin|ek_total/i);
  });

  it("nutzt eine stabile Angebotsdatei", () => {
    expect(orderQuoteFilename(quoteData)).toBe("angebot_AG-2026-0007.pdf");
  });
});
