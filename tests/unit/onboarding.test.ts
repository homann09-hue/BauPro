import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prefetchRoutesForRole } from "@/lib/performance/prefetch";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("Startassistent Onboarding", () => {
  it("routes new managers into the five-minute setup", () => {
    const authActions = source("lib/actions/auth-actions.ts");
    const appLayout = source("app/(app)/layout.tsx");

    expect(authActions).toContain('redirect("/onboarding")');
    expect(authActions).toContain("onboarding_completed_at");
    expect(appLayout).toContain("!context.company.onboarding_completed_at");
    expect(appLayout).toContain('redirect("/onboarding")');
    expect(appLayout).toContain("isOnboardingRoute");
  });

  it("keeps onboarding visible for chefs without exposing it to employee or systemadmin navigation", () => {
    const appShell = source("components/app-shell.tsx");
    const navLink = source("components/nav-link.tsx");

    expect(appShell).toContain('/onboarding", label: "Startassistent"');
    expect(appShell).toContain("chefQuickLinks");
    expect(navLink).toContain("onboarding: Sparkles");
    expect(prefetchRoutesForRole("chef", true)).toContain("/onboarding");
    expect(prefetchRoutesForRole("admin", false)).not.toContain("/onboarding");
    expect(prefetchRoutesForRole("mitarbeiter", false)).not.toContain("/onboarding");
  });

  it("offers a four-step guided wizard for new companies", () => {
    const page = source("app/(app)/onboarding/page.tsx");
    const wizard = source("components/onboarding/onboarding-wizard.tsx");

    expect(page).toContain("OnboardingWizard");
    expect(wizard).toContain("Willkommen bei BauPro");
    expect(wizard).toContain("Erste Baustelle anlegen");
    expect(wizard).toContain("Ersten Mitarbeiter einladen");
    expect(wizard).toContain("Alles bereit!");
    expect(wizard).toContain("useState");
    expect(wizard).toContain("updateCompanyProfileAction");
    expect(wizard).toContain("createJobsiteAction");
    expect(wizard).toContain("createEmployeeAction");
    expect(wizard).toContain("completeOnboardingAction");
  });

  it("stores onboarding data server-side and never trusts client supplied company ids", () => {
    const onboardingActions = source("lib/actions/onboarding-actions.ts");
    const authActions = source("lib/actions/auth-actions.ts");
    const jobsiteActions = source("lib/actions/jobsite-actions.ts");
    const migration = source("supabase/migrations/20260624_onboarding.sql");

    for (const actions of [onboardingActions, authActions, jobsiteActions]) {
      expect(actions).toContain("context.companyId");
      expect(actions).not.toContain('formData.get("company_id")');
    }

    expect(onboardingActions).toContain("requireManager()");
    expect(onboardingActions).toContain("onboarding_completed_at");
    expect(authActions).toContain("checkUserLimit");
    expect(authActions).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(migration).toContain("onboarding_completed_at timestamptz");
    expect(migration).toContain("managers can update own company");
    expect(migration).toContain("company-logos");
  });
});
