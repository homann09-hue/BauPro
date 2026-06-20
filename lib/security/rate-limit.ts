import { Worker } from "node:worker_threads";
import { Ratelimit } from "@upstash/ratelimit";
import type { Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { SafeActionError } from "@/lib/security/errors";

type TestBucket = {
  hits: number[];
};

const testBuckets = new Map<string, TestBucket>();
const asyncLimiters = new Map<string, Ratelimit>();
let missingRedisWarningShown = false;

const RATE_LIMIT_TIMEOUT_MS = 4_000;
const RATE_LIMIT_ERROR = "Zu viele Anfragen in kurzer Zeit. Bitte versuche es gleich erneut.";
const RATE_LIMIT_UNAVAILABLE_ERROR = "Rate Limit konnte nicht geprueft werden. Bitte versuche es gleich erneut.";

function warnMissingRedisOnce() {
  if (missingRedisWarningShown) return;
  missingRedisWarningShown = true;
  console.warn("Rate Limiting laeuft ohne Redis. UPSTASH_REDIS_REST_URL oder UPSTASH_REDIS_REST_TOKEN fehlt.");
}

function redisConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function testModeEnabled() {
  return process.env.BAUPRO_RATE_LIMIT_TEST_MODE === "memory";
}

function assertTestSlidingWindowLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = testBuckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((hitAt) => now - hitAt < windowMs);

  if (bucket.hits.length >= limit) {
    testBuckets.set(key, bucket);
    throw new SafeActionError(RATE_LIMIT_ERROR);
  }

  bucket.hits.push(now);
  testBuckets.set(key, bucket);
}

function duration(windowMs: number): Duration {
  return `${Math.max(1, Math.ceil(windowMs / 1000))} s`;
}

function limiterCacheKey(limit: number, windowMs: number) {
  return `${limit}:${windowMs}`;
}

function getAsyncLimiter(limit: number, windowMs: number) {
  const key = limiterCacheKey(limit, windowMs);
  const cached = asyncLimiters.get(key);
  if (cached) return cached;

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
  });
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, duration(windowMs)),
    prefix: "baupro:ratelimit"
  });

  asyncLimiters.set(key, limiter);
  return limiter;
}

// Async-Variante fuer neue Call-Sites. Bestehende Aufrufe nutzen weiter assertRateLimit().
export async function checkRateLimit(key: string, limit: number, windowMs: number) {
  if (limit <= 0) throw new SafeActionError(RATE_LIMIT_ERROR);

  if (testModeEnabled()) {
    assertTestSlidingWindowLimit(key, limit, windowMs);
    return;
  }

  if (!redisConfigured()) {
    warnMissingRedisOnce();
    return;
  }

  const { success } = await getAsyncLimiter(limit, windowMs).limit(key);
  if (!success) throw new SafeActionError(RATE_LIMIT_ERROR);
}

function assertRedisLimitSynchronously(key: string, limit: number, windowMs: number) {
  const shared = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
  const state = new Int32Array(shared);
  const worker = new Worker(
    `
      const { workerData } = require("node:worker_threads");
      const state = new Int32Array(workerData.shared);

      function finish(code) {
        Atomics.store(state, 0, code);
        Atomics.notify(state, 0, 1);
      }

      (async () => {
        try {
          const { Ratelimit } = await import("@upstash/ratelimit");
          const { Redis } = await import("@upstash/redis");
          const redis = new Redis({ url: workerData.url, token: workerData.token });
          const ratelimit = new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(workerData.limit, workerData.duration),
            prefix: "baupro:ratelimit"
          });
          const result = await ratelimit.limit(workerData.key);
          finish(result.success ? 1 : 2);
        } catch {
          finish(3);
        }
      })();
    `,
    {
      eval: true,
      workerData: {
        shared,
        key,
        limit,
        duration: duration(windowMs),
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN
      }
    }
  );

  const result = Atomics.wait(state, 0, 0, RATE_LIMIT_TIMEOUT_MS);
  void worker.terminate();

  if (result === "timed-out") {
    throw new SafeActionError(RATE_LIMIT_UNAVAILABLE_ERROR);
  }

  const code = Atomics.load(state, 0);
  if (code === 2) throw new SafeActionError(RATE_LIMIT_ERROR);
  if (code !== 1) throw new SafeActionError(RATE_LIMIT_UNAVAILABLE_ERROR);
}

export function assertRateLimit(key: string, limit: number, windowMs: number) {
  if (limit <= 0) throw new SafeActionError(RATE_LIMIT_ERROR);

  if (testModeEnabled()) {
    assertTestSlidingWindowLimit(key, limit, windowMs);
    return;
  }

  if (!redisConfigured()) {
    warnMissingRedisOnce();
    return;
  }

  assertRedisLimitSynchronously(key, limit, windowMs);
}
