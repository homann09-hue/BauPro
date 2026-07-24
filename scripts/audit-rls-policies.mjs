import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schemaPath = path.join(root, "supabase/schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");

const REDTEAM_CONDITION = "company_id = public.current_company_id() and public.can_manage_company()";

function compact(value, maxLength = 140) {
  const oneLine = value.replace(/\s+/g, " ").trim();
  return oneLine.length > maxLength ? `${oneLine.slice(0, maxLength - 3)}...` : oneLine;
}

function markdown(value) {
  return compact(value).replaceAll("|", "\\|");
}

function normalized(value) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim()
    .toLowerCase();
}

function extractParenthesized(source, openParenIndex) {
  let depth = 0;
  let inSingleQuote = false;

  for (let index = openParenIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === "'" && next === "'") {
      index += 1;
      continue;
    }

    if (char === "'") {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (inSingleQuote) continue;

    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return source.slice(openParenIndex + 1, index);
    }
  }

  return "";
}

function clause(source, keyword) {
  const match = new RegExp(`${keyword}\\s*\\(`, "i").exec(source);
  if (!match) return "";
  return extractParenthesized(source, (match.index ?? 0) + match[0].lastIndexOf("("));
}

function policyCondition(policy) {
  if (policy.using && policy.check) return `USING: ${policy.using} / CHECK: ${policy.check}`;
  if (policy.using) return `USING: ${policy.using}`;
  if (policy.check) return `CHECK: ${policy.check}`;
  return "keine Bedingung";
}

function conditionSignature(policy) {
  return JSON.stringify({
    using: normalized(policy.using),
    check: normalized(policy.check)
  });
}

function fallbackPoliciesFor(table, position) {
  return [
    {
      position,
      kind: "create",
      policy: {
        table,
        operation: "select",
        name: "redteam managers select fallback",
        using: REDTEAM_CONDITION,
        check: "",
        source: "dynamic-redteam-fallback"
      }
    },
    {
      position,
      kind: "create",
      policy: {
        table,
        operation: "insert",
        name: "redteam managers insert fallback",
        using: "",
        check: REDTEAM_CONDITION,
        source: "dynamic-redteam-fallback"
      }
    },
    {
      position,
      kind: "create",
      policy: {
        table,
        operation: "update",
        name: "redteam managers update fallback",
        using: REDTEAM_CONDITION,
        check: REDTEAM_CONDITION,
        source: "dynamic-redteam-fallback"
      }
    },
    {
      position,
      kind: "create",
      policy: {
        table,
        operation: "delete",
        name: "redteam managers delete fallback",
        using: REDTEAM_CONDITION,
        check: "",
        source: "dynamic-redteam-fallback"
      }
    }
  ];
}

function tablePolicyKey(table, name) {
  return `${table}::${name}`;
}

function tableOperationKey(table, operation) {
  return `${table}::${operation}`;
}

const tables = [];
const tableRegex = /create table if not exists public\.([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\n\);/g;
let tableMatch;
while ((tableMatch = tableRegex.exec(schema))) {
  tables.push({
    table: `public.${tableMatch[1]}`,
    position: tableMatch.index,
    hasCompanyId: /\bcompany_id\b/i.test(tableMatch[2])
  });
}

const dynamicFallbackPosition = schema.indexOf('create policy "redteam managers select fallback" on %I.%I');
const events = [];

const createPolicyRegex = /create policy "([^"]+)"\s+on\s+([a-zA-Z0-9_.]+)\s+for\s+(select|insert|update|delete|all)\s+to\s+authenticated([\s\S]*?);/gi;
let createMatch;
while ((createMatch = createPolicyRegex.exec(schema))) {
  const [, name, table, operation, tail] = createMatch;

  if (table.includes("%I")) continue;

  events.push({
    position: createMatch.index,
    kind: "create",
    policy: {
      table,
      operation: operation.toLowerCase(),
      name,
      using: clause(tail, "using"),
      check: clause(tail, "with\\s+check"),
      source: "explicit"
    }
  });
}

if (dynamicFallbackPosition >= 0) {
  for (const table of tables.filter((entry) => entry.hasCompanyId && entry.position < dynamicFallbackPosition)) {
    events.push(...fallbackPoliciesFor(table.table, dynamicFallbackPosition));
  }
}

const dropPolicyRegex = /drop policy if exists "([^"]+)" on ([a-zA-Z0-9_.]+);/gi;
let dropMatch;
while ((dropMatch = dropPolicyRegex.exec(schema))) {
  events.push({
    position: dropMatch.index,
    kind: "drop",
    table: dropMatch[2],
    name: dropMatch[1]
  });
}

events.sort((left, right) => left.position - right.position || (left.kind === "drop" ? -1 : 1));

const finalPoliciesByName = new Map();
for (const event of events) {
  if (event.kind === "drop") {
    finalPoliciesByName.delete(tablePolicyKey(event.table, event.name));
  } else {
    finalPoliciesByName.set(tablePolicyKey(event.policy.table, event.policy.name), event.policy);
  }
}

const policies = [...finalPoliciesByName.values()].sort((left, right) => {
  return left.table.localeCompare(right.table) || left.operation.localeCompare(right.operation) || left.name.localeCompare(right.name);
});

const byTableOperation = new Map();
for (const policy of policies) {
  const key = tableOperationKey(policy.table, policy.operation);
  const list = byTableOperation.get(key) ?? [];
  list.push(policy);
  byTableOperation.set(key, list);
}

const overlapRows = [];
const exactRedundantFallbacks = [];
for (const [key, group] of byTableOperation) {
  const fallback = group.find((policy) => policy.name.startsWith("redteam managers "));
  if (!fallback) continue;

  const specific = group.filter((policy) => !policy.name.startsWith("redteam managers "));
  if (specific.length === 0) continue;

  const exactMatches = specific.filter((policy) => conditionSignature(policy) === conditionSignature(fallback));
  const [table, operation] = key.split("::");
  overlapRows.push({
    table,
    operation,
    fallback: fallback.name,
    specific: specific.map((policy) => policy.name),
    exactMatches: exactMatches.map((policy) => policy.name),
    status:
      exactMatches.length > 0
        ? "Automatisch redundant: gleiche Operation und exakt gleiche USING/WITH-CHECK-Bedingung."
        : "Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef-Basisrechte."
  });

  if (exactMatches.length > 0) {
    exactRedundantFallbacks.push({
      table,
      operation,
      fallback: fallback.name,
      matchedBy: exactMatches[0].name
    });
  }
}

if (process.argv.includes("--redundant-drops")) {
  console.log("-- Automatisch erzeugt mit: node scripts/audit-rls-policies.mjs --redundant-drops");
  console.log("-- Entfernt nur Fallback-Policies, deren Bedingung exakt von einer spezifischen Policy gleicher Operation gedeckt ist.");
  for (const row of exactRedundantFallbacks) {
    console.log(`drop policy if exists "${row.fallback}" on ${row.table}; -- ${row.operation}, gedeckt durch "${row.matchedBy}"`);
  }
  process.exit(0);
}

const lines = [];
lines.push("# RLS Policy Matrix");
lines.push("");
lines.push("Automatisch erzeugt mit `node scripts/audit-rls-policies.mjs` aus `supabase/schema.sql`.");
lines.push("");
lines.push("## Zusammenfassung");
lines.push("");
lines.push(`- Final wirksame Policies: ${policies.length}`);
lines.push(`- Redteam-Fallback-Policies im finalen Schema: ${policies.filter((policy) => policy.name.startsWith("redteam managers ")).length}`);
lines.push(`- Tabellen/Operationen mit Fallback plus spezifischer Policy: ${overlapRows.length}`);
lines.push(`- Automatisch als exakt redundant erkannte Fallback-Policies: ${exactRedundantFallbacks.length}`);
lines.push("");
lines.push("Sicherheitsregel: Eine Fallback-Policy gilt nur dann als automatisch entfernbar, wenn eine spezifische Policy fuer dieselbe Tabelle und Operation exakt dieselbe normalisierte USING/WITH-CHECK-Bedingung hat. Alles andere bleibt unveraendert und ist manuell zu pruefen.");
lines.push("");
lines.push("## Exakt Redundante Fallback-Policies");
lines.push("");
if (exactRedundantFallbacks.length === 0) {
  lines.push("Keine exakt deckungsgleichen Fallback-Policies gefunden.");
} else {
  lines.push("| Tabelle | Operation | Redundante Fallback-Policy | Gedeckt durch |");
  lines.push("| --- | --- | --- | --- |");
  for (const row of exactRedundantFallbacks) {
    lines.push(`| ${row.table} | ${row.operation} | ${row.fallback} | ${row.matchedBy} |`);
  }
}
lines.push("");
lines.push("## Potenzielle Redundanz-Kandidaten");
lines.push("");
if (overlapRows.length === 0) {
  lines.push("Keine Fallback-/Spezialpolicy-Ueberlappungen gefunden.");
} else {
  lines.push("| Tabelle | Operation | Fallback | Spezifische Policies | Bewertung |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const row of overlapRows) {
    lines.push(`| ${row.table} | ${row.operation} | ${row.fallback} | ${markdown(row.specific.join(", "))} | ${markdown(row.status)} |`);
  }
}
lines.push("");
lines.push("## Beibehaltene Fallback-Only-Policies");
lines.push("");
const fallbackOnlyRows = policies
  .filter((policy) => policy.name.startsWith("redteam managers "))
  .filter((policy) => {
    const group = byTableOperation.get(tableOperationKey(policy.table, policy.operation)) ?? [];
    return group.filter((entry) => !entry.name.startsWith("redteam managers ")).length === 0;
  });

if (fallbackOnlyRows.length === 0) {
  lines.push("Keine Fallback-only Policies im finalen Schema.");
} else {
  lines.push("Diese Policies bleiben unveraendert, weil keine spezifische Policy dieselbe Tabelle/Operation abdeckt. Sie sichern die Chef-Basisrechte fuer Mandantentabellen.");
  lines.push("");
  lines.push("| Tabelle | Operation | Policy-Name | Grund |");
  lines.push("| --- | --- | --- | --- |");
  for (const policy of fallbackOnlyRows) {
    lines.push(`| ${policy.table} | ${policy.operation} | ${policy.name} | Keine spezifische Policy fuer dieselbe Operation vorhanden. |`);
  }
}
lines.push("");
lines.push("## Vollstaendige Policy-Matrix");
lines.push("");
lines.push("| Tabelle | Operation | Policy-Name | Bedingung (gekuerzt) | Redteam-Fallback |");
lines.push("| --- | --- | --- | --- | --- |");
for (const policy of policies) {
  lines.push(
    `| ${policy.table} | ${policy.operation} | ${markdown(policy.name)} | ${markdown(policyCondition(policy))} | ${
      policy.name.startsWith("redteam managers ") ? "ja" : "nein"
    } |`
  );
}

console.log(lines.join("\n"));
