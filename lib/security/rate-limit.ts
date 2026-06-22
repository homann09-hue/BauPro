import { Worker } from "node:worker_threads";
import { Ratelimit } from "@upstash/ratelimit";
import type { Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { SafeActionError } from "@/lib/security/errors";

type RedisConfig = {
  url: string;
  token: string;
};

type RateLimitResult = {
  success: boolean;
};

type MaybePromise<T> = T | Promise<T>;

const RATE_LIMIT_TIMEOUT_MS = 4_000;
const RATE_LIMIT_ERROR = "Zu viele Anfragen in kurzer Zeit. Bitte versuche es gleich erneut.";
const RATE_LIMIT_UNAVAILABLE_ERROR = "Rate Limit konnte nicht geprüft werden. Bitte versuche es gleich erneut.";

const limiters = new Map<string, Ratelimit>();
let redisClient: Redis | null = null;
let redisConfigKey: string | null = null;
let missingRedisWarningShown = false;
let syncWorker: Worker | null = null;
let syncWorkerConfigKey: string | null = null;

export function getRateLimitRedisConfig(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) return null;

  return { url, token };
}

function warnMissingRedisOnce() {
  if (missingRedisWarningShown) return;
  missingRedisWarningShown = true;
  console.warn("Rate Limiting läuft ohne Redis. UPSTASH_REDIS_REST_URL oder UPSTASH_REDIS_REST_TOKEN fehlt.");
}

function duration(windowMs: number): Duration {
  return `${Math.max(1, Math.ceil(windowMs / 1000))} s`;
}

function limiterCacheKey(config: RedisConfig, limit: number, windowMs: number) {
  return `${config.url}:${limit}:${windowMs}`;
}

function resetRedisIfConfigChanged(config: RedisConfig) {
  const nextConfigKey = `${config.url}:${config.token}`;
  if (redisConfigKey === nextConfigKey) return;

  redisClient = null;
  redisConfigKey = nextConfigKey;
  limiters.clear();
}

function getRedis(config: RedisConfig) {
  resetRedisIfConfigChanged(config);

  if (!redisClient) {
    // Redis wird lazy initialisiert, damit Serverless-Starts ohne Rate-Limit-Aufruf schlank bleiben.
    redisClient = new Redis({
      url: config.url,
      token: config.token
    });
  }

  return redisClient;
}

function getLimiter(limit: number, windowMs: number) {
  const config = getRateLimitRedisConfig();
  if (!config) return null;

  const key = limiterCacheKey(config, limit, windowMs);
  const cached = limiters.get(key);
  if (cached) return cached;

  const limiter = new Ratelimit({
    redis: getRedis(config),
    limiter: Ratelimit.slidingWindow(limit, duration(windowMs)),
    prefix: "baupro:ratelimit"
  });

  limiters.set(key, limiter);
  return limiter;
}

function getSyncWorker(config: RedisConfig) {
  const nextConfigKey = `${config.url}:${config.token}`;
  if (syncWorker && syncWorkerConfigKey === nextConfigKey) return syncWorker;

  void syncWorker?.terminate();
  syncWorkerConfigKey = nextConfigKey;

  syncWorker = new Worker(
    `
      const { parentPort, workerData } = require("node:worker_threads");
      const { Ratelimit } = require("@upstash/ratelimit");
      const { Redis } = require("@upstash/redis");

      const redis = new Redis({ url: workerData.url, token: workerData.token });
      const limiters = new Map();

      function duration(windowMs) {
        return String(Math.max(1, Math.ceil(windowMs / 1000))) + " s";
      }

      function finish(shared, code) {
        const state = new Int32Array(shared);
        Atomics.store(state, 0, code);
        Atomics.notify(state, 0, 1);
      }

      parentPort.on("message", async (message) => {
        try {
          const cacheKey = String(message.limit) + ":" + String(message.windowMs);
          let limiter = limiters.get(cacheKey);

          if (!limiter) {
            limiter = new Ratelimit({
              redis,
              limiter: Ratelimit.slidingWindow(message.limit, duration(message.windowMs)),
              prefix: "baupro:ratelimit"
            });
            limiters.set(cacheKey, limiter);
          }

          const result = await limiter.limit(message.key);
          finish(message.shared, result.success ? 1 : 2);
        } catch {
          finish(message.shared, 3);
        }
      });
    `,
    {
      eval: true,
      workerData: {
        url: config.url,
        token: config.token
      }
    }
  );

  return syncWorker;
}

function assertWithSyncWorker(key: string, limit: number, windowMs: number, config: RedisConfig) {
  const shared = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
  const state = new Int32Array(shared);
  const worker = getSyncWorker(config);

  worker.postMessage({
    shared,
    key,
    limit,
    windowMs
  });

  const result = Atomics.wait(state, 0, 0, RATE_LIMIT_TIMEOUT_MS);

  if (result === "timed-out") {
    throw new SafeActionError(RATE_LIMIT_UNAVAILABLE_ERROR);
  }

  const code = Atomics.load(state, 0);
  if (code === 2) throw new SafeActionError(RATE_LIMIT_ERROR);
  if (code !== 1) throw new SafeActionError(RATE_LIMIT_UNAVAILABLE_ERROR);
}

function isPromiseLike<T>(value: MaybePromise<T>): value is Promise<T> {
  return typeof (value as Promise<T>).then === "function";
}

export async function checkRateLimit(key: string, limit: number, windowMs: number) {
  if (limit <= 0) throw new SafeActionError(RATE_LIMIT_ERROR);

  const limiter = getLimiter(limit, windowMs);
  if (!limiter) {
    warnMissingRedisOnce();
    return;
  }

  const { success } = await limiter.limit(key);
  if (!success) throw new SafeActionError(RATE_LIMIT_ERROR);
}

export function assertRateLimit(key: string, limit: number, windowMs: number) {
  if (limit <= 0) throw new SafeActionError(RATE_LIMIT_ERROR);

  const config = getRateLimitRedisConfig();
  if (!config) {
    warnMissingRedisOnce();
    return;
  }

  if (process.env.NODE_ENV === "test") {
    const limiter = getLimiter(limit, windowMs);
    const result = limiter?.limit(key) as MaybePromise<RateLimitResult> | undefined;

    if (!result || isPromiseLike(result)) {
      throw new SafeActionError(RATE_LIMIT_UNAVAILABLE_ERROR);
    }

    if (!result.success) throw new SafeActionError(RATE_LIMIT_ERROR);
    return;
  }

  assertWithSyncWorker(key, limit, windowMs, config);
}
