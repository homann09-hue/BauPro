#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const profile = process.argv[2] || "all";

const BLOCKING = "blocking";
const WARNING = "warning";

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".sql", ".md", ".yml", ".yaml", ".json"]);
const ignoredDirs = new Set(["node_modules", ".git", ".next", "coverage", "public", "test-results", "playwright-report"]);
const ignoredFiles = new Set(["package-lock.json"]);

const results = [];

function addResult({ severity = BLOCKING, area, message, file = null, line = null }) {
  results.push({ severity, area, message, file, line });
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (!entry.isFile()) continue;
    if (ignoredFiles.has(entry.name)) continue;
    if (!sourceExtensions.has(path.extname(entry.name))) continue;
    files.push(fullPath);
  }

  return files;
}

const files = walk(root);

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

function scanRegex({ area, regex, message, severity = BLOCKING, exclude = () => false }) {
  for (const file of files) {
    const rel = relative(file);
    if (exclude(rel)) continue;
    const text = read(file);
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(text))) {
      addResult({ severity, area, message, file: rel, line: lineOf(text, match.index) });
      if (!regex.global) break;
    }
  }
}

function requireFileContains(file, needles, area, message) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    addResult({ area, message: `${message} Datei fehlt: ${file}` });
    return;
  }

  const text = read(fullPath);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      addResult({ area, message: `${message} Erwartet: ${needle}`, file });
    }
  }
}

function commandExists(command) {
  const paths = (process.env.PATH || "").split(path.delimiter);
  const candidates = process.platform === "win32" ? [`${command}.cmd`, `${command}.exe`, command] : [command];
  return paths.some((dir) => candidates.some((candidate) => fs.existsSync(path.join(dir, candidate))));
}

function secretScan() {
  const secretPatterns = [
    {
      regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
      message: "Moeglicher OpenAI/API Secret Key im Repository."
    },
    {
      regex: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g,
      message: "Moeglicher Supabase Secret Key im Repository."
    },
    {
      regex: /\bwhsec_[A-Za-z0-9_-]{20,}\b/g,
      message: "Moeglicher Stripe Webhook Secret im Repository."
    },
    {
      regex: /\brk_live_[A-Za-z0-9_-]{20,}\b/g,
      message: "Moeglicher Live-Provider-Key im Repository."
    }
  ];

  for (const pattern of secretPatterns) {
    scanRegex({
      area: "security:secrets",
      regex: pattern.regex,
      message: pattern.message,
      exclude: (file) =>
        file.endsWith(".env.example") ||
        file.endsWith("README.md") ||
        file.includes("tests/") ||
        file.includes("scripts/qa/static-gates.mjs")
    });
  }
}

function securityScan() {
  secretScan();

  scanRegex({
    area: "security:xss",
    regex: /dangerouslySetInnerHTML\s*=/g,
    message: "dangerouslySetInnerHTML muss begruendet, sanitisiert und getestet sein."
  });

  scanRegex({
    area: "security:eval",
    regex: /\b(eval|Function)\s*\(/g,
    message: "Dynamische Code-Ausfuehrung ist verboten.",
    exclude: (file) => file.includes("scripts/qa/static-gates.mjs") || file.includes("tests/")
  });

  scanRegex({
    area: "security:logging",
    regex: /console\.log\s*\(/g,
    message: "console.log in App-Code vermeiden; strukturierte Logger nutzen.",
    exclude: (file) => file.startsWith("scripts/") || file.includes("tests/")
  });

  scanRegex({
    area: "security:service-role",
    regex: /NEXT_PUBLIC_[A-Z0-9_]*(SERVICE_ROLE|SECRET|OPENAI|STRIPE|API_KEY)[A-Z0-9_]*/g,
    message: "Secret-nahe Variable darf nicht mit NEXT_PUBLIC_ exponiert werden.",
    exclude: (file) => file.includes("scripts/qa/static-gates.mjs")
  });

  requireFileContains("proxy.ts", [
    "Content-Security-Policy",
    "frame-ancestors 'none'",
    "isUnsafeMethod(request.method)",
    "requestOrigin && requestOrigin !== expectedOrigin",
    "await updateSession(request, requestHeaders)"
  ], "security:headers", "Proxy muss CSP, Origin-Check und Supabase Session Refresh enthalten.");

  requireFileContains("lib/security/rate-limit.ts", [
    "@upstash/ratelimit",
    "Ratelimit.slidingWindow",
    "process.env.NODE_ENV === \"production\"",
    "RATE_LIMIT_UNAVAILABLE_ERROR"
  ], "security:rate-limit", "Rate Limiting muss Redis-basiert und in Production fail-closed sein.");

  requireFileContains("supabase/schema.sql", [
    "force row level security",
    "public.current_company_id()",
    "inventory_items_public",
    "security_invoker = true",
    "assert_role_change_allowed",
    "assert_employee_permission_change_allowed"
  ], "security:supabase", "Supabase Schema muss RLS, preisbereinigte Views und Rollen-Guards enthalten.");

  requireFileContains("tests/unit/rate-limit.test.ts", ["verschiedene Keys", "Production"], "security:tests", "Rate-Limit-Tests muessen Schluesselisolation und Production-Fallback pruefen.");
  requireFileContains("tests/integration/rls-schema.test.ts", ["force row level security", "inventory_items_public"], "security:tests", "RLS-Tests muessen Mandantentrennung und Preisviews pruefen.");
  requireFileContains("tests/unit/security-headers.test.ts", ["unsafe-eval", "unsafe-inline", "Content-Security-Policy"], "security:tests", "Security-Header-Tests muessen CSP haerten.");
  requireFileContains("tests/unit/public-endpoint-hardening.test.ts", ["checkRateLimit", "Health-Check wurde gedrosselt"], "security:tests", "Oeffentliche Endpunkte brauchen Rate-Limit-/Hardening-Tests.");
  requireFileContains("tests/unit/portal-rate-limit.test.ts", ["31. Portal-Anfrage", "verschiedene IPs"], "security:tests", "Kundenportal braucht IP-basierten Rate-Limit-Test.");
  requireFileContains("tests/unit/security-errors.test.ts", ["safeErrorMessage"], "security:errors", "Fehlerausgaben muessen sanitisiert werden.");
}

function qualityScan() {
  scanRegex({
    area: "quality:typescript",
    regex: /\/\/\s*@ts-ignore/g,
    message: "@ts-ignore ist nicht erlaubt; Ursache typisieren oder @ts-expect-error mit Begruendung nutzen."
  });

  scanRegex({
    area: "quality:typescript",
    regex: /\bas\s+any\b|:\s*any\b/g,
    message: "Explizites any vermeiden oder lokal begruenden.",
    severity: WARNING,
    exclude: (file) => file.includes("scripts/qa/static-gates.mjs") || file.includes("tests/")
  });

  if (!fs.existsSync(path.join(root, "tests"))) {
    addResult({ area: "quality:tests", message: "tests/-Verzeichnis fehlt." });
  }

  if (!commandExists("npx")) {
    addResult({ severity: WARNING, area: "quality:tools", message: "npx nicht gefunden; optionale Tool-Checks werden uebersprungen." });
  }
}

function performanceScan() {
  requireFileContains("next.config.mjs", [
    "NetworkOnly",
    "cacheStartUrl: false",
    "dynamicStartUrl: false",
    "networkTimeoutSeconds"
  ], "performance:pwa", "PWA-Cache darf API-Daten nicht stale ausliefern und Startseite nicht hart cachen.");

  requireFileContains("components/performance/PredictivePrefetch.tsx", [
    "requestIdleCallback",
    "prefetch"
  ], "performance:prefetch", "Predictive Prefetch muss idle-freundlich arbeiten.");

  requireFileContains("scripts/run-k6-load-test.mjs", [
    "--validate-config",
    "2000"
  ], "performance:load", "Load-Test-Konfiguration muss validierbar und fuer 2.000 Nutzer dokumentiert sein.");

  requireFileContains("tests/e2e/performance-navigation.spec.ts", [
    "dashboard",
    "performance"
  ], "performance:e2e", "Performance-Navigation braucht E2E-Abdeckung.");
}

function aiScan() {
  requireFileContains("lib/actions/ai-actions.ts", [
    "checkAiLimit",
    "checkRateLimit",
    "roleAwareSystemPrompt",
    "localAssistantFallback"
  ], "ai:safety", "KI-Actions brauchen Limit, Rate-Limit, serverseitigen Key, rollenbewussten Prompt und Fallback.");

  requireFileContains("lib/ai/openai.ts", [
    "OPENAI_API_KEY",
    "https://api.openai.com/v1/responses",
    "json_schema",
    "logServerError"
  ], "ai:safety", "OpenAI muss serverseitig, strukturiert und mit sanitisiertem Fehlerpfad angebunden sein.");

  requireFileContains("app/api/ai/report-draft/route.ts", [
    "aiProcessingOptIn",
    "existingPhotoIds",
    "safeErrorMessage"
  ], "ai:privacy", "KI-Berichtsroute braucht Opt-in, kontrollierten Fotokontext und sanitisiertes Error Handling.");

  requireFileContains("tests/unit/openai-api.test.ts", ["OPENAI_API_KEY", "disabled"], "ai:tests", "OpenAI-Konfiguration muss getestet werden.");
  requireFileContains("tests/unit/ai-daily-report-automation.test.ts", ["missing_information", "Erfinde niemals"], "ai:tests", "KI-Bericht muss Rueckfragen/Entwurf statt erfundener Fakten testen.");

  const tradingFiles = files.filter((file) => /trading|market-data|backtest|portfolio|trade-signal|trading-signal/i.test(relative(file)));
  if (tradingFiles.length > 0) {
    const combined = tradingFiles.map(read).join("\n");
    if (!/keine Anlageberatung|keine Finanzberatung|fachlich pruefen|fachlich prüfen/i.test(combined)) {
      addResult({
        area: "ai:financial-safety",
        message: "Trading-/Marktdaten-Code erkannt, aber kein klarer Keine-Anlageberatung-/Pruefhinweis gefunden."
      });
    }
  } else {
    addResult({
      severity: WARNING,
      area: "ai:financial-safety",
      message: "Keine Trading-/Marktdatenmodule erkannt; Anlageberatungs-Gate wird als nicht anwendbar gewertet."
    });
  }
}

function tradingScan() {
  const tradingFiles = files.filter((file) => /trading|market-data|backtest|portfolio|trade-signal|trading-signal/i.test(relative(file)));
  if (tradingFiles.length === 0) {
    addResult({
      severity: WARNING,
      area: "trading:scope",
      message: "Keine Trading-/Marktdatenmodule erkannt. Provider-Latenz, Backtesting und Monte-Carlo sind vorbereitet, aber nicht blockierend anwendbar."
    });
    return;
  }

  const combined = tradingFiles.map(read).join("\n");
  for (const needle of ["latency", "stale", "outlier", "backtest", "slippage", "fee"]) {
    if (!combined.toLowerCase().includes(needle)) {
      addResult({ area: "trading:data-quality", message: `Trading-Gate vermisst Check-Hinweis: ${needle}` });
    }
  }
}

function releaseScan() {
  securityScan();
  performanceScan();
  aiScan();

  requireFileContains(".env.example", [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "OPENAI_API_KEY",
    "STRIPE_SECRET_KEY"
  ], "release:env", "Production-Pflichtvariablen muessen dokumentiert sein.");

  const envExample = read(path.join(root, ".env.example"));
  if (!/CRON_SECRET|SCHEDULE_SECRET|JOB_SECRET/.test(envExample)) {
    addResult({
      severity: WARNING,
      area: "release:env",
      message: "Kein Cron Secret in .env.example gefunden. Falls Cron-Jobs eingefuehrt werden, muss das Gate blockierend werden."
    });
  }
}

const profiles = {
  security: securityScan,
  quality: qualityScan,
  performance: performanceScan,
  ai: aiScan,
  trading: tradingScan,
  release: releaseScan,
  all() {
    securityScan();
    qualityScan();
    performanceScan();
    aiScan();
    tradingScan();
  }
};

const run = profiles[profile];
if (!run) {
  console.error(`Unbekanntes QA-Profil: ${profile}`);
  process.exit(2);
}

run();

const blocking = results.filter((result) => result.severity === BLOCKING);
const warnings = results.filter((result) => result.severity === WARNING);

for (const result of [...blocking, ...warnings]) {
  const prefix = result.severity === BLOCKING ? "ERROR" : "WARN";
  const location = result.file ? ` ${result.file}${result.line ? `:${result.line}` : ""}` : "";
  console.log(`[${prefix}] ${result.area}${location} - ${result.message}`);
}

console.log(`QA static gate '${profile}': ${blocking.length} blocking, ${warnings.length} warning(s).`);
process.exit(blocking.length > 0 ? 1 : 0);
