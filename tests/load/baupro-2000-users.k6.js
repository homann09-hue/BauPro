/* global __ENV, open */
import encoding from "k6/encoding";
import exec from "k6/execution";
import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const baseUrl = (__ENV.LOAD_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const profile = __ENV.LOAD_PROFILE || "load";
const targetVus = Number(__ENV.LOAD_TARGET_VUS || (profile === "stress" ? 2000 : 100));
const loadDuration = __ENV.LOAD_DURATION || (profile === "stress" ? "10m" : "2m");
const users = loadUsers();
const businessErrors = new Rate("baupro_business_errors");
const authFailures = new Counter("baupro_auth_failures");
const tenantLeakChecks = new Rate("baupro_tenant_leak_checks");
const protectedDataChecks = new Rate("baupro_protected_data_checks");
const pageLoadTrend = new Trend("baupro_page_load_ms");

export const options = {
  scenarios: {
    realistic_business_mix: scenarioForProfile()
  },
  thresholds: {
    http_req_failed: profile === "stress" ? ["rate<0.10"] : ["rate<0.05"],
    http_req_duration: profile === "stress" ? ["p(95)<5000", "p(99)<12000"] : ["p(95)<3000", "p(99)<8000"],
    checks: ["rate>0.95"],
    baupro_business_errors: ["rate<0.03"],
    baupro_tenant_leak_checks: ["rate>0.99"],
    baupro_protected_data_checks: ["rate>0.99"]
  },
  userAgent: "BauProK6LoadTest/2.0"
};

function scenarioForProfile() {
  if (profile === "stress") {
    return {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "3m", target: Math.min(500, targetVus) },
        { duration: "5m", target: targetVus },
        { duration: loadDuration, target: targetVus },
        { duration: "3m", target: 0 }
      ],
      gracefulRampDown: "45s"
    };
  }

  if (profile === "soak") {
    return {
      executor: "constant-vus",
      vus: targetVus,
      duration: loadDuration
    };
  }

  return {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "30s", target: targetVus },
      { duration: loadDuration, target: targetVus },
      { duration: "30s", target: 0 }
    ],
    gracefulRampDown: "20s"
  };
}

function loadUsers() {
  const raw = __ENV.LOAD_USERS_JSON || open(__ENV.LOAD_USERS_FILE || "tests/load/baupro-users.example.json");
  const parsed = JSON.parse(raw);
  return parsed.map((user) => ({
    role: user.role,
    email: user.email,
    password: __ENV[user.passwordEnv] || user.defaultPassword || __ENV.LOAD_DEFAULT_PASSWORD || "BauProDemo!2026"
  }));
}

export function setup() {
  if (!["local", "test", "staging"].includes(__ENV.LOAD_TEST_ENVIRONMENT || "")) {
    throw new Error("LOAD_TEST_ENVIRONMENT=local|test|staging ist Pflicht. Kein Lasttest gegen ungekennzeichnete Umgebung.");
  }

  if (baseUrl.includes("bau-pro.vercel.app")) {
    throw new Error("Bekannte Production-Domain ist fuer Lasttests gesperrt.");
  }

  if (profile === "stress" && __ENV.LOAD_TEST_ACKNOWLEDGE_2000_USERS !== "1") {
    throw new Error("2.000-User-Stresstest braucht LOAD_TEST_ACKNOWLEDGE_2000_USERS=1.");
  }

  const health = http.get(`${baseUrl}/api/health/db`, { tags: { name: "GET /api/health/db" } });
  check(health, {
    "Testumgebung antwortet": (response) => response.status < 500
  });

  return { startedAt: new Date().toISOString() };
}

export default function runBauProBusinessFlow() {
  const user = users[exec.vu.idInTest % users.length];

  group("01 public entry", () => {
    getPage("/", "GET /");
    getPage("/features", "GET /features");
    getPage("/pricing", "GET /pricing");
    getPage("/security", "GET /security");
    postInvalidLogin();
  });

  const loggedIn = login(user);
  if (!loggedIn) {
    authFailures.add(1);
    businessErrors.add(1);
    sleep(1);
    return;
  }

  group(`02 authenticated ${user.role}`, () => {
    getPage("/dashboard", "GET /dashboard");
    getPage("/morgen", "GET /morgen");
    getPage("/baustellen", "GET /baustellen");
    getPage("/orders", "GET /orders");
    getPage("/customers", "GET /customers");
    getPage("/materials/inventory", "GET /materials/inventory");
    getPage("/time-tracking", "GET /time-tracking");
    getPage("/berichte", "GET /berichte");
  });

  group("03 search and filters", () => {
    getPage("/orders?q=Dach", "GET /orders?q");
    getPage("/baustellen?q=Müller", "GET /baustellen?q");
    getPage("/customers?q=Schmidt", "GET /customers?q");
    getPage("/materials/inventory?q=Unterspannbahn", "GET /materials/inventory?q");
  });

  group("04 role and tenant protection", () => {
    const inventory = getPage("/materials/inventory", "GET /materials/inventory role-check");
    if (user.role !== "chef") {
      const inventoryBody = bodyText(inventory);
      const noPrices =
        !inventoryBody.includes("purchase_price") &&
        !inventoryBody.includes("sales_price") &&
        !inventoryBody.includes("Marge") &&
        !inventoryBody.includes("Chef-Preise");
      protectedDataChecks.add(noPrices);
      check(inventory, {
        "operative Rollen sehen keine Preisfelder": () => noPrices
      });
    } else {
      protectedDataChecks.add(true);
    }

    const invalidPortal = http.get(`${baseUrl}/portal/ungueltiger-lasttest-token`, {
      redirects: 0,
      tags: { name: "GET /portal/:invalid-token" }
    });
    const noTokenOracle = [404, 429].includes(invalidPortal.status);
    tenantLeakChecks.add(noTokenOracle);
    check(invalidPortal, {
      "ungueltiges Portal leakt keine Daten": () => noTokenOracle
    });
  });

  group("05 exports and APIs", () => {
    getPage("/api/calendar/events?from=2026-01-01&to=2026-01-31", "GET /api/calendar/events");
    getPage("/api/materials/inventory/low-stock-count", "GET /api/materials/inventory/low-stock-count");
    getOptionalExport(__ENV.LOAD_REPORT_ID, (id) => `/berichte/${id}/pdf`, "GET /berichte/:id/pdf");
    getOptionalExport(__ENV.LOAD_TIME_REPORT_ID, (id) => `/time-tracking/reports/${id}/pdf`, "GET /time-tracking/reports/:id/pdf");
    getOptionalExport(__ENV.LOAD_INVOICE_ID, (id) => `/invoices/${id}/pdf`, "GET /invoices/:id/pdf");
  });

  group("06 upload-shaped traffic", () => {
    if (__ENV.LOAD_UPLOAD_ENDPOINT) {
      const imageBytes = encoding.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lQnQ4wAAAABJRU5ErkJggg==",
        "rawstd"
      );
      const response = http.post(
        `${baseUrl}${__ENV.LOAD_UPLOAD_ENDPOINT}`,
        {
          file: http.file(imageBytes, `lasttest-${exec.vu.idInTest}.png`, "image/png"),
          note: "Automatischer k6-Uploadtest fuer Baustellenfoto."
        },
        { tags: { name: "POST upload endpoint" } }
      );
      check(response, {
        "Upload-Endpunkt verarbeitet oder blockiert sauber": (res) => res.status < 500
      });
    }
  });

  sleep(Number(__ENV.LOAD_THINK_TIME_SECONDS || 1));
}

function login(user) {
  const response = http.post(
    `${baseUrl}/api/auth/login`,
    {
      email: user.email,
      password: user.password
    },
    {
      redirects: 0,
      tags: { name: "POST /api/auth/login" }
    }
  );

  return check(response, {
    "Login gibt Redirect und Session-Cookie": (res) => [302, 303].includes(res.status) && Boolean(res.headers["Set-Cookie"])
  });
}

function postInvalidLogin() {
  const response = http.post(
    `${baseUrl}/api/auth/login`,
    {
      email: "",
      password: ""
    },
    {
      redirects: 0,
      tags: { name: "POST /api/auth/login invalid" }
    }
  );

  check(response, {
    "ungueltiger Login wird sauber abgelehnt": (res) => [302, 303, 429].includes(res.status)
  });
}

function getPage(path, name) {
  const started = Date.now();
  const response = http.get(`${baseUrl}${path}`, {
    redirects: 0,
    tags: { name }
  });
  pageLoadTrend.add(Date.now() - started);

  const responseBody = bodyText(response);
  const ok = response.status < 500 && !responseBody.includes("NEXT_REDIRECT") && !responseBody.includes("Datenbank-Update fehlt");
  businessErrors.add(!ok);
  check(response, {
    [`${name} antwortet ohne Serverfehler`]: () => response.status < 500,
    [`${name} zeigt keinen versteckten Runtime-Redirect`]: () => !responseBody.includes("NEXT_REDIRECT"),
    [`${name} meldet kein fehlendes Schema`]: () => !responseBody.includes("Datenbank-Update fehlt")
  });

  return response;
}

function bodyText(response) {
  return typeof response.body === "string" ? response.body : "";
}

function getOptionalExport(id, routeBuilder, name) {
  if (!id) return;
  const response = http.get(`${baseUrl}${routeBuilder(id)}`, {
    redirects: 0,
    tags: { name }
  });
  check(response, {
    [`${name} liefert PDF oder saubere Ablehnung`]: (res) =>
      res.status === 200 || res.status === 403 || res.status === 404 || res.status === 429
  });
}
