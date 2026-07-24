#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const validateOnly = args.includes("--validate-config");
const profile = valueFor("--profile") || process.env.LOAD_PROFILE || "load";
const baseUrl = process.env.LOAD_BASE_URL || "http://localhost:3000";
const targetVus = Number(process.env.LOAD_TARGET_VUS || (profile === "stress" ? 2000 : 100));
const environment = process.env.LOAD_TEST_ENVIRONMENT || "";
const scriptPath = path.resolve(process.cwd(), "tests/load/baupro-2000-users.k6.js");
const summaryDir = path.resolve(process.cwd(), "test-results/load");
const knownProductionHosts = new Set(["bau-pro.vercel.app"]);

function valueFor(flag) {
  const index = args.indexOf(flag);
  if (index === -1) return "";
  return args[index + 1] || "";
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function parsedUrl(url) {
  try {
    return new URL(url);
  } catch {
    fail(`LOAD_BASE_URL ist keine gueltige URL: ${url}`);
  }
}

function isLocalTarget(url) {
  const target = parsedUrl(url);
  return ["localhost", "127.0.0.1", "::1"].includes(target.hostname);
}

function validateSafety() {
  const target = parsedUrl(baseUrl);
  const validProfiles = new Set(["load", "stress", "soak"]);
  if (!validProfiles.has(profile)) {
    fail(`Unbekanntes Lasttest-Profil "${profile}". Erlaubt sind: load, stress, soak.`);
  }

  if (!fs.existsSync(scriptPath)) {
    fail(`k6-Script fehlt: ${scriptPath}`);
  }

  if (knownProductionHosts.has(target.hostname)) {
    fail("Lasttests gegen die bekannte Production-Domain bau-pro.vercel.app sind blockiert.");
  }

  if (!environment && !validateOnly) {
    fail("Bitte LOAD_TEST_ENVIRONMENT=local|test|staging setzen. Lasttests duerfen nie versehentlich gegen echte Daten laufen.");
  }

  if (!isLocalTarget(baseUrl) && process.env.LOAD_ALLOW_REMOTE_TARGET !== "1" && !validateOnly) {
    fail("Remote-Lasttest blockiert. Setze LOAD_ALLOW_REMOTE_TARGET=1 nur fuer dedizierte Test-/Staging-Systeme.");
  }

  if (profile === "stress" && process.env.LOAD_TEST_ACKNOWLEDGE_2000_USERS !== "1" && !validateOnly) {
    fail("Der 2.000-User-Stresstest braucht LOAD_TEST_ACKNOWLEDGE_2000_USERS=1 als bewusste Bestaetigung.");
  }
}

function ensureK6Installed() {
  const result = spawnSync("k6", ["version"], { stdio: "ignore" });
  if (result.status === 0) return;

  fail(
    [
      "k6 ist nicht installiert oder nicht im PATH.",
      "Installation macOS: brew install k6",
      "Installation Linux: siehe https://grafana.com/docs/k6/latest/set-up/install-k6/",
      "Danach erneut ausfuehren: npm run test:load oder npm run test:stress"
    ].join("\n")
  );
}

validateSafety();

if (validateOnly) {
  console.log(
    JSON.stringify(
      {
        status: "ok",
        tool: "k6",
        script: path.relative(process.cwd(), scriptPath),
        profile,
        baseUrl,
        targetVus,
        environment: environment || "nicht gesetzt (nur Config-Check)",
        stressTestRequires: "LOAD_TEST_ENVIRONMENT=test und LOAD_TEST_ACKNOWLEDGE_2000_USERS=1"
      },
      null,
      2
    )
  );
  process.exit(0);
}

ensureK6Installed();
fs.mkdirSync(summaryDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const summaryFile = path.join(summaryDir, `k6-${profile}-${timestamp}.json`);

const env = {
  ...process.env,
  LOAD_PROFILE: profile,
  LOAD_TARGET_VUS: String(targetVus),
  LOAD_BASE_URL: baseUrl
};

const result = spawnSync(
  "k6",
  ["run", "--summary-export", summaryFile, scriptPath],
  {
    stdio: "inherit",
    env
  }
);

console.log(`\nLoad-Test-Zusammenfassung: ${summaryFile}`);
process.exit(result.status ?? 1);
