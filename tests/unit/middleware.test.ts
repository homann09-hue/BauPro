import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadMiddleware() {
  vi.resetModules();
  const updateSession = vi.fn(async (_request: NextRequest, requestHeaders: Headers) => {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("x-session-refreshed", "true");
    return response;
  });

  vi.doMock("@/lib/supabase/middleware", () => ({ updateSession }));

  const mod = await import("@/proxy");
  return { proxy: mod.proxy, config: mod.config, updateSession };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("production middleware", () => {
  it("blockiert Cross-Origin POST mit Security Headers", async () => {
    const { proxy, updateSession } = await loadMiddleware();
    const request = new NextRequest("https://baupro.example/demo", {
      method: "POST",
      headers: {
        origin: "https://evil.example"
      }
    });

    const response = await proxy(request);

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Anfrage abgelehnt.");
    expect(response.headers.get("content-security-policy")).toContain("script-src 'self' 'nonce-");
    expect(response.headers.get("x-nonce")).toBeTruthy();
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("laesst oeffentliche GET-Seiten durch und refreshed die Supabase Session", async () => {
    const { proxy, updateSession } = await loadMiddleware();

    for (const route of ["/", "/login", "/demo", "/features", "/use-cases", "/security", "/pricing", "/about"]) {
      const request = new NextRequest(`https://baupro.example${route}`, { method: "GET" });
      const response = await proxy(request);

      expect(response.status, route).toBe(200);
      expect(response.headers.get("x-session-refreshed"), route).toBe("true");
      expect(response.headers.get("content-security-policy"), route).toContain("frame-ancestors 'none'");
      expect(response.headers.get("x-nonce"), route).toBeTruthy();
    }

    expect(updateSession).toHaveBeenCalledTimes(8);
  });

  it("nimmt statische Assets aus dem Middleware-Matcher aus", async () => {
    const { config } = await loadMiddleware();
    const matcher = config.matcher[0];

    expect(matcher).toContain("_next/static");
    expect(matcher).toContain("_next/image");
    expect(matcher).toContain("favicon.ico");
    expect(matcher).toContain("png");
    expect(matcher).toContain("webp");
  });
});
