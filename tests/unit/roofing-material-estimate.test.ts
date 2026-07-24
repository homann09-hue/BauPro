import { describe, expect, it } from "vitest";
import { calculateRoofingMaterialEstimate } from "@/lib/roofing-material-estimate";

const inventory = [
  { id: "tile", name: "Tonziegel Doppelmulde naturrot", unit: "Stueck", stock: 1200, purchase_price: 1.2, sales_price: 1.9, inventory_locations: { name: "Hauptlager" } },
  { id: "batten", name: "Dachlatte 30 x 50 mm S10", unit: "m", stock: 800, purchase_price: 0.72, sales_price: 1.1, inventory_locations: { name: "Hauptlager" } },
  { id: "counter", name: "Konterlatte 30 x 50 mm", unit: "m", stock: 500, purchase_price: 0.64, sales_price: 1.05, inventory_locations: { name: "Hauptlager" } },
  { id: "underlay", name: "Unterspannbahn diffusionsoffen", unit: "m2", stock: 220, purchase_price: 1.85, sales_price: 3.1, inventory_locations: { name: "Hauptlager" } },
  { id: "fasteners", name: "Dachdecker-Schrauben und Naegel gemischt", unit: "Stueck", stock: 2000, purchase_price: 0.08, sales_price: 0.14, inventory_locations: { name: "Fahrzeug 1" } },
  { id: "ridge", name: "Firstziegel passend naturrot", unit: "Stueck", stock: 80, purchase_price: 3.2, sales_price: 5.5, inventory_locations: { name: "Hauptlager" } },
  { id: "verge", name: "Ortgangziegel links passend", unit: "Stueck", stock: 60, purchase_price: 4.8, sales_price: 7.5, inventory_locations: { name: "Hauptlager" } }
];

describe("roofing material estimate", () => {
  it("berechnet typische Steildach-Materialien inklusive Verschnitt", () => {
    const estimate = calculateRoofingMaterialEstimate(
      {
        areaM2: 100,
        roofPitch: 35,
        tileType: "tonziegel_doppelmulde",
        eavesLengthM: 18,
        ridgeLengthM: 10,
        vergeLengthM: 14,
        valleyLengthM: 0,
        hipLengthM: 5,
        wastePercent: 15
      },
      inventory
    );

    expect(estimate.items.find((item) => item.key === "roof_tiles")?.totalQuantity).toBe(1208);
    expect(estimate.items.find((item) => item.key === "roof_battens")?.totalQuantity).toBe(359.38);
    expect(estimate.items.find((item) => item.key === "underlay")?.totalQuantity).toBe(115);
    expect(estimate.items.find((item) => item.key === "ridge_tiles")?.totalQuantity).toBe(42);
    expect(estimate.items.find((item) => item.key === "verge_tiles")?.totalQuantity).toBe(49);
    expect(estimate.purchaseTotal).toBeGreaterThan(0);
    expect(estimate.items.map((item) => item.key)).toContain("small_parts");
  });

  it("zeigt Warnungen, wenn passende Preise fehlen", () => {
    const estimate = calculateRoofingMaterialEstimate(
      {
        areaM2: 25,
        roofPitch: 20,
        tileType: "betondachstein",
        eavesLengthM: 0,
        ridgeLengthM: 0,
        vergeLengthM: 0,
        valleyLengthM: 0,
        hipLengthM: 0,
        wastePercent: 10
      },
      [{ id: "tile", name: "Betondachstein grau", unit: "Stueck", stock: 200, purchase_price: null, sales_price: null }]
    );

    expect(estimate.items.find((item) => item.key === "roof_tiles")?.warning).toBe("EK-Preis fehlt fuer Betondachstein grau.");
    expect(estimate.purchaseTotal).toBe(0);
  });
});
