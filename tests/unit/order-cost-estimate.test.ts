import { describe, expect, it } from "vitest";
import { calculateOrderCostEstimate } from "@/lib/order-cost-estimate";

describe("order cost estimate", () => {
  it("berechnet Material, Arbeit, Fahrt, Extras, Netto, MwSt und Brutto", () => {
    const estimate = calculateOrderCostEstimate({
      areaM2: 100,
      materialCostPerM2: 30,
      materialManualTotalNet: 0,
      laborHours: 10,
      laborEmployeeCount: 2,
      internalLaborRateNet: 38,
      laborRateNet: 65,
      travelKm: 30,
      travelTripCount: 3,
      travelRatePerKm: 0.7,
      travelFlatRate: 50,
      machineExtraTotalNet: 120,
      vatRate: 19
    });

    expect(estimate.materialTotalNet).toBe(3000);
    expect(estimate.laborPersonHours).toBe(20);
    expect(estimate.laborInternalTotalNet).toBe(760);
    expect(estimate.laborSalesTotalNet).toBe(1300);
    expect(estimate.laborMarginTotal).toBe(540);
    expect(estimate.laborTotalNet).toBe(1300);
    expect(estimate.travelBillableKm).toBe(180);
    expect(estimate.travelTotalNet).toBe(176);
    expect(estimate.machineExtraTotalNet).toBe(120);
    expect(estimate.subtotalNet).toBe(4596);
    expect(estimate.vatTotal).toBe(873.24);
    expect(estimate.totalGross).toBe(5469.24);
  });

  it("nutzt eine manuelle Materialsumme als Chef-Ueberschreibung", () => {
    const estimate = calculateOrderCostEstimate({
      areaM2: 100,
      materialCostPerM2: 30,
      materialManualTotalNet: 2500,
      laborHours: 0,
      laborEmployeeCount: 1,
      internalLaborRateNet: 38,
      laborRateNet: 65,
      travelKm: 0,
      travelTripCount: 1,
      travelRatePerKm: 0,
      travelFlatRate: 0,
      machineExtraTotalNet: 0,
      vatRate: 19
    });

    expect(estimate.materialTotalNet).toBe(2500);
    expect(estimate.totalGross).toBe(2975);
  });
});
