import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("chaos engineering harness", () => {
  it("stellt einen nicht-destruktiven Chaos-Test als npm script bereit", () => {
    const packageJson = JSON.parse(source("package.json")) as { scripts?: Record<string, string> };
    const chaosScript = source("scripts/chaos-test.mjs");

    expect(packageJson.scripts?.["test:chaos"]).toBe("node scripts/chaos-test.mjs");
    expect(chaosScript).toContain("BauProChaosTest/1.0");
    expect(chaosScript).toContain("AbortController");
    expect(chaosScript).toContain("requestTimeoutMs");
    expect(chaosScript).toContain("protectedRoutes");
    expect(chaosScript).toContain("apiCases");
    expect(chaosScript).not.toContain("LOAD_AUTH_EMAIL");
    expect(chaosScript).not.toContain("E2E_CHEF_PASSWORD");
  });

  it("prueft zentrale API-Fehlerpfade ohne echte Datenmutation", () => {
    const chaosScript = source("scripts/chaos-test.mjs");

    for (const route of [
      "/api/materials/inventory/activity",
      "/api/materials/inventory/jobsites",
      "/api/materials/inventory/low-stock-count?limit=999999",
      "/api/materials/inventory/suppliers",
      "/api/materials/usage-reports/confirm",
      "/api/weather/suggest",
      "/api/ai/report-draft",
      "/api/calendar/events?from=invalid&to=invalid",
      "/api/prefetch/route-data?scope=unknown"
    ]) {
      expect(chaosScript, route).toContain(route);
    }
  });

  it("material-confirm-api liefert ohne Session kontrolliert 401 statt Redirect-Exception", () => {
    const route = source("app/api/materials/usage-reports/confirm/route.ts");

    expect(route).toContain("getOptionalAppContext");
    expect(route).toContain('return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })');
    expect(route).not.toContain("requireAppContext");
  });

  it("dokumentiert sichere Grenzen fuer Chaos-Experimente", () => {
    const docs = source("docs/CHAOS_ENGINEERING.md");

    expect(docs).toContain("nicht-destruktiv");
    expect(docs).toContain("npm run test:chaos");
    expect(docs).toContain("Wartungsfenster");
    expect(docs).toContain("Rollback-Plan");
  });
});
