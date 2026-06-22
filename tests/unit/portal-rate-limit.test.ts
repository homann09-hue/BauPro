import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getClientIp } from "@/lib/security/origin";

type MockWindow = {
  limit: number;
  duration: string;
};

type MockRatelimitOptions = {
  redis: unknown;
  limiter: MockWindow;
  prefix: string;
};

const root = path.resolve(__dirname, "../..");
const originalEnv = { ...process.env };

function read(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

async function loadRateLimiter() {
  vi.resetModules();
  return import("@/lib/security/rate-limit");
}

function mockUpstash() {
  const hits = new Map<string, number>();

  vi.doMock("@upstash/redis", () => ({
    Redis: class MockRedis {
      readonly config: unknown;

      constructor(config: unknown) {
        this.config = config;
      }
    }
  }));

  vi.doMock("@upstash/ratelimit", () => {
    class MockRatelimit {
      private readonly options: MockRatelimitOptions;

      static slidingWindow(limit: number, duration: string) {
        return { limit, duration };
      }

      constructor(options: MockRatelimitOptions) {
        this.options = options;
      }

      limit(key: string) {
        const bucketKey = `${this.options.prefix}:${this.options.limiter.limit}:${this.options.limiter.duration}:${key}`;
        const nextHits = (hits.get(bucketKey) ?? 0) + 1;
        hits.set(bucketKey, nextHits);

        return {
          success: nextHits <= this.options.limiter.limit
        };
      }
    }

    return { Ratelimit: MockRatelimit };
  });
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("portal IP rate limiting", () => {
  it("liest die echte Client-IP aus Proxy-Headern", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "203.0.113.10, 10.0.0.1", "x-real-ip": "198.51.100.2" }))).toBe("203.0.113.10");
    expect(getClientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(getClientIp(new Headers())).toBe("unknown");
  });

  it("blockiert die 31. Portal-Anfrage innerhalb einer Minute pro IP", async () => {
    mockUpstash();
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    const { checkRateLimit } = await loadRateLimiter();
    const key = `portal-view:${getClientIp(new Headers({ "x-forwarded-for": "203.0.113.10" }))}`;

    for (let index = 0; index < 30; index += 1) {
      await checkRateLimit(key, 30, 60_000);
    }

    await expect(checkRateLimit(key, 30, 60_000)).rejects.toThrow("Zu viele Anfragen");
  });

  it("limitiert verschiedene IPs unabhaengig voneinander", async () => {
    mockUpstash();
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    const { checkRateLimit } = await loadRateLimiter();

    for (let index = 0; index < 30; index += 1) {
      await checkRateLimit("portal-view:203.0.113.10", 30, 60_000);
      await checkRateLimit("portal-view:198.51.100.2", 30, 60_000);
    }

    await expect(checkRateLimit("portal-view:203.0.113.10", 30, 60_000)).rejects.toThrow("Zu viele Anfragen");
    await expect(checkRateLimit("portal-view:198.51.100.2", 30, 60_000)).rejects.toThrow("Zu viele Anfragen");
  });

  it("macht Rate-Limit und ungueltige Tokens nicht ueber unterschiedliche Portal-Antworten unterscheidbar", () => {
    const page = read("app/portal/[token]/page.tsx");
    const pdfRoute = read("app/portal/[token]/work-orders/[id]/pdf/route.ts");

    expect(page).toContain("await checkRateLimit(`portal-view:${clientIp}`, 30, 60_000)");
    expect(page).toContain("return <PortalAccessUnavailable />");
    expect(page).not.toContain("notFound()");
    expect(page.match(/return <PortalAccessUnavailable \/>/g)?.length ?? 0).toBeGreaterThanOrEqual(2);

    expect(pdfRoute).toContain("await checkRateLimit(`portal-pdf:${clientIp}`, 30, 60_000)");
    expect(pdfRoute.match(/return portalPdfUnavailableResponse\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(pdfRoute).toContain("status: 404");
    expect(pdfRoute).toContain("Portal-Datei ist nicht verfuegbar. Bitte warte einen Moment");
  });
});
