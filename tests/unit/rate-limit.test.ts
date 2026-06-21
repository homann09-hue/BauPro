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

    const { assertRateLimit } = await loadRateLimiter();

    assertRateLimit("login:user@example.test", 2, 60_000);
    assertRateLimit("login:user@example.test", 2, 60_000);

    expect(() => assertRateLimit("login:user@example.test", 2, 60_000)).toThrow("Zu viele Anfragen");
    expect(redisInstances).toHaveLength(1);
  });

  it("isoliert verschiedene Keys voneinander", async () => {
    mockUpstash();
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    const { assertRateLimit } = await loadRateLimiter();

    assertRateLimit("ai:company-a", 1, 60_000);
    assertRateLimit("ai:company-b", 1, 60_000);

    expect(() => assertRateLimit("ai:company-a", 1, 60_000)).toThrow("Zu viele Anfragen");
    expect(() => assertRateLimit("ai:company-b", 1, 60_000)).toThrow("Zu viele Anfragen");
  });

  it("laesst bei fehlenden Env-Variablen bewusst durch und warnt nur einmal", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { assertRateLimit } = await loadRateLimiter();

    expect(() => {
      assertRateLimit("missing-redis", 1, 60_000);
      assertRateLimit("missing-redis", 1, 60_000);
      assertRateLimit("missing-redis", 1, 60_000);
    }).not.toThrow();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("UPSTASH_REDIS_REST_URL");
    expect(warn.mock.calls[0]?.[0]).toContain("UPSTASH_REDIS_REST_TOKEN");
  });
});
