import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const config = fs.readFileSync(path.join(process.cwd(), "next.config.mjs"), "utf8");
const middleware = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8");

describe("security headers", () => {
  it("keeps production browser hardening headers enabled", () => {
    const securitySource = `${config}\n${middleware}`;

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
  });

  it("uses per-request script nonces instead of unsafe script execution", () => {
    expect(middleware).toContain("crypto.randomUUID()");
    expect(middleware).toContain("nonce-${nonce}");
    expect(middleware).toContain('process.env.NODE_ENV === "development"');
    expect(middleware).toContain("unsafe-eval verboten");
    expect(middleware).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});
