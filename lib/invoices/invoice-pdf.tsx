import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Company, Invoice, InvoiceItem } from "@/types/app";
import { invoiceTypeLabels } from "@/lib/data/invoices";

export type InvoicePdfData = {
  company: Pick<Company, "id" | "name" | "address" | "contact_email" | "phone" | "tax_id" | "payment_terms">;
  invoice: Invoice;
  items: InvoiceItem[];
  generatedAt: string;
  logoUrl?: string | null;
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    color: "#1F2937",
    fontFamily: "Helvetica"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 24,
    marginBottom: 32
  },
  logo: {
    width: 96,
    height: 48,
    objectFit: "contain",
    marginBottom: 8
  },
  companyName: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1B5E20"
  },
  muted: {
    color: "#64748B"
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#1F2937",
    textAlign: "right"
  },
  metaBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 4
  },
  section: {
    marginBottom: 18
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
    color: "#2E7D32"
  },
  table: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 12
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0"
  },
  headerRow: {
    backgroundColor: "#1F2937",
    color: "#FFFFFF",
    fontWeight: 700
  },
  cell: {
    padding: 8
  },
  posCell: {
    width: "8%"
  },
  descriptionCell: {
    width: "44%"
  },
  quantityCell: {
    width: "14%",
    textAlign: "right"
  },
  priceCell: {
    width: "17%",
    textAlign: "right"
  },
  totalCell: {
    width: "17%",
    textAlign: "right"
  },
  totals: {
    width: 230,
    marginLeft: "auto",
    marginTop: 16
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5
  },
  totalGross: {
    marginTop: 4,
    padding: 8,
    backgroundColor: "#DCFCE7",
    color: "#1B5E20",
    fontWeight: 700
  },
  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 24,
    color: "#64748B",
    fontSize: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 8
  }
});

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatMoney(value?: number | null) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value ?? 0));
}

function customerName(invoice: Invoice) {
  const customer = invoice.customers;
  if (!customer) return "Kunde";
  return customer.company || [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.contact_person || "Kunde";
}

function customerAddress(invoice: Invoice) {
  return invoice.customers?.billing_address || invoice.customers?.jobsite_address || invoice.orders?.jobsite_address || "Adresse nicht hinterlegt";
}

function invoicePdfDocument(data: InvoicePdfData) {
  const { company, invoice, items, logoUrl } = data;

  return (
    <Document title={`${invoiceTypeLabels[invoice.type]} ${invoice.invoice_number}`} author={company.name}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image unterstuetzt kein alt-Prop. */}
            {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
            <Text style={styles.companyName}>{company.name}</Text>
            <Text style={styles.muted}>{company.address || "Firmenadresse nicht hinterlegt"}</Text>
            <Text style={styles.muted}>
              {[company.phone, company.contact_email].filter(Boolean).join(" · ") || "Kontaktdaten nicht hinterlegt"}
            </Text>
            {company.tax_id ? <Text style={styles.muted}>Steuernummer/USt-ID: {company.tax_id}</Text> : null}
          </View>

          <View>
            <Text style={styles.title}>{invoiceTypeLabels[invoice.type]}</Text>
            <View style={styles.metaBox}>
              <Text>Nummer: {invoice.invoice_number}</Text>
              <Text>Datum: {formatDate(invoice.issue_date)}</Text>
              <Text>Faellig: {formatDate(invoice.due_date)}</Text>
              <Text>Status: {invoice.status}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kunde</Text>
          <Text>{customerName(invoice)}</Text>
          <Text>{customerAddress(invoice)}</Text>
          {invoice.customers?.email ? <Text>{invoice.customers.email}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Leistungsbeschreibung</Text>
          <Text>{invoice.orders?.title || invoice.notes || "Leistungen gemaess Positionen."}</Text>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.cell, styles.posCell]}>Pos.</Text>
            <Text style={[styles.cell, styles.descriptionCell]}>Beschreibung</Text>
            <Text style={[styles.cell, styles.quantityCell]}>Menge</Text>
            <Text style={[styles.cell, styles.priceCell]}>Einzelpreis</Text>
            <Text style={[styles.cell, styles.totalCell]}>Gesamt</Text>
          </View>
          {items.map((item) => (
            <View key={item.id} style={styles.row}>
              <Text style={[styles.cell, styles.posCell]}>{item.position}</Text>
              <Text style={[styles.cell, styles.descriptionCell]}>{item.description}</Text>
              <Text style={[styles.cell, styles.quantityCell]}>
                {item.quantity} {item.unit}
              </Text>
              <Text style={[styles.cell, styles.priceCell]}>{formatMoney(item.unit_price_eur)}</Text>
              <Text style={[styles.cell, styles.totalCell]}>{formatMoney(item.total_eur)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Netto</Text>
            <Text>{formatMoney(invoice.subtotal_eur)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>MwSt. {invoice.tax_rate_percent}%</Text>
            <Text>{formatMoney(invoice.tax_eur)}</Text>
          </View>
          <View style={[styles.totalRow, styles.totalGross]}>
            <Text>Brutto</Text>
            <Text>{formatMoney(invoice.total_eur)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zahlungsbedingungen / Hinweise</Text>
          <Text>{invoice.notes || company.payment_terms || "Zahlbar innerhalb von 14 Tagen ohne Abzug."}</Text>
        </View>

        <Text style={styles.footer}>
          Automatisch erzeugt mit BauPro am {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.generatedAt))}.
          Interne Einkaufspreise und Margen sind nicht Bestandteil dieses Kunden-PDFs.
        </Text>
      </Page>
    </Document>
  );
}

export async function buildInvoicePdf(data: InvoicePdfData) {
  return renderToBuffer(invoicePdfDocument(data));
}

export function invoicePdfFilename(data: Pick<InvoicePdfData, "invoice">) {
  return `${data.invoice.type}_${data.invoice.invoice_number}.pdf`;
}
