import "server-only";

import { createStructuredAiResponse } from "@/lib/ai/openai";

export type RecognizedDeliveryNoteItem = {
  article_name: string;
  article_number: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  total_price: number | null;
  confidence: number;
};

export type RecognizedDeliveryNote = {
  supplier_name: string | null;
  document_date: string | null;
  confidence: number;
  items: RecognizedDeliveryNoteItem[];
  warnings: string[];
};

const deliveryNoteSchema = {
  type: "object",
  additionalProperties: false,
  required: ["supplier_name", "document_date", "confidence", "items", "warnings"],
  properties: {
    supplier_name: { type: ["string", "null"] },
    document_date: {
      type: ["string", "null"],
      description: "Datum im Format YYYY-MM-DD oder null, wenn nicht sicher erkennbar."
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    warnings: {
      type: "array",
      items: { type: "string" }
    },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["article_name", "article_number", "quantity", "unit", "unit_price", "total_price", "confidence"],
        properties: {
          article_name: { type: "string" },
          article_number: { type: ["string", "null"] },
          quantity: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          unit_price: { type: ["number", "null"] },
          total_price: { type: ["number", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        }
      }
    }
  }
};

function normalizeDate(value: string | null) {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
function normalizeNumber(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export async function recognizeDeliveryNoteFromImage(imageUrl: string) {
  const result = await createStructuredAiResponse<RecognizedDeliveryNote>({
    feature: "delivery_note_recognition",
    schemaName: "delivery_note_recognition",
    schema: deliveryNoteSchema,
    imageUrls: [imageUrl],
    maxOutputTokens: 1800,
    system:
      "Du bist eine OCR- und Wareneingangs-Assistenz fuer deutsche Dachdecker- und Handwerksbetriebe. " +
      "Extrahiere nur Daten, die im Lieferscheinfoto sichtbar sind. Erfinde keine Artikel, Mengen, Preise oder Lieferanten. " +
      "Wenn ein Feld nicht sicher lesbar ist, setze null und fuege eine kurze Warnung hinzu.",
    user:
      "Lies den Lieferschein. Extrahiere Lieferant, Datum und Positionen mit Artikelname, Artikelnummer, Menge, Einheit, Einzelpreis und Gesamtpreis. " +
      "Preise sind Netto- oder Lieferscheinwerte aus dem Dokument; keine Kalkulation vornehmen. " +
      "Gib nur strukturierte JSON-Daten nach Schema zurueck."
  });

  if (!result.ok) return result;

  return {
    ...result,
    data: {
      supplier_name: result.data.supplier_name?.trim() || null,
      document_date: normalizeDate(result.data.document_date),
      confidence: Math.max(0, Math.min(1, normalizeNumber(result.data.confidence) ?? 0)),
      warnings: result.data.warnings.map((warning) => warning.trim()).filter(Boolean).slice(0, 8),
      items: result.data.items
        .map((item) => ({
          article_name: item.article_name.trim(),
          article_number: item.article_number?.trim() || null,
          quantity: normalizeNumber(item.quantity),
          unit: item.unit?.trim() || null,
          unit_price: normalizeNumber(item.unit_price),
          total_price: normalizeNumber(item.total_price),
          confidence: Math.max(0, Math.min(1, normalizeNumber(item.confidence) ?? 0))
        }))
        .filter((item) => item.article_name)
        .slice(0, 60)
    }
  };
}
