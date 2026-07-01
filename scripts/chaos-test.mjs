const baseUrl = process.env.CHAOS_BASE_URL || process.env.LOAD_BASE_URL || "http://localhost:3000";
const requestTimeoutMs = numberEnv("CHAOS_TIMEOUT_MS", 5_000);
const burstConcurrency = numberEnv("CHAOS_BURST_CONCURRENCY", 8);

const publicRoutes = routeList("CHAOS_PUBLIC_ROUTES", [
  "/",
  "/features",
  "/pricing",
  "/security",
  "/demo",
  "/legal/datenschutz",
  "/legal/agb",
  "/offline"
]);

const protectedRoutes = routeList("CHAOS_PROTECTED_ROUTES", [
  "/dashboard",
  "/materials/inventory",
  "/time-tracking",
  "/team",
  "/debug/system"
]);

const apiCases = [
  {
    name: "login-empty-form",
    method: "POST",
    path: "/api/auth/login",
    body: new FormData(),
    allowedStatuses: [303, 307, 308]
  },
  {
    name: "inventory-activity-no-session",
    method: "GET",
    path: "/api/materials/inventory/activity",
    allowedStatuses: [401]
  },
  {
    name: "inventory-jobsites-no-session",
    method: "GET",
    path: "/api/materials/inventory/jobsites",
    allowedStatuses: [401]
  },
  {
    name: "inventory-low-stock-no-session",
    method: "GET",
    path: "/api/materials/inventory/low-stock-count?limit=999999",
    allowedStatuses: [401]
  },
  {
    name: "inventory-suppliers-no-session",
    method: "GET",
    path: "/api/materials/inventory/suppliers",
    allowedStatuses: [401]
  },
  {
    name: "material-confirm-no-session",
    method: "POST",
    path: "/api/materials/usage-reports/confirm",
    json: { reportId: "not-a-uuid", decision: "confirmed" },
    allowedStatuses: [401]
  },
  {
    name: "weather-invalid-json-no-session",
    method: "POST",
    path: "/api/weather/suggest",
    rawBody: "{",
    headers: { "content-type": "application/json" },
    allowedStatuses: [401]
  },
  {
    name: "ai-report-long-input-no-session",
    method: "POST",
    path: "/api/ai/report-draft",
    json: { input: "x".repeat(20_000), aiProcessingOptIn: true },
    allowedStatuses: [401]
  },
  {
    name: "calendar-events-no-session",
    method: "GET",
    path: "/api/calendar/events?from=invalid&to=invalid",
    allowedStatuses: [401]
  },
  {
    name: "prefetch-bad-scope-no-session",
    method: "GET",
    path: "/api/prefetch/route-data?scope=unknown",
    allowedStatuses: [401]
  }
];

function numberEnv(key, fallback) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

function routeList(key, fallback) {
  const value = process.env[key];
  if (!value) return fallback;
  return value
    .split(",")
    .map((route) => route.trim())
    .filter(Boolean);
}

function round(value) {
  return Math.round(value);
}

async function fetchWithTimeout(path, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      redirect: "manual",
      ...init,
      headers: {
        "user-agent": "BauProChaosTest/1.0",
        accept: "text/html,application/json",
        ...(init.headers ?? {})
      },
      signal: controller.signal
    });
    const text = await response.text().catch(() => "");

    return {
      path,
      status: response.status,
      ok: response.status < 500,
      ms: performance.now() - startedAt,
      bodyPreview: text.slice(0, 160)
    };
  } catch (error) {
    return {
      path,
      status: 0,
      ok: false,
      ms: performance.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runPublicAndProtectedRoutes() {
  const jobs = [
    ...publicRoutes.flatMap((route) => Array.from({ length: 2 }, () => ({ kind: "public", route }))),
    ...protectedRoutes.flatMap((route) => Array.from({ length: 2 }, () => ({ kind: "protected", route })))
  ];
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor];
      cursor += 1;
      const result = await fetchWithTimeout(job.route);
      const allowed = job.kind === "public"
        ? result.status >= 200 && result.status < 400
        : [200, 303, 307, 308, 401, 403].includes(result.status);
      results.push({
        name: `${job.kind}:${job.route}`,
        ok: result.ok && allowed,
        expected: job.kind === "public" ? "2xx/3xx" : "200/3xx/401/403",
        ...result
      });
    }
  }

  await Promise.all(Array.from({ length: Math.min(burstConcurrency, jobs.length) }, worker));
  return results;
}

async function runApiCases() {
  const results = [];

  for (const testCase of apiCases) {
    const init = {
      method: testCase.method,
      headers: testCase.headers ?? {}
    };

    if (testCase.json) {
      init.headers = { ...init.headers, "content-type": "application/json" };
      init.body = JSON.stringify(testCase.json);
    } else if (testCase.rawBody) {
      init.body = testCase.rawBody;
    } else if (testCase.body) {
      init.body = testCase.body;
    }

    const result = await fetchWithTimeout(testCase.path, init);
    results.push({
      name: `api:${testCase.name}`,
      ok: result.ok && testCase.allowedStatuses.includes(result.status),
      expected: testCase.allowedStatuses.join(", "),
      ...result
    });
  }

  return results;
}

function summarize(results) {
  const failures = results.filter((result) => !result.ok);
  const latencies = results.map((result) => result.ms).sort((a, b) => a - b);

  return {
    baseUrl,
    requestTimeoutMs,
    totalChecks: results.length,
    failures: failures.length,
    p50Ms: round(latencies[Math.floor((latencies.length - 1) * 0.5)] ?? 0),
    p95Ms: round(latencies[Math.floor((latencies.length - 1) * 0.95)] ?? 0),
    maxMs: round(Math.max(...latencies, 0)),
    failedChecks: failures.map((failure) => ({
      name: failure.name,
      path: failure.path,
      status: failure.status,
      expected: failure.expected,
      ms: round(failure.ms),
      error: failure.error,
      bodyPreview: failure.bodyPreview
    }))
  };
}

const routeResults = await runPublicAndProtectedRoutes();
const apiResults = await runApiCases();
const results = [...routeResults, ...apiResults];
const summary = summarize(results);

console.log(JSON.stringify(summary, null, 2));

if (summary.failures > 0) {
  process.exit(1);
}
