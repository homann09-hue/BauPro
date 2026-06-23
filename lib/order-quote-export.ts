import { customerDisplayName } from "@/lib/order-labels";
import { buildPdfDocument, cleanPdfText, line, text, truncatePdfText, wrapText } from "@/lib/pdf/simple-pdf";
import { formatQuantity } from "@/lib/inventory";
import { formatDate, formatMoney } from "@/lib/utils";
import type { Company, Customer, Order } from "@/types/app";

type QuoteCustomer = Pick<
  Customer,
  "id" | "company" | "first_name" | "last_name" | "contact_person" | "phone" | "email" | "billing_address" | "jobsite_address" | "payment_terms"
>;

export type OrderQuoteEstimateItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  vk_total: number | null;
  notes: string | null;
};

export type OrderQuoteEstimate = {
  id: string;
  material_vk_total: number;
  labor_total_net: number;
  subtotal_net: number;
  vat_rate: number;
  vat_total: number;
  total_gross: number;
  price_source_summary: Record<string, unknown> | null;
  job_estimate_items?: OrderQuoteEstimateItem[];
};

export type OrderQuotePdfData = {
  company: Pick<Company, "id" | "name" | "address" | "contact_email" | "phone" | "tax_id" | "payment_terms">;
  order: Pick<Order, "id" | "order_number" | "title" | "jobsite_address" | "description" | "start_date" | "created_at"> & {
    customers: QuoteCustomer | null;
  };
  estimate: OrderQuoteEstimate;
  generatedAt: string;
};

type QuotePosition = {
  title: string;
  description: string;
  quantity: number;
  unit: string;
  totalNet: number;
};

function pdfNumber(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function summaryNumber(estimate: OrderQuoteEstimate, key: string) {
  const value = estimate.price_source_summary?.[key];
  return typeof value === "number" || typeof value === "string" ? pdfNumber(value) : 0;
}

function quoteNumber(orderNumber: string) {
  return orderNumber.startsWith("AU-") ? orderNumber.replace("AU-", "AG-") : `AG-${orderNumber}`;
}

export function orderQuoteFilename(data: OrderQuotePdfData) {
  const number = cleanPdfText(quoteNumber(data.order.order_number)).replace(/[^a-zA-Z0-9_-]/g, "_");
  return `angebot_${number}.pdf`;
}

function fillRect(x: number, y: number, width: number, height: number, color: "green" | "light" | "dark") {
  const rgb = color === "green" ? "0.18 0.49 0.20" : color === "dark" ? "0.12 0.16 0.22" : "0.95 0.97 0.98";
  return `${rgb} rg ${x} ${y} ${width} ${height} re f 0 0 0 rg\n`;
}

function drawWrapped({
  x,
  y,
  value,
  size,
  maxChars,
  maxLines = 4,
  leading = 13
}: {
  x: number;
  y: number;
  value: string | null | undefined;
  size: number;
  maxChars: number;
  maxLines?: number;
  leading?: number;
}) {
  const lines = wrapText(value, maxChars).slice(0, maxLines);
  let content = "";
  lines.forEach((lineValue, index) => {
    const suffix = index === maxLines - 1 && wrapText(value, maxChars).length > maxLines ? " ..." : "";
    content += text(x, y - index * leading, size, `${lineValue}${suffix}`);
  });
  return { content, y: y - lines.length * leading };
}

function materialDescription(items: OrderQuoteEstimateItem[]) {
  if (items.length === 0) return "Material und Zubehör gemäß Aufmaß und Kalkulation.";
  const names = items
    .slice(0, 5)
    .map((item) => cleanPdfText(item.description))
    .filter(Boolean)
    .join(", ");
  return `${names}${items.length > 5 ? " und weitere Positionen" : ""}`;
}

function quotePositions(data: OrderQuotePdfData): QuotePosition[] {
  const estimate = data.estimate;
  const items = estimate.job_estimate_items ?? [];
  const materialTotal = pdfNumber(estimate.material_vk_total) || summaryNumber(estimate, "material_total_net");
  const laborTotal = pdfNumber(estimate.labor_total_net) || summaryNumber(estimate, "labor_sales_total_net");
  const travelTotal = summaryNumber(estimate, "travel_total_net");
  const machineExtraTotal = summaryNumber(estimate, "machine_extra_total_net");
  const laborHours = summaryNumber(estimate, "labor_person_hours");
  const travelKm = summaryNumber(estimate, "travel_billable_km");
  const positions: QuotePosition[] = [];

  if (materialTotal > 0) {
    positions.push({
      title: "Material und Zubehör",
      description: materialDescription(items),
      quantity: 1,
      unit: "Pauschal",
      totalNet: materialTotal
    });
  }

  if (laborTotal > 0) {
    positions.push({
      title: "Arbeitsleistung Dacharbeiten",
      description: laborHours > 0 ? `${formatQuantity(laborHours)} Personenstunden gemäß Kalkulation.` : "Arbeitsleistung gemäß Leistungsbeschreibung.",
      quantity: 1,
      unit: "Pauschal",
      totalNet: laborTotal
    });
  }

  if (travelTotal > 0) {
    positions.push({
      title: "Fahrtkosten",
      description: travelKm > 0 ? `Anfahrt und Rückfahrt zur Baustelle, ${formatQuantity(travelKm)} km abrechenbar.` : "Fahrtkosten zur Baustelle.",
      quantity: 1,
      unit: "Pauschal",
      totalNet: travelTotal
    });
  }

  if (machineExtraTotal > 0) {
    positions.push({
      title: "Maschinen und Extras",
      description: "Maschinen, Geräte, Entsorgung oder Zusatzleistungen gemäß Kalkulation.",
      quantity: 1,
      unit: "Pauschal",
      totalNet: machineExtraTotal
    });
  }

  if (positions.length === 0) {
    positions.push({
      title: data.order.title,
      description: "Pauschalposition gemäß Auftragskalkulation.",
      quantity: 1,
      unit: "Pauschal",
      totalNet: pdfNumber(estimate.subtotal_net)
    });
  }

  return positions;
}

function customerAddress(customer: QuoteCustomer | null, orderAddress: string) {
  return customer?.billing_address || customer?.jobsite_address || orderAddress;
}

export function buildOrderQuotePdf(data: OrderQuotePdfData) {
  const customer = data.order.customers;
  const customerName = customer ? customerDisplayName(customer) : "Kunde";
  const offerNumber = quoteNumber(data.order.order_number);
  const paymentTerms =
    data.company.payment_terms ||
    customer?.payment_terms ||
    "Zahlbar innerhalb von 14 Tagen ohne Abzug. Angebot freibleibend bis zur schriftlichen Beauftragung.";
  const positions = quotePositions(data);
  let content = "1 1 1 rg 0 0 595 842 re f 0 0 0 rg\n0.8 w\n";

  content += fillRect(0, 790, 595, 52, "dark");
  content += "1 1 1 rg\n";
  content += text(42, 818, 18, data.company.name);
  content += text(42, 800, 9, "BauPro Angebot");
  content += text(392, 818, 18, "Angebot");
  content += text(392, 800, 10, offerNumber);
  content += "0 0 0 rg\n";

  content += text(42, 764, 8, cleanPdfText([data.company.address, data.company.contact_email, data.company.phone].filter(Boolean).join(" · ")));
  content += text(392, 764, 9, `Datum: ${formatDate(data.generatedAt.slice(0, 10))}`);
  content += text(392, 748, 9, `Auftrag: ${data.order.order_number}`);
  content += line(42, 732, 553, 732);

  content += text(42, 706, 11, "Kundendaten");
  content += text(42, 688, 10, customerName);
  content += text(42, 672, 9, customer?.contact_person ? `Ansprechpartner: ${customer.contact_person}` : "");
  content += text(42, 656, 9, [customer?.email, customer?.phone].filter(Boolean).join(" · "));
  const addressBlock = drawWrapped({
    x: 42,
    y: 638,
    value: customerAddress(customer, data.order.jobsite_address),
    size: 9,
    maxChars: 54,
    maxLines: 3
  });
  content += addressBlock.content;

  content += fillRect(330, 620, 223, 88, "light");
  content += text(348, 690, 10, "Baustelle");
  content += drawWrapped({ x: 348, y: 672, value: data.order.jobsite_address, size: 9, maxChars: 34, maxLines: 4 }).content;

  content += text(42, 586, 12, truncatePdfText(data.order.title, 82));
  const description = drawWrapped({
    x: 42,
    y: 566,
    value: data.order.description || "Leistungsbeschreibung gemäß Auftrag und Aufmaß.",
    size: 9,
    maxChars: 88,
    maxLines: 5
  });
  content += description.content;

  let y = Math.min(description.y - 18, 500);
  content += fillRect(42, y - 4, 511, 22, "green");
  content += "1 1 1 rg\n";
  content += text(52, y + 2, 8, "Pos.");
  content += text(88, y + 2, 8, "Leistung / Position");
  content += text(330, y + 2, 8, "Menge");
  content += text(410, y + 2, 8, "Einheit");
  content += text(492, y + 2, 8, "Netto");
  content += "0 0 0 rg\n";
  y -= 24;

  positions.slice(0, 10).forEach((position, index) => {
    content += text(52, y, 8, index + 1);
    content += text(88, y, 8, truncatePdfText(position.title, 42));
    content += text(330, y, 8, formatQuantity(position.quantity));
    content += text(410, y, 8, position.unit);
    content += text(492, y, 8, formatMoney(position.totalNet));
    y -= 13;
    content += drawWrapped({ x: 88, y, value: position.description, size: 7, maxChars: 58, maxLines: 2, leading: 10 }).content;
    y -= 25;
  });

  content += line(340, 190, 553, 190);
  content += text(350, 170, 10, "Netto");
  content += text(482, 170, 10, formatMoney(data.estimate.subtotal_net));
  content += text(350, 150, 10, `MwSt. ${formatQuantity(data.estimate.vat_rate)} %`);
  content += text(482, 150, 10, formatMoney(data.estimate.vat_total));
  content += fillRect(340, 106, 213, 28, "green");
  content += "1 1 1 rg\n";
  content += text(350, 116, 12, "Brutto");
  content += text(482, 116, 12, formatMoney(data.estimate.total_gross));
  content += "0 0 0 rg\n";

  content += text(42, 170, 10, "Zahlungsbedingungen");
  content += drawWrapped({ x: 42, y: 150, value: paymentTerms, size: 8, maxChars: 58, maxLines: 4, leading: 11 }).content;
  content += text(42, 76, 8, "Dieses Kunden-PDF enthält keine internen Einkaufspreise oder Lieferantenkonditionen.");
  content += text(42, 60, 8, `Erstellt am ${formatDate(data.generatedAt.slice(0, 10))} mit BauPro.`);

  return buildPdfDocument(content);
}
