import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("public endpoint hardening", () => {
  it("rate-limits login attempts by email and by client IP on both login paths", () => {
    const apiLogin = source("app/api/auth/login/route.ts");
    const authActions = source("lib/actions/auth-actions.ts");

    for (const file of [apiLogin, authActions]) {
      expect(file).toContain("LOGIN_EMAIL_RATE_LIMIT");
      expect(file).toContain("LOGIN_IP_RATE_LIMIT");
      expect(file).toContain("checkRateLimit(`login:");
      expect(file).toContain("checkRateLimit(`login-ip:${getClientIp(");
    }
  });

  it("rate-limits the public database health endpoint before running a Supabase query", () => {
    const healthRoute = source("app/api/health/db/route.ts");

    const rateLimitIndex = healthRoute.indexOf("checkRateLimit(`health-db:${getClientIp(request.headers)}`");
    const queryIndex = healthRoute.indexOf('supabase.from("plans").select("id").limit(1)');

    expect(rateLimitIndex).toBeGreaterThanOrEqual(0);
    expect(queryIndex).toBeGreaterThan(rateLimitIndex);
    expect(healthRoute).toContain("Health-Check wurde gedrosselt.");
    expect(healthRoute).toContain("Health-Check ist aktuell nicht verfügbar.");
    expect(healthRoute).not.toContain("safeErrorMessage(error");
  });
});
