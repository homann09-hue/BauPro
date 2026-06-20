import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("order dimensions persistence", () => {
  it("keeps order dimensions editable from the order detail page", () => {
    const page = source("app/(app)/orders/[id]/page.tsx");

    expect(page).toContain("updateOrderDimensionsAction");
    expect(page).toContain("Maße speichern & Material berechnen");
    expect(page).toContain('name="length_m"');
    expect(page).toContain('name="width_m"');
    expect(page).toContain('name="area_m2"');
  });

  it("stores dimensions without relying on a unique order_id upsert and keeps material failures isolated", () => {
    const actions = source("lib/actions/order-actions.ts");

    expect(actions).toContain(".from(\"job_dimensions\")");
    expect(actions).toContain("saveOrderDimensions");
    expect(actions).not.toContain('{ onConflict: "order_id" }');
    expect(actions).toContain("Maße wurden gespeichert, aber die Materialliste konnte noch nicht berechnet werden.");
  });
});
