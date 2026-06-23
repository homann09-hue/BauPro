import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const config = fs.readFileSync(path.join(process.cwd(), "next.config.mjs"), "utf8");
const proxy = fs.readFileSync(path.join(process.cwd(), "proxy.ts"), "utf8");

describe("security headers", () => {
  it("keeps production browser hardening headers enabled", () => {
    const securitySource = `${config}\n${proxy}`;

    for (const required of [
      "Content-Security-Policy",
      "frame-ancestors 'none'",
      "X-Frame-Options",
      "DENY",
      "X-Content-Type-Options",
      "nosniff",
      "Referrer-Policy",
      "Permissions-Policy",
      "Strict-Transport-Security",
      "Cross-Origin-Opener-Policy",
      "X-DNS-Prefetch-Control",
      "X-Permitted-Cross-Domain-Policies"
    ]) {
      expect(securitySource).toContain(required);
    }

    expect(config).toContain('camera=(self)');
    expect(config).not.toContain('camera=()');
  });

  it("uses per-request script nonces instead of unsafe script execution", () => {
    expect(proxy).toContain("crypto.randomUUID()");
    expect(proxy).toContain("nonce-${nonce}");
    expect(proxy).toContain('process.env.NODE_ENV === "development"');
    expect(proxy).toContain("scriptSources.push(\"'unsafe-eval'\")");
    expect(proxy).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it("restores middleware session refresh and unsafe-origin protection", () => {
    expect(proxy).toContain("export async function proxy");
    expect(proxy).toContain("await updateSession(request, requestHeaders)");
    expect(proxy).toContain("isUnsafeMethod(request.method)");
    expect(proxy).toContain('request.headers.get("origin")');
    expect(proxy).toContain("origin !== expectedOrigin");
    expect(proxy).toContain('new NextResponse("Anfrage abgelehnt.", { status: 403 })');
  });
});
