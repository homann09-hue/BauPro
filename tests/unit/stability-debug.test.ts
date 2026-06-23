import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("stability and debug hardening", () => {
  it("stellt zentrale Error-Boundaries mit Retry bereit", () => {
    expect(source("app/error.tsx")).toContain("Erneut laden");
    expect(source("app/(app)/error.tsx")).toContain("Daten konnten nicht geladen werden");
    expect(source("components/message-box.tsx")).toContain("Erneut laden");
  });

  it("stellt eine geschuetzte System-Debug-Seite ohne Secrets bereit", () => {
    const page = source("app/(app)/debug/system/page.tsx");

    expect(page).toContain("requireManager");
    expect(page).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(page).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(page).toContain("importantTables");
    expect(page).toContain("companies");
    expect(page).toContain("profiles");
    expect(page).toContain("customers");
    expect(page).toContain("jobsites");
    expect(page).toContain("orders");
    expect(page).toContain("inventory_items");
    expect(page).toContain("time_entries");
    expect(page).toContain("reports");
    expect(page).not.toContain("process.env.SUPABASE_SERVICE_ROLE_KEY}");
  });

  it("laesst Debug auch bei nicht abgeschlossenem Onboarding zu", () => {
    const layout = source("app/(app)/layout.tsx");

    expect(layout).toContain("isDebugRoute");
    expect(layout).toContain("!isDebugRoute");
  });

  it("faengt fehlende optionale Company-Spalten ohne Redirect-Schleife ab", () => {
    const auth = source("lib/auth.ts");

    expect(auth).toContain("companyExtendedFieldsAvailable");
    expect(auth).toContain("1970-01-01T00:00:00.000Z");
    expect(auth).toContain("Redirect-Schleife");
  });

  it("zeigt Supabase-Query-Fehler in Kernlisten sichtbar an", () => {
    for (const file of [
      "app/(app)/customers/page.tsx",
      "app/(app)/baustellen/page.tsx",
      "app/(app)/orders/page.tsx",
      "app/(app)/orders/new/page.tsx",
      "app/(app)/materials/inventory/page.tsx",
      "app/(app)/time-tracking/page.tsx",
      "app/(app)/time-tracking/new/page.tsx",
      "app/(app)/berichte/page.tsx",
      "app/(app)/team/page.tsx"
    ]) {
      expect(source(file), file).toContain("safeQueryErrorMessage");
    }
  });

  it("enthaelt keinen alten synchronen assertRateLimit-Pfad", () => {
    const rateLimit = source("lib/security/rate-limit.ts");

    expect(rateLimit).toContain("export async function checkRateLimit");
    expect(rateLimit).not.toContain("assertRateLimit");
    expect(rateLimit).not.toContain("SharedArrayBuffer");
    expect(rateLimit).not.toContain("Atomics");
    expect(rateLimit).not.toContain("eval(");
  });
});
