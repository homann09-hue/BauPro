#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const result = spawnSync("npm", ["audit", "--audit-level=high", "--json"], {
  encoding: "utf8",
  shell: false
});

const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();

function hardFail(message) {
  console.error(`[audit] ${message}`);
  if (output) console.error(output);
  process.exit(1);
}

function warn(message) {
  console.warn(`[audit] WARN: ${message}`);
  if (output) console.warn(output);
  process.exit(0);
}

if (result.error) {
  hardFail(`npm audit konnte nicht gestartet werden: ${result.error.message}`);
}

if (result.status === 0) {
  console.log("[audit] OK: keine High/Critical Dependency-Findings.");
  process.exit(0);
}

const networkFailure = /ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT|audit endpoint returned an error|registry\.npmjs\.org/i.test(output);
const onlineAuditRequired = process.env.GITHUB_ACTIONS === "true" || process.env.REQUIRE_ONLINE_AUDIT === "true";

if (networkFailure && !onlineAuditRequired) {
  warn("npm audit konnte die Registry nicht erreichen. In GitHub Actions oder mit REQUIRE_ONLINE_AUDIT=true ist das blockierend.");
}

try {
  const parsed = JSON.parse(result.stdout || "{}");
  const metadata = parsed.metadata?.vulnerabilities;
  const high = Number(metadata?.high ?? 0);
  const critical = Number(metadata?.critical ?? 0);

  if (high > 0 || critical > 0) {
    hardFail(`High/Critical Dependency-Findings gefunden: high=${high}, critical=${critical}.`);
  }
} catch {
  // Wenn npm audit keinen parsebaren JSON-Report liefert, bleibt es ein harter
  // Fehler, ausser es war der oben behandelte lokale Netzwerkfall.
}

hardFail("npm audit ist fehlgeschlagen.");
