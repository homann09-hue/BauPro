import { Ratelimit } from "@upstash/ratelimit";
import type { Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { SafeActionError } from "@/lib/security/errors";

type RedisConfig = {
  url: string;
  token: string;
};

const RATE_LIMIT_ERROR = "Zu viele Anfragen in kurzer Zeit. Bitte versuche es gleich erneut.";
const RATE_LIMIT_UNAVAILABLE_ERROR = "Rate Limit konnte nicht geprüft werden. Bitte versuche es gleich erneut.";

const limiters = new Map<string, Ratelimit>();
let redisClient: Redis | null = null;
let redisConfigKey: string | null = null;
let missingRedisWarningShown = false;

export function getRateLimitRedisConfig(): RedisConfig | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)?.trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)?.trim();

  if (!url || !token) return null;

  return { url, token };
}

function warnMissingRedisOnce() {
  if (missingRedisWarningShown) return;
  missingRedisWarningShown = true;
  console.warn(
    "Rate Limiting läuft ohne Redis. UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN oder KV_REST_API_URL/KV_REST_API_TOKEN fehlt."
  );
}

function shouldBlockWhenRedisMissing() {
  return process.env.NODE_ENV === "production";
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

export async function checkRateLimit(key: string, limit: number, windowMs: number) {
  if (limit <= 0) throw new SafeActionError(RATE_LIMIT_ERROR);

  const limiter = getLimiter(limit, windowMs);
  if (!limiter) {
    warnMissingRedisOnce();
    if (shouldBlockWhenRedisMissing()) throw new SafeActionError(RATE_LIMIT_UNAVAILABLE_ERROR);
    return;
  }

  const { success } = await limiter.limit(key);
  if (!success) throw new SafeActionError(RATE_LIMIT_ERROR);
}
