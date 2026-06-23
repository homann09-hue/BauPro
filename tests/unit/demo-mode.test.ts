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

    expect(loginPage).toContain('action="/api/auth/demo/start"');
    expect(loginPage).toContain('method="post"');
    expect(loginPage).toContain("Demo-Modus starten");
    expect(demoPage).toContain("Demo als Chef starten");
    expect(demoPage).toContain("Baustellen, Team, Lager, Zeiten, Bautagesberichte");
    expect(demoPage).toContain('name="return_to" value="/demo"');
    expect(demoPage).toContain("Die Demo enthält ausschließlich Beispieldaten");
  });

  it("guards demo creation server-side and uses only fake demo identities", () => {
    const demoMode = source("lib/demo/demo-mode.ts");

    expect(demoMode).toContain("DEMO_MODE_ENABLED");
    expect(demoMode).toContain("process.env.NODE_ENV !== \"production\"");
    expect(demoMode).toContain("createSupabaseAdminClient");
    expect(demoMode).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(demoMode).toContain("example.invalid");
    expect(demoMode).toContain("ensureDemoModeData");
    expect(demoMode).toContain("DEMO_RESEED_ON_START");
    expect(demoMode).toContain("if (!shouldReseedDemoDataOnStart()) return;");
    expect(demoMode).toContain("hasPreparedDemoData");
    expect(demoMode).toContain("forceUserSync");
  });

  it("starts the demo by seeding data, signing in and opening the two-minute tour", () => {
    const demoStartRoute = source("app/api/auth/demo/start/route.ts");

    expect(demoStartRoute).toContain("ensureDemoModeData");
    expect(demoStartRoute).toContain("signInWithPassword");
    expect(demoStartRoute).toContain("/demo-tour?success=");
    expect(demoStartRoute).toContain("demoStartRateLimitKey");
    expect(demoStartRoute).toContain('process.env.NODE_ENV === "production"');
    expect(demoStartRoute).toContain("await checkRateLimit(demoStartRateLimitKey");
    expect(demoStartRoute).toContain("Demo wurde zu oft gestartet");
    expect(demoStartRoute).toContain('message.includes("Zu viele Anfragen")');
    expect(demoStartRoute).toContain("demo-route-rate-limit-fallback");
    expect(demoStartRoute).toContain("signInDemoUser");
    expect(demoStartRoute).toContain("forceUserSync: true");
    expect(demoStartRoute).toContain("redirectWithCookies");

    const demoSeed = source("lib/demo/demo-mode.ts");
    expect(demoSeed).toContain("DEMO_CUSTOMER_PORTAL_TOKEN");
    expect(demoSeed).toContain("customer_portal_tokens");
    expect(demoSeed).toContain("customer_portal_messages");
    expect(demoSeed).toContain("Arbeitsauftrag: Steildachsanierung Schmidt");
    expect(demoSeed).toContain("visible_to_customer: true");
    expect(demoSeed).toContain("customer_summary");
  });

  it("keeps the tour reachable and prefetched for managers", () => {
    const appShell = source("components/app-shell.tsx");
    const tourPage = source("app/(app)/demo-tour/page.tsx");

    expect(appShell).toContain('/demo-tour", label: "Demo-Tour"');
    expect(prefetchRoutesForRole("chef", true)).toContain("/demo-tour");
    expect(tourPage).toContain("Zeige zuerst Nutzen, nicht Menues.");
    expect(tourPage).toContain("Kundenportal zeigen");
    expect(tourPage).toContain("DEMO_CUSTOMER_PORTAL_TOKEN");
    expect(tourPage).toContain("Vorbereitete Daten");
  });
});
