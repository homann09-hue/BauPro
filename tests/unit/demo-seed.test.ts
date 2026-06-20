import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const seed = fs.readFileSync(path.join(root, "scripts/seed-demo-company.mjs"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

describe("Demo seed", () => {
  it("creates a complete fake roofing company for sales and QA", () => {
    expect(seed).toContain("Müller Dachtechnik GmbH");
    expect(seed).toContain("chef@");
    expect(seed).toContain("role: \"vorarbeiter\"");
    expect(seed).toContain("role: \"mitarbeiter\"");
    expect(seed).toContain("customers");
    expect(seed).toContain("jobsites");
    expect(seed).toContain("vehicles");
    expect(seed).toContain("planning_resources");
    expect(seed).toContain("planning_assignments");
    expect(seed).toContain("inventory_items");
    expect(seed).toContain("orders");
    expect(seed).toContain("work_orders");
    expect(seed).toContain("material_usage_reports");
  });

  it("uses fake demo identities and documents the login", () => {
    expect(seed).toContain("mueller-dachtechnik.example");
    expect(seed).not.toMatch(/\b[a-z0-9._%+-]+@(gmail|web|gmx|t-online|icloud|outlook|hotmail)\./i);
    expect(readme).toContain("chef@mueller-dachtechnik.example");
    expect(readme).toContain("BauProDemo!2026");
  });

  it("contains realistic error cases for active QA runs", () => {
    expect(seed).toContain("Demo-Konflikt: Max ist am gleichen Tag doppelt verplant.");
    expect(seed).toContain("Demo-Konflikt: Geraet ist defekt und trotzdem eingeplant.");
    expect(seed).toContain("Konterlatten reichen fuer Baustelle Schmidt voraussichtlich nicht aus.");
    expect(seed).toContain("material_usage_reports");
    expect(seed).toContain("wartet auf Bestaetigung");
  });
});
