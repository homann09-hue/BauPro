import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("Last- und Stresstest-Quality-Gate", () => {
  it("stellt npm-Scripts fuer E2E, Load, Stress und Gesamt-Gate bereit", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

    expect(pkg.scripts["test:e2e"]).toContain("playwright test");
    expect(pkg.scripts["test:load:check"]).toContain("--validate-config");
    expect(pkg.scripts["test:load"]).toContain("run-k6-load-test.mjs --profile load");
    expect(pkg.scripts["test:stress"]).toContain("run-k6-load-test.mjs --profile stress");
    expect(pkg.scripts["test:all"]).toContain("npm run lint");
    expect(pkg.scripts["test:all"]).toContain("npm run db:schema-check");
    expect(pkg.scripts["test:all"]).toContain("npm run test:e2e");
  });

  it("blockiert bekannte Production-Ziele und verlangt bewusste Stress-Test-Bestaetigung", () => {
    const runner = read("scripts/run-k6-load-test.mjs");
    const k6Script = read("tests/load/baupro-2000-users.k6.js");

    expect(runner).toContain("bau-pro.vercel.app");
    expect(runner).toContain("LOAD_TEST_ENVIRONMENT=local|test|staging");
    expect(runner).toContain("LOAD_ALLOW_REMOTE_TARGET=1");
    expect(runner).toContain("LOAD_TEST_ACKNOWLEDGE_2000_USERS=1");
    expect(k6Script).toContain("LOAD_TEST_ENVIRONMENT");
    expect(k6Script).toContain("2.000-User-Stresstest");
    expect(k6Script).toContain("Bekannte Production-Domain");
  });

  it("simuliert Rollenmix, Auth, geschuetzte Seiten, Exporte und Preis-Schutz", () => {
    const k6Script = read("tests/load/baupro-2000-users.k6.js");

    expect(k6Script).toContain("POST /api/auth/login");
    expect(k6Script).toContain("GET /dashboard");
    expect(k6Script).toContain("GET /baustellen");
    expect(k6Script).toContain("GET /orders");
    expect(k6Script).toContain("GET /materials/inventory");
    expect(k6Script).toContain("GET /berichte");
    expect(k6Script).toContain("GET /api/calendar/events");
    expect(k6Script).toContain("GET /invoices/:id/pdf");
    expect(k6Script).toContain("operative Rollen sehen keine Preisfelder");
    expect(k6Script).toContain("ungueltiges Portal leakt keine Daten");
  });

  it("dokumentiert Start, ENV-Variablen und Ergebnisbericht", () => {
    const docs = read("docs/LOAD_AND_E2E_TESTING.md");

    expect(docs).toContain("2.000-User-Stresstest");
    expect(docs).toContain("LOAD_BASE_URL");
    expect(docs).toContain("LOAD_TEST_ENVIRONMENT");
    expect(docs).toContain("LOAD_USERS_FILE");
    expect(docs).toContain("test-results/load");
    expect(docs).toContain("Ergebnisbericht");
  });

  it("haengt den Load-Konfigurationscheck in CI ein", () => {
    const workflow = read(".github/workflows/ci.yml");
    const packageJson = read("package.json");
    const runner = read("scripts/qa/run-check.mjs");

    expect(workflow).toContain("npm run check:ci");
    expect(packageJson).toContain('"check:ci"');
    expect(runner).toContain('npmScript("test:load:check")');
  });
});
