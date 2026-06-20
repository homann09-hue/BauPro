import { afterEach, describe, expect, it, vi } from "vitest";

const oldEnv = { ...process.env };

async function loadRateLimiter() {
  vi.resetModules();
  return import("@/lib/security/rate-limit");
}

afterEach(() => {
  process.env = { ...oldEnv };
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("Redis rate limiter facade", () => {
  it("loest nach N Calls aus", async () => {
    process.env.BAUPRO_RATE_LIMIT_TEST_MODE = "memory";
    const { assertRateLimit } = await loadRateLimiter();

    assertRateLimit("login:user@example.test", 2, 60_000);
    assertRateLimit("login:user@example.test", 2, 60_000);

    expect(() => assertRateLimit("login:user@example.test", 2, 60_000)).toThrow("Zu viele Anfragen");
  });

  it("isoliert verschiedene Keys sauber", async () => {
    process.env.BAUPRO_RATE_LIMIT_TEST_MODE = "memory";
    const { assertRateLimit } = await loadRateLimiter();

    assertRateLimit("ai:company-a", 1, 60_000);
    assertRateLimit("ai:company-b", 1, 60_000);

    expect(() => assertRateLimit("ai:company-a", 1, 60_000)).toThrow("Zu viele Anfragen");
    expect(() => assertRateLimit("ai:company-b", 1, 60_000)).toThrow("Zu viele Anfragen");
  });

  it("laesst bei fehlendem Redis bewusst durch und warnt", async () => {
    delete process.env.BAUPRO_RATE_LIMIT_TEST_MODE;
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
  });
});
