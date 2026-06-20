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

    expect(authActions).toContain('redirect("/onboarding")');
    expect(authActions).toContain("onboarding_completed_at");
  });

  it("keeps onboarding visible for chef/admin without exposing it to employee navigation", () => {
    const appShell = source("components/app-shell.tsx");
    const navLink = source("components/nav-link.tsx");

    expect(appShell).toContain('/onboarding", label: "Startassistent"');
    expect(appShell).toContain("managerQuickLinks");
    expect(navLink).toContain("onboarding: Sparkles");
    expect(prefetchRoutesForRole("chef", true)).toContain("/onboarding");
    expect(prefetchRoutesForRole("mitarbeiter", false)).not.toContain("/onboarding");
  });

  it("offers company setup, employee import, jobsite import and demo data on one page", () => {
    const page = source("app/(app)/onboarding/page.tsx");

    expect(page).toContain("5-Minuten-Setup");
    expect(page).toContain("updateOnboardingCompanyAction");
    expect(page).toContain("importOnboardingEmployeesAction");
    expect(page).toContain("importOnboardingJobsitesAction");
    expect(page).toContain("createOnboardingDemoDataAction");
    expect(page).toContain("completeOnboardingAction");
  });

  it("stores onboarding data server-side and never trusts client supplied company ids", () => {
    const actions = source("lib/actions/onboarding-actions.ts");

    expect(actions).toContain("requireManager()");
    expect(actions).toContain("context.companyId");
    expect(actions).not.toContain('formData.get("company_id")');
    expect(actions).toContain("checkUserLimit");
    expect(actions).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
