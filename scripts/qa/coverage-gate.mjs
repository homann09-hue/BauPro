#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const summaryPath = path.join(root, "coverage", "coverage-summary.json");
const minLines = Number(process.env.COVERAGE_LINES_MIN || "50");
const minBranches = Number(process.env.COVERAGE_BRANCHES_MIN || "0");
const minFunctions = Number(process.env.COVERAGE_FUNCTIONS_MIN || "0");
const minStatements = Number(process.env.COVERAGE_STATEMENTS_MIN || "0");

function fail(message) {
  console.error(`[coverage] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(summaryPath)) {
  if (process.env.CI_COVERAGE_REQUIRED === "true") {
    fail("Coverage-Datei fehlt. Fuehre zuerst npm run test:coverage aus.");
  }

  console.warn("[coverage] coverage/coverage-summary.json fehlt. Gate wird lokal als Warnung gewertet.");
  process.exit(0);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
const total = summary.total;

if (
  typeof total?.lines?.pct !== "number" ||
  typeof total?.branches?.pct !== "number" ||
  typeof total?.functions?.pct !== "number" ||
  typeof total?.statements?.pct !== "number"
) {
  fail("Coverage-Summary hat ein unerwartetes Format.");
}

const checks = [
  ["Lines", total.lines.pct, minLines],
  ["Branches", total.branches.pct, minBranches],
  ["Functions", total.functions.pct, minFunctions],
  ["Statements", total.statements.pct, minStatements]
];

for (const [label, actual, minimum] of checks) {
  if (actual < minimum) {
    fail(`${label}-Coverage ${actual}% liegt unter Zielwert ${minimum}%.`);
  }
}

console.log(
  `[coverage] OK: Lines ${total.lines.pct}%, Branches ${total.branches.pct}%, Functions ${total.functions.pct}%, Statements ${total.statements.pct}%.`
);
