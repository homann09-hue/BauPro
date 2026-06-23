import { afterEach, describe, expect, it, vi } from "vitest";

type MockWindow = {
  limit: number;
  duration: string;
};

type MockRatelimitOptions = {
  redis: unknown;
  limiter: MockWindow;
  prefix: string;
};

const originalEnv = { ...process.env };

async function loadRateLimiter() {
  vi.resetModules();
  return import("@/lib/security/rate-limit");
}

function mockUpstash() {
  const hits = new Map<string, number>();
  const redisInstances: unknown[] = [];

  vi.doMock("@upstash/redis", () => ({
    Redis: class MockRedis {
      readonly config: unknown;

      constructor(config: unknown) {
        this.config = config;
        redisInstances.push(config);
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

  return { redisInstances };
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("Redis rate limiter", () => {
  it("loest nach N Calls aus und initialisiert Redis nur lazy einmal", async () => {
    const { redisInstances } = mockUpstash();
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    const { checkRateLimit } = await loadRateLimiter();

    await checkRateLimit("login:user@example.test", 2, 60_000);
    await checkRateLimit("login:user@example.test", 2, 60_000);

    await expect(checkRateLimit("login:user@example.test", 2, 60_000)).rejects.toThrow("Zu viele Anfragen");
    expect(redisInstances).toHaveLength(1);
  });

  it("isoliert verschiedene Keys voneinander", async () => {
    mockUpstash();
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    const { checkRateLimit } = await loadRateLimiter();

    await checkRateLimit("ai:company-a", 1, 60_000);
    await checkRateLimit("ai:company-b", 1, 60_000);

    await expect(checkRateLimit("ai:company-a", 1, 60_000)).rejects.toThrow("Zu viele Anfragen");
    await expect(checkRateLimit("ai:company-b", 1, 60_000)).rejects.toThrow("Zu viele Anfragen");
  });

  it("akzeptiert Vercel-KV Env-Aliasse fuer Redis", async () => {
    const { redisInstances } = mockUpstash();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.KV_REST_API_URL = "https://kv.example.test";
    process.env.KV_REST_API_TOKEN = "kv-token";

    const { checkRateLimit } = await loadRateLimiter();

    await checkRateLimit("kv-alias", 1, 60_000);

    expect(redisInstances).toEqual([{ url: "https://kv.example.test", token: "kv-token" }]);
  });

  it("laesst bei fehlenden Env-Variablen in Entwicklung bewusst durch und warnt nur einmal", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.NODE_ENV = "development";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { checkRateLimit } = await loadRateLimiter();

    await expect(checkRateLimit("missing-redis", 1, 60_000)).resolves.toBeUndefined();
    await expect(checkRateLimit("missing-redis", 1, 60_000)).resolves.toBeUndefined();
    await expect(checkRateLimit("missing-redis", 1, 60_000)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("UPSTASH_REDIS_REST_URL");
    expect(warn.mock.calls[0]?.[0]).toContain("UPSTASH_REDIS_REST_TOKEN");
  });

  it("blockiert in Production hart, wenn Redis fehlt", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.NODE_ENV = "production";
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { checkRateLimit } = await loadRateLimiter();

    await expect(checkRateLimit("production-without-redis", 1, 60_000)).rejects.toThrow("Rate Limit konnte nicht geprüft werden");
  });

  it("enthaelt keinen synchronen Worker-Pfad mehr", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile("lib/security/rate-limit.ts", "utf8"));

    expect(source).not.toContain("assertRateLimit");
    expect(source).not.toContain("node:worker_threads");
    expect(source).not.toContain("SharedArrayBuffer");
    expect(source).not.toContain("Atomics.wait");
    expect(source).not.toContain("eval: true");
  });
});
