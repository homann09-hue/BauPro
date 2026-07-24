#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const profile = process.argv[2] || "fast";

const commonEnv = {
  ...process.env,
  CI: process.env.CI || "1"
};

function run(command, args, options = {}) {
  const label = [command, ...args].join(" ");
  console.log(`\n[qa] ${label}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...commonEnv, ...(options.env || {}) },
    shell: false
  });

  if (result.error) {
    console.error(`[qa] Konnte Befehl nicht starten: ${label}`);
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`[qa] Gate fehlgeschlagen: ${label}`);
    process.exit(result.status || 1);
  }
}

function npmScript(name, extraArgs = []) {
  run("npm", ["run", name, ...extraArgs]);
}

const profiles = {
  fast() {
    npmScript("typecheck");
    npmScript("lint");
    npmScript("test");
  },
  security() {
    run("node", ["scripts/qa/npm-audit-gate.mjs"]);
    npmScript("db:schema-check");
    npmScript("audit:rpc-hardening");
    run("node", ["scripts/qa/static-gates.mjs", "security"]);
    npmScript("redteam:release");
  },
  quality() {
    npmScript("typecheck");
    npmScript("lint");
    npmScript("test:coverage");
    npmScript("coverage:gate");
    run("node", ["scripts/qa/static-gates.mjs", "quality"]);
  },
  performance() {
    run("node", ["scripts/qa/static-gates.mjs", "performance"]);
    npmScript("test:load:check");
  },
  ai() {
    run("node", ["scripts/qa/static-gates.mjs", "ai"]);
  },
  trading() {
    run("node", ["scripts/qa/static-gates.mjs", "trading"]);
  },
  ci() {
    profiles.fast();
    profiles.security();
    profiles.performance();
    npmScript("build");
  },
  release() {
    profiles.quality();
    profiles.security();
    profiles.performance();
    profiles.ai();
    profiles.trading();
    run("node", ["scripts/qa/static-gates.mjs", "release"]);
    npmScript("build");
  },
  all() {
    profiles.release();
  }
};

const selected = profiles[profile];
if (!selected) {
  console.error(`Unbekanntes Check-Profil: ${profile}`);
  console.error(`Verfuegbar: ${Object.keys(profiles).join(", ")}`);
  process.exit(2);
}

selected();
console.log(`\n[qa] Check '${profile}' erfolgreich abgeschlossen.`);
