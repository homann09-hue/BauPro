const baseUrl = process.env.LOAD_BASE_URL || "http://localhost:3000";
const concurrency = numberEnv("LOAD_CONCURRENCY", 20);
const totalPerRoute = numberEnv("LOAD_TOTAL_PER_ROUTE", 30);
const failOnErrors = process.env.LOAD_FAIL_ON_ERRORS !== "0";

const defaultPublicRoutes = [
  "/",
  "/features",
  "/pricing",
  "/security",
  "/demo",
  "/legal/datenschutz",
  "/legal/agb"
];

const defaultAuthenticatedRoutes = [
  "/dashboard",
  "/baustellen",
  "/orders",
  "/materials/inventory",
  "/bring-lists",
  "/time-tracking",
  "/berichte"
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

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] || 0;
}

function round(value) {
  return Math.round(value);
}

function summarize(label, results, elapsedMs) {
  const byRoute = new Map();
  for (const result of results) {
    if (!byRoute.has(result.route)) byRoute.set(result.route, []);
    byRoute.get(result.route).push(result);
  }

  return {
    label,
    baseUrl,
    totalRequests: results.length,
    concurrency,
    elapsedMs: round(elapsedMs),
    requestsPerSecond: Number((results.length / (elapsedMs / 1000)).toFixed(2)),
    failures: results.filter((result) => !result.ok).length,
    statusCounts: statusCounts(results),
    overall: {
      p50Ms: round(percentile(results.map((result) => result.ms), 0.5)),
      p95Ms: round(percentile(results.map((result) => result.ms), 0.95)),
      p99Ms: round(percentile(results.map((result) => result.ms), 0.99)),
      maxMs: round(Math.max(...results.map((result) => result.ms)))
    },
    routes: Object.fromEntries(
      [...byRoute.entries()].map(([route, routeResults]) => [
        route,
        {
          count: routeResults.length,
          failures: routeResults.filter((result) => !result.ok).length,
          statuses: statusCounts(routeResults),
          p50Ms: round(percentile(routeResults.map((result) => result.ms), 0.5)),
          p95Ms: round(percentile(routeResults.map((result) => result.ms), 0.95)),
          maxMs: round(Math.max(...routeResults.map((result) => result.ms)))
        }
      ])
    )
  };
}

function statusCounts(results) {
  return results.reduce((counts, result) => {
    counts[result.status] = (counts[result.status] || 0) + 1;
    return counts;
  }, {});
}

function cookieHeaderFrom(headers) {
  const values = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [headers.get("set-cookie")].filter(Boolean);
  return values.map((value) => String(value).split(";")[0]).join("; ");
}

async function loginCookie() {
  const email = process.env.LOAD_AUTH_EMAIL || process.env.E2E_CHEF_EMAIL;
  const password = process.env.LOAD_AUTH_PASSWORD || process.env.E2E_CHEF_PASSWORD || process.env.DEMO_USER_PASSWORD;

  if (!email || !password) return null;

  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", password);

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: formData,
    redirect: "manual",
    headers: {
      "user-agent": "BauProLoadTest/1.0"
    }
  });

  const cookie = cookieHeaderFrom(response.headers);
  if (!cookie) {
    throw new Error(`Login fuer Load-Test fehlgeschlagen. Status: ${response.status}`);
  }
  return cookie;
}

async function runLoadTest(label, routes, cookie) {
  const jobs = [];
  for (const route of routes) {
    for (let index = 0; index < totalPerRoute; index += 1) jobs.push(route);
  }

  let cursor = 0;
  const results = [];

  async function hit(route) {
    const startedAt = performance.now();
    try {
      const response = await fetch(`${baseUrl}${route}`, {
        redirect: "manual",
        headers: {
          "user-agent": "BauProLoadTest/1.0",
          accept: "text/html,application/json",
          ...(cookie ? { cookie } : {})
        }
      });
      await response.text().catch(() => "");
      results.push({
        route,
        status: response.status,
        ok: response.status < 500,
        ms: performance.now() - startedAt
      });
    } catch (error) {
      results.push({
        route,
        status: 0,
        ok: false,
        ms: performance.now() - startedAt,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function worker() {
    while (cursor < jobs.length) {
      const route = jobs[cursor];
      cursor += 1;
      await hit(route);
    }
  }

  const startedAt = performance.now();
  await Promise.all(Array.from({ length: concurrency }, worker));
  return summarize(label, results, performance.now() - startedAt);
}

const summaries = [];
summaries.push(await runLoadTest("public", routeList("LOAD_ROUTES", defaultPublicRoutes), null));

if (process.env.LOAD_AUTH === "1") {
  summaries.push(await runLoadTest("authenticated", routeList("LOAD_AUTH_ROUTES", defaultAuthenticatedRoutes), await loginCookie()));
}

console.log(JSON.stringify(summaries, null, 2));

if (failOnErrors && summaries.some((summary) => summary.failures > 0)) {
  process.exit(1);
}
