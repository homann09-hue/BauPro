import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("MFA security flow", () => {
  it("adds Supabase TOTP server actions with password-protected unenroll", () => {
    const actions = source("lib/actions/mfa-actions.ts");

    expect(actions).toContain('supabase.auth.mfa.enroll({');
    expect(actions).toContain('factorType: "totp"');
    expect(actions).toContain("QRCode.toDataURL");
    expect(actions).toContain("supabase.auth.mfa.challenge");
    expect(actions).toContain("supabase.auth.mfa.verify");
    expect(actions).toContain("verifyPasswordWithoutPersistingSession");
    expect(actions).toContain("persistSession: false");
    expect(actions).toContain("supabase.auth.mfa.unenroll");
  });

  it("routes password logins with active MFA through a second factor challenge", () => {
    const authActions = source("lib/actions/auth-actions.ts");
    const challengePage = source("app/(auth)/login/mfa-challenge/page.tsx");

    expect(authActions).toContain("getAuthenticatorAssuranceLevel");
    expect(authActions).toContain('aal.data?.nextLevel === "aal2"');
    expect(authActions).toContain('redirect("/login/mfa-challenge")');
    expect(challengePage).toContain("verifyLoginMfaChallengeAction");
    expect(challengePage).toContain('autoComplete="one-time-code"');
  });

  it("surfaces MFA status in app context, dashboard and security settings", () => {
    const auth = source("lib/auth.ts");
    const dashboard = source("app/(app)/dashboard/page.tsx");
    const settings = source("app/(app)/settings/page.tsx");
    const securityPage = source("app/(app)/settings/security/page.tsx");
    const banner = source("components/mfa-recommendation-banner.tsx");

    expect(auth).toContain("mfaEnabled: boolean");
    expect(auth).toContain("supabase.auth.mfa.listFactors");
    expect(dashboard).toContain("<MfaRecommendationBanner canManage={context.isAdmin} mfaEnabled={context.mfaEnabled} />");
    expect(settings).toContain('href="/settings/security"');
    expect(securityPage).toContain("MfaSettingsPanel");
    expect(banner).toContain("Schütze deinen Account zusätzlich");
    expect(banner).toContain("!canManage || mfaEnabled");
    expect(banner).toContain("Systemadmin-Zugänge");
  });
});
