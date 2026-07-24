export type OrderCostEstimateInput = {
  areaM2: number;
  materialCostPerM2: number;
  materialManualTotalNet: number;
  laborHours: number;
  laborEmployeeCount: number;
  internalLaborRateNet: number;
  laborRateNet: number;
  travelKm: number;
  travelTripCount: number;
  travelRatePerKm: number;
  travelFlatRate: number;
  machineExtraTotalNet: number;
  vatRate: number;
};

export type OrderCostEstimateResult = {
  materialTotalNet: number;
  laborPersonHours: number;
  laborInternalTotalNet: number;
  laborSalesTotalNet: number;
  laborMarginTotal: number;
  laborTotalNet: number;
  travelBillableKm: number;
  travelTotalNet: number;
  machineExtraTotalNet: number;
  subtotalNet: number;
  vatRate: number;
  vatTotal: number;
  totalGross: number;
};

function safeNumber(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateOrderCostEstimate(input: OrderCostEstimateInput): OrderCostEstimateResult {
  const areaM2 = safeNumber(input.areaM2);
  const materialCostPerM2 = safeNumber(input.materialCostPerM2);
  const materialManualTotalNet = safeNumber(input.materialManualTotalNet);
  const materialAutoTotal = roundMoney(areaM2 * materialCostPerM2);
  const materialTotalNet = roundMoney(materialManualTotalNet > 0 ? materialManualTotalNet : materialAutoTotal);
  const laborEmployeeCount = Math.max(1, Math.round(safeNumber(input.laborEmployeeCount) || 1));
  const laborPersonHours = roundMoney(safeNumber(input.laborHours) * laborEmployeeCount);
  const laborInternalTotalNet = roundMoney(laborPersonHours * safeNumber(input.internalLaborRateNet));
  const laborSalesTotalNet = roundMoney(laborPersonHours * safeNumber(input.laborRateNet));
  const laborMarginTotal = roundMoney(laborSalesTotalNet - laborInternalTotalNet);
  const laborTotalNet = laborSalesTotalNet;
  const travelTripCount = Math.max(1, Math.round(safeNumber(input.travelTripCount) || 1));
  const travelBillableKm = roundMoney(safeNumber(input.travelKm) * 2 * travelTripCount);
  const travelTotalNet = roundMoney(safeNumber(input.travelFlatRate) + travelBillableKm * safeNumber(input.travelRatePerKm));
  const machineExtraTotalNet = roundMoney(safeNumber(input.machineExtraTotalNet));
  const subtotalNet = roundMoney(materialTotalNet + laborTotalNet + travelTotalNet + machineExtraTotalNet);
  const vatRate = safeNumber(input.vatRate);
  const vatTotal = roundMoney(subtotalNet * (vatRate / 100));

  return {
    materialTotalNet,
    laborPersonHours,
    laborInternalTotalNet,
    laborSalesTotalNet,
    laborMarginTotal,
    laborTotalNet,
    travelBillableKm,
    travelTotalNet,
    machineExtraTotalNet,
    subtotalNet,
    vatRate,
    vatTotal,
    totalGross: roundMoney(subtotalNet + vatTotal)
  };
}

export function orderCostEstimateSummary(input: OrderCostEstimateInput, result: OrderCostEstimateResult) {
  return {
    manual_direct_calculation: 1,
    area_m2: roundMoney(safeNumber(input.areaM2)),
    material_cost_per_m2: roundMoney(safeNumber(input.materialCostPerM2)),
    material_manual_total_net: roundMoney(safeNumber(input.materialManualTotalNet)),
    material_total_net: result.materialTotalNet,
    labor_hours_estimated: roundMoney(safeNumber(input.laborHours)),
    labor_employee_count: Math.max(1, Math.round(safeNumber(input.laborEmployeeCount) || 1)),
    labor_person_hours: result.laborPersonHours,
    internal_labor_rate_net: roundMoney(safeNumber(input.internalLaborRateNet)),
    labor_internal_total_net: result.laborInternalTotalNet,
    labor_rate_net: roundMoney(safeNumber(input.laborRateNet)),
    labor_sales_total_net: result.laborSalesTotalNet,
    labor_margin_total: result.laborMarginTotal,
    labor_total_net: result.laborTotalNet,
    travel_km: roundMoney(safeNumber(input.travelKm)),
    travel_round_trip_multiplier: 2,
    travel_trip_count: Math.max(1, Math.round(safeNumber(input.travelTripCount) || 1)),
    travel_billable_km: result.travelBillableKm,
    travel_rate_per_km: roundMoney(safeNumber(input.travelRatePerKm)),
    travel_flat_rate: roundMoney(safeNumber(input.travelFlatRate)),
    travel_total_net: result.travelTotalNet,
    machine_extra_total_net: result.machineExtraTotalNet,
    vat_rate: result.vatRate,
    vat_total: result.vatTotal,
    subtotal_net: result.subtotalNet,
    total_gross: result.totalGross
  };
}
