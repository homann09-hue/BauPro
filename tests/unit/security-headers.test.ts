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
  });

  it("uses per-request script nonces instead of unsafe script execution", () => {
    expect(proxy).toContain("randomBytes(16)");
    expect(proxy).toContain("nonce-${nonce}");
    expect(proxy).not.toContain("scriptSources.push");
    expect(proxy).not.toContain("\"'unsafe-eval'\"");
    expect(proxy).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});
