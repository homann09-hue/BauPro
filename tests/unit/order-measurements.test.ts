import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { aggregateMeasurementItems, calculateMeasurementDraft } from "@/lib/order-measurements";
import type { OrderMeasurementItem } from "@/types/app";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function measurementItem(overrides: Partial<OrderMeasurementItem>): OrderMeasurementItem {
  return {
    id: "item-1",
    company_id: "company-1",
    order_id: "order-1",
    item_type: "roof_area",
    label: "Test",
    length_m: null,
    width_m: null,
    quantity: 1,
    pitch_deg: null,
    calculated_area_m2: 0,
    calculated_length_m: 0,
    count_value: 0,
    notes: null,
    created_by: null,
    archived_at: null,
    created_at: "2026-06-18T08:00:00.000Z",
    updated_at: "2026-06-18T08:00:00.000Z",
    ...overrides
  };
}

describe("order measurement items", () => {
  it("calculates area, linear meters and counts from practical roof measurement drafts", () => {
    expect(
      calculateMeasurementDraft({
        item_type: "roof_area",
        label: "Hauptdach",
        length_m: 10,
        width_m: 8,
        quantity: 1,
        pitch_deg: 30,
        notes: null
      }).calculated_area_m2
    ).toBeGreaterThan(80);

    expect(
      calculateMeasurementDraft({
        item_type: "ridge_length",
        label: "First",
        length_m: 12,
        width_m: null,
        quantity: 2,
        pitch_deg: null,
        notes: null
      }).calculated_length_m
    ).toBe(24);

    expect(
      calculateMeasurementDraft({
        item_type: "roof_window",
        label: "Dachfenster",
        length_m: null,
        width_m: null,
        quantity: 3.4,
        pitch_deg: null,
        notes: null
      }).count_value
    ).toBe(3);
  });

  it("aggregates gross roof areas, deductions, linear measurements and counts for material rules", () => {
    const summary = aggregateMeasurementItems(
      [
        measurementItem({ item_type: "roof_area", calculated_area_m2: 120, pitch_deg: 35 }),
        measurementItem({ id: "item-2", item_type: "deduction_area", calculated_area_m2: 8 }),
        measurementItem({ id: "item-3", item_type: "eaves_length", calculated_length_m: 18 }),
        measurementItem({ id: "item-4", item_type: "ridge_length", calculated_length_m: 11 }),
        measurementItem({ id: "item-5", item_type: "penetration", count_value: 2 })
      ],
      20
    );

    expect(summary.area_m2).toBe(112);
    expect(summary.eaves_length_m).toBe(18);
    expect(summary.ridge_length_m).toBe(11);
    expect(summary.penetrations_count).toBe(2);
    expect(summary.waste_percent).toBe(20);
  });

  it("wires the order detail page and server actions without hard-deleting measurement data", () => {
    const page = source("app/(app)/orders/[id]/page.tsx");
    const actions = source("lib/actions/order-actions.ts");

    expect(page).toContain("MeasurementItemsPanel");
    expect(page).toContain("Praxis-Aufmaß");
    expect(actions).toContain("createOrderMeasurementItemAction");
    expect(actions).toContain("archiveOrderMeasurementItemAction");
    expect(actions).toContain(".from(\"order_measurement_items\")");
    expect(actions).not.toMatch(/from\("order_measurement_items"\)[\s\S]{0,220}\.delete\(/);
  });

  it("keeps measurement items manager-only and protected by forced RLS", () => {
    const migration = source("supabase/migrations/20260623_roof_measurements.sql");
    const schema = source("supabase/schema.sql");

    expect(migration).toContain("alter table public.order_measurement_items force row level security");
    expect(migration).toContain("public.can_manage_company()");
    expect(migration).toContain('drop policy if exists "redteam managers delete fallback"');
    expect(schema).toContain("create table if not exists public.order_measurement_items");
  });
});
