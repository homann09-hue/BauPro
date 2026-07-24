import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("redteam pipeline", () => {
  const categories = [
    "security",
    "auth",
    "roles",
    "multi-tenant",
    "api",
    "rls",
    "files",
    "photos",
    "pdf",
    "nfc",
    "offline",
    "pwa",
    "voice",
    "inventory",
    "time",
    "billing",
    "load",
    "chaos",
    "release"
  ];

  it("stellt den Master-Befehl und alle Redteam-Kategorien als npm scripts bereit", () => {
    const packageJson = JSON.parse(source("package.json")) as { scripts: Record<string, string> };

    expect(packageJson.scripts["redteam:full"]).toBe("node scripts/redteam/run-redteam.mjs full");
    for (const category of categories) {
      expect(packageJson.scripts[`redteam:${category}`]).toBe(`node scripts/redteam/run-redteam.mjs ${category}`);
    }
  });

  it("laeuft im Master in der dokumentierten Reihenfolge", () => {
    const runner = source("scripts/redteam/run-redteam.mjs");
    const orderStart = runner.indexOf("const orderedProfiles");
    expect(orderStart).toBeGreaterThan(-1);

    let previousIndex = orderStart;
    for (const category of categories) {
      const nextIndex = runner.indexOf(`"${category}"`, previousIndex);
      expect(nextIndex, category).toBeGreaterThan(previousIndex);
      previousIndex = nextIndex;
    }
  });

  it("verankert Redteam im Security-/Release-Gate und in der Dokumentation", () => {
    const qaRunner = source("scripts/qa/run-check.mjs");
    const readme = source("README.md");
    const docs = source("docs/REDTEAM_HARDENING.md");

    expect(qaRunner).toContain('npmScript("redteam:release")');
    expect(readme).toContain("npm run redteam:full");
    expect(docs).toContain("Redteam-Härtung");
    expect(docs).toContain("LOAD_TEST_ACKNOWLEDGE_2000_USERS=1");
    expect(docs).toContain("REDTEAM_LIVE_CHAOS=1");
  });

  it("haelt destructive Live-Last- und Chaos-Probes opt-in", () => {
    const runner = source("scripts/redteam/run-redteam.mjs");
    const loadRunner = source("scripts/run-k6-load-test.mjs");

    expect(runner).toContain("REDTEAM_LIVE_CHAOS");
    expect(runner).toContain("test:load:check");
    expect(runner).not.toContain("test:stress");
    expect(loadRunner).toContain("LOAD_TEST_ENVIRONMENT=local|test|staging");
    expect(loadRunner).toContain("LOAD_TEST_ACKNOWLEDGE_2000_USERS=1");
    expect(loadRunner).toContain("bau-pro.vercel.app");
  });
});
