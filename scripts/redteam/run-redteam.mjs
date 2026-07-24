#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const selectedProfile = process.argv[2] || "full";
const BLOCKING = "blocking";
const WARNING = "warning";

const orderedProfiles = [
  "security",
  "auth",
  "roles",
  "multi-tenant",
  "api",
  "rls",
  "files",
  "photos",
  "pdf",
  "nfc",
  "offline",
  "pwa",
  "voice",
  "inventory",
  "time",
  "billing",
  "load",
  "chaos",
  "release"
];

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".sql", ".md", ".yml", ".yaml", ".json"]);
const ignoredDirs = new Set(["node_modules", ".git", ".next", "coverage", "public", "test-results", "playwright-report"]);
const findings = [];

function addFinding({ severity = BLOCKING, area, message, file = null }) {
  findings.push({ severity, area, message, file });
}

function rel(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, "/");
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
    if (!sourceExtensions.has(path.extname(entry.name))) continue;
    files.push(fullPath);
  }
  return files;
}

const files = walk(root);

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function fileExists(file) {
  return fs.existsSync(path.join(root, file));
}

function requireFile(file, area) {
  if (!fileExists(file)) {
    addFinding({ area, file, message: `Datei fehlt: ${file}` });
    return "";
  }
  return read(file);
}

function requireContains(file, needles, area, message) {
  const text = requireFile(file, area);
  if (!text) return;
  for (const needle of needles) {
    if (!text.includes(needle)) {
      addFinding({ area, file, message: `${message} Erwartet: ${needle}` });
    }
  }
}

function forbidContains(file, needles, area, message) {
  const text = requireFile(file, area);
  if (!text) return;
  for (const needle of needles) {
    if (text.includes(needle)) {
      addFinding({ area, file, message: `${message} Verboten: ${needle}` });
    }
  }
}

function requireAnyFileContains(candidates, needles, area, message) {
  const matching = candidates.filter(fileExists);
  if (matching.length === 0) {
    addFinding({ area, message: `${message} Keine Kandidatendatei gefunden: ${candidates.join(", ")}` });
    return;
  }

  const combined = matching.map(read).join("\n");
  for (const needle of needles) {
    if (!combined.includes(needle)) {
      addFinding({ area, message: `${message} Erwartet: ${needle}` });
    }
  }
}

function requireRepoContains(needle, area, message, matcher = () => true) {
  const found = files.some((file) => matcher(rel(file)) && fs.readFileSync(file, "utf8").includes(needle));
  if (!found) addFinding({ area, message: `${message} Erwartet irgendwo: ${needle}` });
}

function requirePackageScript(name, expectedPart) {
  const pkg = JSON.parse(read("package.json"));
  const script = pkg.scripts?.[name];
  if (!script) {
    addFinding({ area: "redteam:scripts", file: "package.json", message: `npm-Script fehlt: ${name}` });
    return;
  }
  if (expectedPart && !script.includes(expectedPart)) {
    addFinding({ area: "redteam:scripts", file: "package.json", message: `${name} muss '${expectedPart}' enthalten.` });
  }
}

function runCommand(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, ...env }
  });
  if (result.status !== 0) {
    addFinding({
      area: "redteam:command",
      message: `Befehl fehlgeschlagen: ${command} ${args.join(" ")}`
    });
  }
}

function securityGate() {
  requireContains("proxy.ts", [
    "Content-Security-Policy",
    "frame-ancestors 'none'",
    "requestOrigin && requestOrigin !== expectedOrigin",
    "await updateSession(request, requestHeaders)"
  ], "security:headers", "Proxy muss CSP, Origin-Check und Session-Refresh erzwingen.");

  requireContains("lib/security/rate-limit.ts", [
    "@upstash/ratelimit",
    "Ratelimit.slidingWindow",
    "process.env.NODE_ENV === \"production\"",
    "RATE_LIMIT_UNAVAILABLE_ERROR"
  ], "security:rate-limit", "Rate Limit muss Redis-basiert und in Production fail-closed sein.");

  forbidContains("lib/security/rate-limit.ts", [
    "Worker(",
    "SharedArrayBuffer",
    "Atomics.wait",
    "ev" + "al(",
    "new " + "Function" + "("
  ], "security:rate-limit", "Rate-Limiter darf keine blockierenden Worker-/Eval-Konstrukte nutzen.");

  requireContains("lib/security/errors.ts", ["SafeActionError", "safeErrorMessage"], "security:errors", "Fehler muessen sanitisiert werden.");
  requireContains("tests/unit/security-errors.test.ts", ["safeErrorMessage"], "security:tests", "Sanitizing braucht Regression-Tests.");
  requireContains("tests/unit/security-headers.test.ts", ["unsafe-eval", "unsafe-inline", "Content-Security-Policy"], "security:tests", "CSP-Hardening braucht Tests.");
  requireContains("tests/unit/rate-limit.test.ts", ["Production", "verschiedene Keys"], "security:tests", "Rate-Limit-Fail-Closed und Key-Isolation muessen getestet sein.");
}

function authGate() {
  requireContains("lib/auth.ts", [
    "safeGetUser",
    "withQueryTimeout",
    "bootstrap_my_profile",
    "active === false",
    "requireAppContext",
    "requireAdmin",
    "requireManager"
  ], "auth:context", "Auth-Kontext muss timeoutfaehig, bootstrapping-sicher und rollengetrennt sein.");

  requireContains("app/api/auth/login/route.ts", [
    "checkRateLimit",
    "login-ip",
    "loginProfile.active === false",
    "supabase.auth.signOut()"
  ], "auth:login", "Login muss rate-limitiert sein und deaktivierte Profile blockieren.");

  requireContains("tests/unit/protected-routes.test.ts", ["Dashboard", "login"], "auth:tests", "Geschuetzte Routen brauchen Tests.");
  requireContains("tests/unit/mfa.test.ts", ["TOTP", "totp"], "auth:mfa", "Privilegierte Accounts brauchen MFA-Testabdeckung.");
}

function rolesGate() {
  requireContains("lib/utils.ts", [
    "isAdmin",
    "isChef",
    "isForeman",
    "isEmployee",
    "isCustomer",
    "return role === \"chef\""
  ], "roles:model", "Rollen muessen explizit getrennt sein.");

  requireContains("lib/permissions.ts", [
    "adminOnlyPermissionKeys",
    "managerOnlyPermissionKeys",
    "isFullAccessRole",
    "role === \"chef\"",
    "isAdminOnlyPermission"
  ], "roles:permissions", "Berechtigungen muessen Admin-, Chef- und operative Rechte trennen.");

  requireContains("components/app-shell.tsx", [
    "context.isAdmin",
    "context.isChef",
    "Vorarbeiter",
    "Mitarbeiter"
  ], "roles:ui", "Navigation muss rollenbasiert aufgebaut sein.");

  requireContains("tests/unit/security-roles.test.ts", [
    "separates the system admin role",
    "keeps Mitarbeiter price-free",
    "systemadmins read all companies"
  ], "roles:tests", "Rollen- und Preis-Schutz brauchen Tests.");
}

function multiTenantGate() {
  requireContains("supabase/schema.sql", [
    "public.current_company_id()",
    "company_id",
    "force row level security",
    "inventory_items_public"
  ], "tenant:rls", "Mandantentrennung muss im Schema sichtbar erzwungen sein.");

  requireContains("lib/security/tenant-guards.ts", [
    "assertCustomerInCompany",
    "assertJobsiteInCompany",
    "companyId"
  ], "tenant:guards", "Server Actions brauchen zentrale Tenant-Guards.");

  requireContains("tests/integration/rls-schema.test.ts", [
    "force row level security",
    "inventory_items_public",
    "storage_path"
  ], "tenant:tests", "RLS-/Storage-Isolation braucht Tests.");
}

function apiGate() {
  requireContains("lib/actions/auth-actions.ts", [
    "safeErrorMessage",
    "checkRateLimit",
    "targetCompanyIdFromForm"
  ], "api:actions", "Server Actions muessen Fehler sanitisiert, gedrosselt und Tenant-Ziele validieren.");

  requireContains("tests/integration/server-action-hardening.test.ts", [
    "does not trust material usage FormData",
    "does not expose raw database errors",
    "only lets managers assign operational employees"
  ], "api:tests", "Server-Action-Bypass-Versuche brauchen Regression-Tests.");

  requireContains("tests/unit/api-route-guards.test.ts", [
    "getOptionalAppContext",
    "Nicht angemeldet.",
    "Keine Berechtigung."
  ], "api:tests", "API-Routen brauchen Auth-/Berechtigungs-Gates.");
}

function rlsGate() {
  requireContains("scripts/check-supabase-schema.mjs", [
    "force RLS",
    "storage_path",
    "inventory_items_public",
    "security_invoker"
  ], "rls:schema-check", "Schema-Check muss RLS, Views und Storage-Policies pruefen.");

  requireContains("supabase/schema.sql", [
    "security_invoker = true",
    "assert_role_change_allowed",
    "assert_employee_permission_change_allowed",
    "revoke all on function public.recalculate_commercial_document_totals"
  ], "rls:guards", "Schema braucht View-, Rollen- und RPC-Hardening.");
}

function filesGate() {
  requireContains("lib/security/uploads.ts", [
    "MAX_REPORT_PHOTO_BYTES",
    "MAX_CUSTOMER_DOCUMENT_BYTES",
    "validateReportPhoto",
    "validateCustomerDocument",
    "Uint8Array"
  ], "files:upload-validation", "Uploads brauchen Groessen-, MIME- und Magic-Byte-Pruefung.");

  requireContains("tests/unit/upload-security.test.ts", [
    "validates customer documents",
    "magic bytes",
    "MAX_REPORT_PHOTO_BYTES"
  ], "files:tests", "Upload-Missbrauch braucht Tests.");
}

function photosGate() {
  requireContains("components/forms/photo-capture-button.tsx", [
    "capture=\"environment\"",
    "accept=\"image/*\"",
    "Foto aufnehmen"
  ], "photos:mobile", "Fotoaufnahme muss mobile-first per Kamera funktionieren.");

  requireContains("supabase/schema.sql", [
    "members can read company report photos",
    "rp.storage_path = storage.objects.name",
    "members can upload company report photos"
  ], "photos:storage", "Foto-Storage muss Metadaten und Tenant-Pfade pruefen.");

  requireContains("tests/unit/download-security.test.ts", ["checkRateLimit"], "photos:download", "Downloads muessen gedrosselt sein.");
}

function pdfGate() {
  requireAnyFileContains([
    "app/(app)/berichte/[id]/pdf/route.ts",
    "app/(app)/orders/[id]/quote.pdf/route.ts",
    "app/api/invoices/[id]/pdf/route.ts",
    "app/(app)/angebote-rechnungen/[id]/pdf/route.ts"
  ], ["checkRateLimit", "getOptionalAppContext"], "pdf:routes", "PDF-Exports muessen Auth und Rate Limits nutzen.");

  requireContains("tests/unit/order-quote-pdf.test.ts", ["EK", "Marge"], "pdf:privacy", "Angebots-PDFs muessen interne Preisleaks testen.");
  requireContains("tests/unit/time-report-export.test.ts", ["PDF", "CSV"], "pdf:tests", "Stundenzettel-Exports brauchen Tests.");
}

function nfcGate() {
  requireContains("supabase/schema.sql", [
    "qr_code",
    "nfc_tag_id",
    "vehicles_company_qr_code_key",
    "planning_resources_company_nfc_tag_id_key"
  ], "nfc:preparedness", "QR/NFC-Vorbereitung fuer Ressourcen muss im Datenmodell eindeutig sein.");
  addFinding({
    severity: WARNING,
    area: "nfc:scope",
    message: "Aktive NFC-Hardware-Flows sind vorbereitet, aber ohne Browser-/Geraeteintegration nicht live angreifbar. Gate prueft aktuell Dokumentation/QR-NFC-Modell."
  });
}

function offlineGate() {
  requireContains("lib/offline/queue.ts", [
    "idb-keyval",
    "queueAction",
    "flushQueue",
    "MAX_FILE_BYTES"
  ], "offline:queue", "Offline-Queue muss begrenzt und flushbar sein.");

  requireContains("components/offline-queue-provider.tsx", [
    "useOfflineQueue",
    "Offline",
    "Langsame Verbindung"
  ], "offline:ux", "Offline-Zustand muss sichtbar sein.");

  requireContains("lib/offline/queue.ts", [
    "online",
    "flushQueue"
  ], "offline:flush", "Offline-Queue muss Online-Flush registrieren.");
}

function pwaGate() {
  requireContains("next.config.mjs", [
    "next-pwa",
    "NetworkOnly",
    "cacheStartUrl: false",
    "dynamicStartUrl: false"
  ], "pwa:cache", "PWA darf private API-Daten nicht stale cachen.");

  requireContains("tests/unit/pwa.test.ts", [
    "NetworkOnly",
    "manifest",
    "offline"
  ], "pwa:tests", "PWA-Cache und Installierbarkeit brauchen Tests.");
}

function voiceGate() {
  requireContains("components/voice/VoiceInputField.tsx", [
    "SpeechRecognition",
    "Übernehmen",
    "Verwerfen"
  ], "voice:component", "Spracheingabe muss bestaetigungspflichtig und fallback-sicher sein.");

  requireContains("lib/actions/voice-actions.ts", [
    "VOICE_SEARCH_TEXT_MAX_LENGTH",
    "checkRateLimit",
    "voiceSearchTerm"
  ], "voice:actions", "Voice-Actions brauchen Laengenlimit, Rate-Limit und Suchsanitizing.");
}

function inventoryGate() {
  requireContains("lib/actions/inventory-actions.ts", [
    'rpc("adjust_inventory_stock"',
    'rpc("reserve_inventory_for_jobsite"',
    "p_company_id: context.companyId",
    "context.canManage"
  ], "inventory:actions", "Lagerbuchungen und Reservierungen muessen atomar und rollenbewusst laufen.");

  requireContains("supabase/schema.sql", [
    "for update",
    "confirm_material_usage_report",
    "reserve_inventory_for_jobsite",
    "material_movements"
  ], "inventory:db", "Lager-RPCs muessen Race Conditions per Postgres absichern.");

  requireContains("tests/unit/material-movements.test.ts", [
    "rejects invalid quantities",
    "Menge muss größer als 0 sein."
  ], "inventory:tests", "Bestands-/Mengen-Schutz braucht Tests.");
}

function timeGate() {
  requireContains("lib/actions/time-tracking-actions.ts", [
    "assertTimeEntryDateAllowed",
    "safeErrorMessage",
    "break_minutes",
    "net_minutes"
  ], "time:actions", "Zeiterfassung braucht Validierung und sanitisiertes Error Handling.");

  requireContains("tests/unit/time-tracking.test.ts", ["Arbeitsende", "Pause"], "time:tests", "Zeiterfassung braucht Edge-Case-Tests.");
  requireContains("tests/unit/time-daily.test.ts", ["daily time tracking access"], "time:daily", "Chef-Tagesstunden brauchen Tests.");
}

function billingGate() {
  requireContains("app/api/stripe/webhook/route.ts", [
    "constructWebhookEvent",
    "stripe_webhook_events",
    "checkout.session.completed",
    "customer.subscription.deleted"
  ], "billing:webhook", "Stripe-Webhooks muessen signiert und idempotent sein.");

  requireContains("lib/billing/plans.ts", [
    "checkUserLimit",
    "checkAiLimit",
    "isFeatureEnabled"
  ], "billing:limits", "Abo-Limits muessen serverseitig erzwungen werden.");

  requireContains("tests/unit/billing.test.ts", ["stripe_webhook_events", "checkAiLimit"], "billing:tests", "Billing- und KI-Limits brauchen Tests.");
}

function loadGate() {
  requireContains("scripts/run-k6-load-test.mjs", [
    "--validate-config",
    "LOAD_TEST_ENVIRONMENT=local|test|staging",
    "LOAD_TEST_ACKNOWLEDGE_2000_USERS=1",
    "bau-pro.vercel.app"
  ], "load:safety", "Load-/Stress-Runner muss Production blockieren und 2.000 Nutzer bewusst bestaetigen.");

  requireContains("tests/load/baupro-2000-users.k6.js", [
    "2.000-User-Stresstest",
    "Login",
    "operative Rollen sehen keine Preisfelder",
    "baupro_tenant_leak_checks"
  ], "load:scenario", "Lasttest muss realistische Rollen-, Auth- und Tenant-Pruefungen enthalten.");

  requireContains("docs/LOAD_AND_E2E_TESTING.md", [
    "2.000-User-Stresstest",
    "LOAD_BASE_URL",
    "Ergebnisbericht"
  ], "load:docs", "Lasttest-Doku muss Start und Ergebnisbericht erklaeren.");

  runCommand("npm", ["run", "test:load:check"]);
}

function chaosGate() {
  requireContains("scripts/chaos-test.mjs", [
    "AbortController",
    "protectedRoutes",
    "apiCases",
    "BauProChaosTest/1.0"
  ], "chaos:harness", "Chaos-Harness muss nicht-destruktive Timeout/API/Route-Checks enthalten.");

  requireContains("docs/CHAOS_ENGINEERING.md", [
    "nicht-destruktiv",
    "Rollback-Plan",
    "npm run test:chaos"
  ], "chaos:docs", "Chaos-Doku muss Grenzen und Rollback erklaeren.");

  if (process.env.REDTEAM_LIVE_CHAOS === "1") {
    runCommand("npm", ["run", "test:chaos"]);
  } else {
    addFinding({
      severity: WARNING,
      area: "chaos:live",
      message: "Live-Chaos-Probes wurden uebersprungen. Setze REDTEAM_LIVE_CHAOS=1 gegen lokale/staging App, wenn ein Server laeuft."
    });
  }
}

function releaseGate() {
  for (const scriptName of orderedProfiles.map((profile) => `redteam:${profile}`)) {
    requirePackageScript(scriptName, "scripts/redteam/run-redteam.mjs");
  }
  requirePackageScript("redteam:full", "scripts/redteam/run-redteam.mjs full");
  requireContains("scripts/qa/run-check.mjs", ["npmScript(\"redteam:release\")"], "release:qa", "Release-Gate muss Redteam-Release-Gate ausfuehren.");
  requireContains(".github/workflows/ci.yml", ["npm run check:ci", "npm run check:release"], "release:ci", "CI muss PR- und Main-Gates ausfuehren.");
  requireContains("README.md", ["npm run redteam:full", "Redteam"], "release:docs", "README muss Redteam-Befehle dokumentieren.");
  const tradingFiles = files.filter((file) => /trading|market-data|backtest|portfolio|trade-signal|trading-signal/i.test(rel(file)));
  if (tradingFiles.length > 0) {
    requireRepoContains("Keine Anlageberatung", "release:ai", "KI-/Trading-Warnhinweise muessen dokumentiert sein", (file) => file.endsWith(".md") || file.endsWith(".ts") || file.endsWith(".tsx"));
  } else {
    addFinding({
      severity: WARNING,
      area: "release:ai",
      message: "Keine Trading-/Marktdatenmodule erkannt; Keine-Anlageberatung-Gate ist fuer BauPro aktuell nicht anwendbar."
    });
  }
}

const gates = {
  security: securityGate,
  auth: authGate,
  roles: rolesGate,
  "multi-tenant": multiTenantGate,
  api: apiGate,
  rls: rlsGate,
  files: filesGate,
  photos: photosGate,
  pdf: pdfGate,
  nfc: nfcGate,
  offline: offlineGate,
  pwa: pwaGate,
  voice: voiceGate,
  inventory: inventoryGate,
  time: timeGate,
  billing: billingGate,
  load: loadGate,
  chaos: chaosGate,
  release: releaseGate
};

function runProfile(profile) {
  const gate = gates[profile];
  if (!gate) {
    console.error(`Unbekanntes Redteam-Profil: ${profile}`);
    console.error(`Verfuegbar: ${[...orderedProfiles, "full"].join(", ")}`);
    process.exit(2);
  }
  console.log(`\n[redteam] ${profile}`);
  gate();
}

const profilesToRun = selectedProfile === "full" ? orderedProfiles : [selectedProfile];
for (const profile of profilesToRun) runProfile(profile);

const blocking = findings.filter((finding) => finding.severity === BLOCKING);
const warnings = findings.filter((finding) => finding.severity === WARNING);

for (const finding of [...blocking, ...warnings]) {
  const prefix = finding.severity === BLOCKING ? "ERROR" : "WARN";
  const location = finding.file ? ` ${finding.file}` : "";
  console.log(`[${prefix}] ${finding.area}${location} - ${finding.message}`);
}

console.log(`\nRedteam '${selectedProfile}': ${blocking.length} blocking, ${warnings.length} warning(s).`);
process.exit(blocking.length > 0 ? 1 : 0);
