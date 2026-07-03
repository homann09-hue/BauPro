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

    expect(apiLogin).toContain("LOGIN_EMAIL_RATE_LIMIT");
    expect(apiLogin).toContain("LOGIN_IP_RATE_LIMIT");
    expect(apiLogin).toContain("const clientIp = getClientIp(request.headers)");
    expect(apiLogin).toContain("checkRateLimit(`login-ip:${clientIp}`, LOGIN_IP_RATE_LIMIT");
    expect(apiLogin).toContain("checkRateLimit(`login:${email}`, LOGIN_EMAIL_RATE_LIMIT");

    expect(authActions).toContain("LOGIN_EMAIL_RATE_LIMIT");
    expect(authActions).toContain("LOGIN_IP_RATE_LIMIT");
    expect(authActions).toContain("checkRateLimit(`login:");
    expect(authActions).toContain("checkRateLimit(`login-ip:${getClientIp(");
  });

  it("rate-limits login by IP before parsing public form bodies", () => {
    const apiLogin = source("app/api/auth/login/route.ts");

    const ipLimitIndex = apiLogin.indexOf("await checkRateLimit(`login-ip:${clientIp}`, LOGIN_IP_RATE_LIMIT");
    const formDataIndex = apiLogin.indexOf("await request.formData()");
    const emailLimitIndex = apiLogin.indexOf("await checkRateLimit(`login:${email}`, LOGIN_EMAIL_RATE_LIMIT");

    expect(ipLimitIndex).toBeGreaterThanOrEqual(0);
    expect(formDataIndex).toBeGreaterThan(ipLimitIndex);
    expect(emailLimitIndex).toBeGreaterThan(formDataIndex);
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

  it("uses central safe error statuses for rate-limited JSON endpoints", () => {
    for (const file of ["app/api/customer-portal/links/route.ts", "app/api/weather/suggest/route.ts"]) {
      const apiRoute = source(file);

      expect(apiRoute, file).toContain("safeErrorStatus");
      expect(apiRoute, file).not.toContain("error instanceof SafeActionError ? 400 : 500");
    }
  });

  it("marks token-bearing and public signature JSON responses as non-cacheable", () => {
    for (const file of ["app/api/customer-portal/links/route.ts", "app/api/customer-portal/work-orders/sign/route.ts"]) {
      const apiRoute = source(file);

      expect(apiRoute, file).toContain('"Cache-Control": "no-store, max-age=0"');
      expect(apiRoute, file).toContain('"X-Content-Type-Options": "nosniff"');
      expect(apiRoute, file).toContain("function json(");
      expect(apiRoute, file).not.toContain("return NextResponse.json({ success:");
    }
  });
});
