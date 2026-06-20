import type { MaterialCalculationRule, RoofType } from "@/types/app";

export const roofTypeLabels: Record<RoofType, string> = {
  steildach: "Steildach",
  flachdach: "Flachdach",
  reparatur: "Reparatur",
  entwaesserung: "Entwässerung",
  blech: "Blech"
};

export const roofFormLabels: Record<string, string> = {
  satteldach: "Satteldach",
  walmdach: "Walmdach",
  pultdach: "Pultdach",
  flachdach: "Flachdach",
  mansarddach: "Mansarddach",
  sonstiges: "Sonstiges"
};

export const materialTypeLabels: Record<string, string> = {
  tonziegel: "Tonziegel",
  betondachstein: "Betondachstein",
  schiefer: "Schiefer",
  bitumen: "Bitumen/Schweissbahn",
  metall: "Metall/Blech",
  gruen: "Gruendach-Aufbau",
  sonstiges: "Sonstiges"
};

export type CalculationInput = {
  roof_form: string | null;
  material_type: string | null;
  length_m: number | null;
  width_m: number | null;
  area_m2: number;
  roof_pitch: number | null;
  eaves_length_m: number | null;
  ridge_length_m: number | null;
  verge_length_m: number | null;
  valley_length_m: number | null;
  wall_connection_length_m: number | null;
  penetrations_count: number;
  roof_windows_count: number;
  dormers_count: number;
  chimneys_count: number;
  waste_percent: number;
};

function roundQuantity(value: number, unit: string) {
  if (!Number.isFinite(value)) return 0;
  const unitLower = unit.toLowerCase();

  if (unitLower.includes("stück") || unitLower.includes("stueck") || unitLower.includes("paar")) {
    return Math.ceil(value);
  }

  return Math.round(value * 100) / 100;
}

export function calculateArea(length: number | null, width: number | null, area: number | null) {
  if (length && width) return Math.round(length * width * 100) / 100;
  return Math.round((area ?? 0) * 100) / 100;
}

export function calculateBaseQuantity(rule: MaterialCalculationRule, input: CalculationInput) {
  const factor = Number(rule.factor || 1);
  const spacing = Number(rule.spacing_m || 0);

  switch (rule.calculation_method) {
    case "area":
      return input.area_m2 * factor;
    case "area_per_spacing":
      return spacing > 0 ? (input.area_m2 / spacing) * factor : 0;
    case "first_length":
      return (input.ridge_length_m ?? 0) * factor;
    case "eaves_length":
      return (input.eaves_length_m ?? 0) * factor;
    case "verge_length":
      return (input.verge_length_m ?? 0) * factor;
    case "valley_length":
      return (input.valley_length_m ?? 0) * factor;
    case "wall_connection_length":
      return (input.wall_connection_length_m ?? 0) * factor;
    case "penetrations_count":
      return input.penetrations_count * factor;
    case "roof_windows_count":
      return input.roof_windows_count * factor;
    case "dormers_count":
      return input.dormers_count * factor;
    case "chimneys_count":
      return input.chimneys_count * factor;
    case "gutter_hangers":
      return spacing > 0 ? (input.eaves_length_m ?? 0) / spacing * factor : 0;
    default:
      return 0;
  }
}

export function calculateRuleResult(rule: MaterialCalculationRule, input: CalculationInput) {
  const baseQuantity = roundQuantity(calculateBaseQuantity(rule, input), rule.unit);
  const wastePercent = rule.waste_applies ? input.waste_percent : 0;
  const wasteQuantity = roundQuantity(baseQuantity * (wastePercent / 100), rule.unit);
  const totalQuantity = roundQuantity(baseQuantity + wasteQuantity, rule.unit);

  return {
    baseQuantity,
    wastePercent,
    wasteQuantity,
    totalQuantity
  };
}
