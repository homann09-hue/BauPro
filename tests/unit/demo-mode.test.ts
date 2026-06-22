import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prefetchRoutesForRole } from "@/lib/performance/prefetch";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("Demo-Modus", () => {
  it("offers a public no-input demo entry from login and /demo", () => {
    const loginPage = source("app/(auth)/login/page.tsx");
    const demoPage = source("app/(auth)/demo/page.tsx");

    expect(loginPage).toContain("startDemoModeAction");
    expect(loginPage).toContain("Demo-Modus starten");
    expect(demoPage).toContain("BauPro ohne Eingabe testen");
    expect(demoPage).toContain("Demo in 2 Minuten starten");
    expect(demoPage).toContain('name="return_to" value="/demo"');
  });

  it("guards demo creation server-side and uses only fake demo identities", () => {
    const demoMode = source("lib/demo/demo-mode.ts");

    expect(demoMode).toContain("DEMO_MODE_ENABLED");
    expect(demoMode).toContain("process.env.NODE_ENV !== \"production\"");
    expect(demoMode).toContain("createSupabaseAdminClient");
    expect(demoMode).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(demoMode).toContain("example.invalid");
    expect(demoMode).toContain("ensureDemoModeData");
  });

  it("starts the demo by seeding data, signing in and opening the two-minute tour", () => {
    const authActions = source("lib/actions/auth-actions.ts");

    expect(authActions).toContain("ensureDemoModeData");
    expect(authActions).toContain("signInWithPassword");
    expect(authActions).toContain('redirect("/demo-tour?success=');
    expect(authActions).toContain("demoStartRateLimitKey");
    expect(authActions).toContain('process.env.NODE_ENV === "production"');
    expect(authActions).toContain("assertRateLimit(demoStartRateLimitKey");
    expect(authActions).toContain("Demo wurde zu oft gestartet");
    expect(authActions).not.toContain("Demo-Rate-Limit wurde fuer diesen Start uebersprungen");
  });

  it("keeps the tour reachable and prefetched for managers", () => {
    const appShell = source("components/app-shell.tsx");
    const tourPage = source("app/(app)/demo-tour/page.tsx");

    expect(appShell).toContain('/demo-tour", label: "Demo-Tour"');
    expect(prefetchRoutesForRole("chef", true)).toContain("/demo-tour");
    expect(tourPage).toContain("Zeige zuerst Nutzen, nicht Menues.");
    expect(tourPage).toContain("Vorbereitete Daten");
  });
});
