import { AuthError, PostgrestError, type PostgrestSingleResponse } from "@supabase/supabase-js";
import { logServerError, logServerWarning } from "@/lib/security/logging";

const isDev = process.env.NODE_ENV === "development";
const DEFAULT_TIMEOUT_MS = 4_500;
const DEFAULT_SLOW_QUERY_MS = 1_600;
const DEFAULT_SLOW_ROUTE_MS = 1_800;

type MetricMeta = Record<string, string | number | boolean | null | undefined>;

type FallbackValue<T> = T | (() => T);

type QueryTimingOptions<T = unknown> = {
  route: string;
  action: string;
  timeoutMs?: number;
  slowMs?: number;
  fallback?: FallbackValue<T>;
};

type RouteTimingOptions = {
  slowMs?: number;
};

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`.slice(0, 300);
  return "Unbekannter Fehler";
}

function isObjectError(error: unknown): error is { message?: string } {
  return typeof error === "object" && error !== null && "message" in error;
}

function resolveFallback<T>(fallback?: FallbackValue<T>): T | undefined {
  if (typeof fallback === "undefined") return undefined;
  if (typeof fallback === "function") return (fallback as () => T)();
  return fallback;
}

export class QueryTimeoutError extends Error {
  public readonly route: string;
  public readonly action: string;
  public readonly timeoutMs: number;

  constructor(route: string, action: string, timeoutMs: number) {
    super(`Query-Timeout nach ${timeoutMs}ms in ${route}: ${action}`);
    this.name = "QueryTimeoutError";
    this.route = route;
    this.action = action;
    this.timeoutMs = timeoutMs;
  }
}

export function isQueryTimeoutError(error: unknown) {
  return error instanceof QueryTimeoutError;
}

export function authTimeoutError(message: string) {
  return new AuthError(message, 504, "timeout");
}

export function postgrestTimeoutResponse(message: string): PostgrestSingleResponse<never> {
  return {
    data: null,
    error: new PostgrestError({ message, details: "", hint: "", code: "timeout" }),
    count: null,
    status: 504,
    statusText: "Timeout",
    success: false
  };
}

function withRouteLabel(route: string, action: string) {
  return `[perf] ${route} :: ${action}`;
}

function hasFallback<T>(options: QueryTimingOptions<T>) {
  return Object.prototype.hasOwnProperty.call(options, "fallback");
}

export async function withQueryTimeout<T>(
  query: () => PromiseLike<T>,
  options: QueryTimingOptions<T>
): Promise<T> {
  const route = options.route;
  const action = options.action;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const slowMs = options.slowMs ?? DEFAULT_SLOW_QUERY_MS;
  const startedAt = Date.now();
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    const result = await Promise.race([
      Promise.resolve().then(query),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new QueryTimeoutError(route, action, timeoutMs));
        }, timeoutMs);
      })
    ]);

    const durationMs = Date.now() - startedAt;
    if (durationMs > slowMs && isDev) {
      logServerWarning("perf.slow-query", { route, action, durationMs });
    }
    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    if (isQueryTimeoutError(error)) {
      if (hasFallback(options)) {
        if (isDev) {
          logServerWarning("perf.query-timeout-fallback", {
            route,
            action,
            timeoutMs,
            durationMs
          });
        }
        const fallback = resolveFallback(options.fallback);
        if (typeof fallback !== "undefined") return fallback;
      }

      if (isDev) {
        logServerError("perf.query-timeout", error, {
          route,
          action,
          durationMs
        });
      }
      throw error;
    }

    if (isDev) {
      logServerError("perf.query-error", error, {
        route,
        action,
        durationMs,
        errorMessage: safeErrorMessage(isObjectError(error) ? error.message : error)
      });
    }
    throw error;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export async function withRouteTiming<T>(
  route: string,
  action: string,
  fn: () => PromiseLike<T>,
  options: RouteTimingOptions = {}
): Promise<T> {
  const slowMs = options.slowMs ?? DEFAULT_SLOW_ROUTE_MS;
  const startedAt = Date.now();

  try {
    const result = await Promise.resolve().then(fn);
    const durationMs = Date.now() - startedAt;
    const meta = withRouteLabel(route, action);

    if (isDev) {
      if (durationMs > slowMs) {
        logServerWarning("perf.slow-route", {
          label: meta,
          route,
          action,
          durationMs
        });
      } else {
        logServerWarning("perf.route", {
          label: meta,
          route,
          action,
          durationMs
        });
      }
    }

    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    if (isDev) {
      logServerError("perf.route-error", error, {
        label: withRouteLabel(route, action),
        route,
        action,
        durationMs,
        errorMessage: safeErrorMessage(error)
      });
    }

    throw error;
  }
}

export const perfMetric = <T extends MetricMeta>(values: T) => values;
