import type { OrderMeasurementItem, OrderMeasurementItemType } from "@/types/app";

export const orderMeasurementItemTypeLabels: Record<OrderMeasurementItemType, string> = {
  roof_area: "Dachflaeche",
  deduction_area: "Abzug/Oeffnung",
  eaves_length: "Traufe",
  ridge_length: "First",
  verge_length: "Ortgang",
  valley_length: "Kehle",
  wall_connection_length: "Wandanschluss",
  downpipe_length: "Fallrohr",
  roof_window: "Dachfenster",
  penetration: "Durchdringung",
  roof_drain: "Dachablauf",
  emergency_overflow: "Notueberlauf"
};

export type MeasurementDraft = {
  item_type: OrderMeasurementItemType;
  label: string;
  length_m: number | null;
  width_m: number | null;
  quantity: number;
  pitch_deg: number | null;
  notes: string | null;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function isAreaType(type: OrderMeasurementItemType) {
  return type === "roof_area" || type === "deduction_area";
}

function isLengthType(type: OrderMeasurementItemType) {
  return [
    "eaves_length",
    "ridge_length",
    "verge_length",
    "valley_length",
    "wall_connection_length",
    "downpipe_length"
  ].includes(type);
}

function isCountType(type: OrderMeasurementItemType) {
  return ["roof_window", "penetration", "roof_drain", "emergency_overflow"].includes(type);
}

function pitchFactor(pitchDeg: number | null) {
  if (pitchDeg === null || pitchDeg <= 0 || pitchDeg >= 89) return 1;
  return 1 / Math.cos((pitchDeg * Math.PI) / 180);
}

export function calculateMeasurementDraft(draft: MeasurementDraft) {
  const quantity = Math.max(0, draft.quantity || 0);
  const length = Math.max(0, draft.length_m ?? 0);
  const width = Math.max(0, draft.width_m ?? 0);
  const area = isAreaType(draft.item_type) ? round(length * width * quantity * pitchFactor(draft.pitch_deg)) : 0;
  const linear = isLengthType(draft.item_type) ? round(length * quantity) : 0;
  const count = isCountType(draft.item_type) ? Math.max(0, Math.round(quantity)) : 0;

  return {
    calculated_area_m2: area,
    calculated_length_m: linear,
    count_value: count
  };
}

export function aggregateMeasurementItems(items: OrderMeasurementItem[], fallbackWastePercent: number) {
  const activeItems = items.filter((item) => !item.archived_at);
  const areaGross = activeItems
    .filter((item) => item.item_type === "roof_area")
    .reduce((sum, item) => sum + Number(item.calculated_area_m2 ?? 0), 0);
  const areaDeduction = activeItems
    .filter((item) => item.item_type === "deduction_area")
    .reduce((sum, item) => sum + Number(item.calculated_area_m2 ?? 0), 0);

  const sumLength = (type: OrderMeasurementItemType) =>
    activeItems
      .filter((item) => item.item_type === type)
      .reduce((sum, item) => sum + Number(item.calculated_length_m ?? 0), 0);
  const sumCount = (type: OrderMeasurementItemType) =>
    activeItems
      .filter((item) => item.item_type === type)
      .reduce((sum, item) => sum + Number(item.count_value ?? 0), 0);

  const roofAreas = activeItems.filter((item) => item.item_type === "roof_area" && item.pitch_deg !== null);
  const averagePitch =
    roofAreas.length > 0 ? round(roofAreas.reduce((sum, item) => sum + Number(item.pitch_deg ?? 0), 0) / roofAreas.length) : null;

  return {
    length_m: null,
    width_m: null,
    area_m2: Math.max(0, round(areaGross - areaDeduction)),
    roof_pitch: averagePitch,
    eaves_length_m: round(sumLength("eaves_length")),
    ridge_length_m: round(sumLength("ridge_length")),
    verge_length_m: round(sumLength("verge_length")),
    valley_length_m: round(sumLength("valley_length")),
    wall_connection_length_m: round(sumLength("wall_connection_length")),
    building_height_m: null,
    downpipe_length_m: round(sumLength("downpipe_length")),
    roof_windows_count: sumCount("roof_window"),
    penetrations_count: sumCount("penetration"),
    roof_drains_count: sumCount("roof_drain"),
    emergency_overflows_count: sumCount("emergency_overflow"),
    waste_percent: fallbackWastePercent
  };
}
