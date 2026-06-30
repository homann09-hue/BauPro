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
  let areaGross = 0;
  let areaDeduction = 0;
  let eavesLength = 0;
  let ridgeLength = 0;
  let vergeLength = 0;
  let valleyLength = 0;
  let wallConnectionLength = 0;
  let downpipeLength = 0;
  let roofWindowsCount = 0;
  let penetrationsCount = 0;
  let roofDrainsCount = 0;
  let emergencyOverflowsCount = 0;
  let pitchAreaSum = 0;
  let pitchWeight = 0;

  for (const item of activeItems) {
    const area = Number(item.calculated_area_m2 ?? 0);
    const length = Number(item.calculated_length_m ?? 0);
    const count = Number(item.count_value ?? 0);

    if (item.item_type === "roof_area") {
      areaGross += area;
      if (item.pitch_deg !== null && area > 0) {
        pitchAreaSum += Number(item.pitch_deg) * area;
        pitchWeight += area;
      }
      continue;
    }

    if (item.item_type === "deduction_area") {
      areaDeduction += area;
      continue;
    }

    if (item.item_type === "eaves_length") eavesLength += length;
    if (item.item_type === "ridge_length") ridgeLength += length;
    if (item.item_type === "verge_length") vergeLength += length;
    if (item.item_type === "valley_length") valleyLength += length;
    if (item.item_type === "wall_connection_length") wallConnectionLength += length;
    if (item.item_type === "downpipe_length") downpipeLength += length;
    if (item.item_type === "roof_window") roofWindowsCount += count;
    if (item.item_type === "penetration") penetrationsCount += count;
    if (item.item_type === "roof_drain") roofDrainsCount += count;
    if (item.item_type === "emergency_overflow") emergencyOverflowsCount += count;
  }

  const averagePitch = pitchWeight > 0 ? round(pitchAreaSum / pitchWeight) : null;

  return {
    length_m: null,
    width_m: null,
    area_m2: Math.max(0, round(areaGross - areaDeduction)),
    roof_pitch: averagePitch,
    eaves_length_m: round(eavesLength),
    ridge_length_m: round(ridgeLength),
    verge_length_m: round(vergeLength),
    valley_length_m: round(valleyLength),
    wall_connection_length_m: round(wallConnectionLength),
    building_height_m: null,
    downpipe_length_m: round(downpipeLength),
    roof_windows_count: roofWindowsCount,
    penetrations_count: penetrationsCount,
    roof_drains_count: roofDrainsCount,
    emergency_overflows_count: emergencyOverflowsCount,
    waste_percent: fallbackWastePercent
  };
}
