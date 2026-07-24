import "server-only";

import { createStructuredAiResponse } from "@/lib/ai/openai";
import type { RoofType } from "@/types/app";

export type RoofMaterialAiInput = {
  roof_type: RoofType;
  roof_form: string | null;
  material_type: string | null;
  area_m2: number;
  roof_pitch: number | null;
  eaves_length_m: number | null;
  ridge_length_m: number | null;
  verge_length_m: number | null;
  valley_length_m: number | null;
  wall_connection_length_m: number | null;
  dormers_count: number;
  chimneys_count: number;
  penetrations_count: number;
  roof_windows_count: number;
  waste_percent: number;
  calculated_items: Array<{
    material_name: string;
    unit: string;
    base_quantity: number;
    waste_percent: number;
    total_quantity: number;
  }>;
};

export type RoofMaterialAiSuggestion = {
  material_name: string;
  unit: string;
  base_quantity: number;
  waste_percent: number;
  waste_quantity: number;
  total_quantity: number;
  reason: string;
  confidence: number;
};

export type RoofMaterialAiResult = {
  confidence: number;
  summary: string;
  warnings: string[];
  additional_items: RoofMaterialAiSuggestion[];
};

const roofMaterialSchema = {
  type: "object",
  additionalProperties: false,
  required: ["confidence", "summary", "warnings", "additional_items"],
  properties: {
    confidence: { type: "number", minimum: 0, maximum: 1 },
    summary: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
    additional_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["material_name", "unit", "base_quantity", "waste_percent", "waste_quantity", "total_quantity", "reason", "confidence"],
        properties: {
          material_name: { type: "string" },
          unit: { type: "string" },
          base_quantity: { type: "number", minimum: 0 },
          waste_percent: { type: "number", minimum: 0, maximum: 100 },
          waste_quantity: { type: "number", minimum: 0 },
          total_quantity: { type: "number", minimum: 0 },
          reason: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        }
      }
    }
  }
};

function clamp(value: number, min = 0, max = 1) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value: string, fallback: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || fallback;
}

function normalizeQuantity(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 100) / 100;
}

export async function suggestRoofMaterialCalculation(input: RoofMaterialAiInput) {
  const result = await createStructuredAiResponse<RoofMaterialAiResult>({
    feature: "material_calculation",
    schemaName: "baupro_roof_material_calculation",
    schema: roofMaterialSchema,
    maxOutputTokens: 1600,
    system:
      "Du bist eine Dachdecker-Materialassistenz fuer deutsche Handwerksbetriebe. " +
      "Ergaenze nur sinnvolle Materialpositionen, die aus den eingegebenen Massen ableitbar sind. " +
      "Keine Statik, keine verbindliche Fachplanung, keine erfundenen Preise. " +
      "Wenn Angaben fehlen, schreibe Warnungen statt zu raten.",
    user:
      "Pruefe diese regelbasierte BauPro-Materialberechnung. " +
      "Gib nur zusaetzliche Materialpositionen zur Pruefung zurueck, keine Duplikate der vorhandenen Liste. " +
      "Typische Dachdeckerpositionen koennen z. B. Ziegel/Pfannen, Lattung, Konterlattung, Unterspannbahn, Schrauben, Naegel, Firstmaterial, Ortgangmaterial, Rinnenzubehoer oder Anschlussmaterial sein. " +
      "Alle Mengen müssen nachvollziehbar grob aus Fläche, Längen oder Stückzahlen abgeleitet sein und den Verschnitt berücksichtigen.\n\n" +
      JSON.stringify(input, null, 2)
  });

  if (!result.ok) return result;

  return {
    ...result,
    data: {
      confidence: clamp(result.data.confidence),
      summary: normalizeText(result.data.summary, "KI-Vorschlag bitte fachlich prüfen."),
      warnings: result.data.warnings.map((warning) => normalizeText(warning, "")).filter(Boolean).slice(0, 8),
      additional_items: result.data.additional_items
        .map((item) => ({
          material_name: normalizeText(item.material_name, "Materialposition"),
          unit: normalizeText(item.unit, "Stueck"),
          base_quantity: normalizeQuantity(item.base_quantity),
          waste_percent: clamp(item.waste_percent, 0, 100),
          waste_quantity: normalizeQuantity(item.waste_quantity),
          total_quantity: normalizeQuantity(item.total_quantity),
          reason: normalizeText(item.reason, "KI-Ergaenzung aus den eingegebenen Massen."),
          confidence: clamp(item.confidence)
        }))
        .filter((item) => item.total_quantity > 0 && item.material_name.length > 2)
        .slice(0, 12)
    }
  };
}
