import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schemaPath = path.join(root, "supabase/schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");
const failOnTriggerGrants = process.argv.includes("--fail-on-trigger-grants");

const executeRoles = ["public", "anon", "authenticated"];
const triggerOnlyFunctions = [
  "assert_employee_permission_change_allowed",
  "assert_role_change_allowed",
  "create_defect_due_notification",
  "create_defect_from_checklist_problem",
  "create_task_for_checklist_problem",
  "handle_new_user",
  "recalculate_commercial_document_totals_trigger",
  "recalculate_invoice_totals_trigger",
  "validate_checklist_tenant",
  "validate_defect_tenant",
  "validate_resource_document_tenant"
];

function findMatchingEnd(source, startIndex) {
  const marker = "\n$$;";
  const endIndex = source.indexOf(marker, startIndex);
  return endIndex === -1 ? source.length : endIndex + marker.length;
}

function normalizeSql(value) {
  return value.replace(/\s+/g, " ").trim();
}

function extractFunctions(source) {
  const matches = [...source.matchAll(/create\s+or\s+replace\s+function\s+public\.([a-zA-Z0-9_]+)\s*\(([^)]*)\)/gi)];

  return matches.map((match) => {
    const start = match.index ?? 0;
    const end = findMatchingEnd(source, start);
    const body = source.slice(start, end);
    return {
      name: match[1],
      args: normalizeSql(match[2]),
      body,
      securityDefiner: /\bsecurity\s+definer\b/i.test(body),
      returnsTrigger: /\breturns\s+trigger\b/i.test(body)
    };
  });
}

function grantPattern(functionName, roleName) {
  return new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${functionName}\\s*\\([^)]*\\)\\s+to\\s+${roleName}\\b`, "i");
}

function revokePattern(functionName, roleName) {
  return new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${functionName}\\s*\\([^)]*\\)\\s+from\\s+${roleName}\\b`, "i");
}

function hasTriggerBinding(functionName) {
  return new RegExp(`execute\\s+function\\s+public\\.${functionName}\\s*\\(\\s*\\)`, "i").test(schema);
}

const rows = extractFunctions(schema)
  .filter((fn) => fn.securityDefiner)
  .sort((a, b) => a.name.localeCompare(b.name) || a.args.localeCompare(b.args))
  .map((fn) => {
    const grants = executeRoles.filter((role) => grantPattern(fn.name, role).test(schema));
    const revokes = executeRoles.filter((role) => revokePattern(fn.name, role).test(schema));
    const triggerOnly = fn.returnsTrigger || triggerOnlyFunctions.includes(fn.name);
    const issues = [];

    if (triggerOnlyFunctions.includes(fn.name) && !fn.returnsTrigger) {
      issues.push("trigger-only listet Nicht-Trigger");
    }
    if (triggerOnly && !hasTriggerBinding(fn.name)) {
      issues.push("Trigger-Bindung fehlt");
    }
    if (triggerOnly && grants.length > 0) {
      issues.push(`direkter Grant: ${grants.join(", ")}`);
    }
    if (triggerOnly && revokes.length !== executeRoles.length) {
      issues.push(`fehlender Revoke: ${executeRoles.filter((role) => !revokes.includes(role)).join(", ")}`);
    }

    return {
      name: fn.name,
      args: fn.args || "-",
      returnsTrigger: fn.returnsTrigger,
      triggerOnly,
      grants,
      revokes,
      issues
    };
  });

console.log("# SECURITY DEFINER Function Audit");
console.log("");
console.log("| Funktion | Argumente | Trigger | Trigger-only | Direkte Grants | Explizite Revokes | Befund |");
console.log("| --- | --- | --- | --- | --- | --- | --- |");

for (const row of rows) {
  console.log(
    `| \`${row.name}\` | \`${row.args.replaceAll("|", "\\|")}\` | ${row.returnsTrigger ? "ja" : "nein"} | ${
      row.triggerOnly ? "ja" : "nein"
    } | ${row.grants.length ? row.grants.join(", ") : "-"} | ${row.revokes.length ? row.revokes.join(", ") : "-"} | ${
      row.issues.length ? row.issues.join("; ") : "ok"
    } |`
  );
}

const blockingIssues = rows.flatMap((row) => row.issues.map((issue) => `${row.name}: ${issue}`));

if (failOnTriggerGrants && blockingIssues.length > 0) {
  console.error("\nSecurity-definer trigger audit failed:");
  for (const issue of blockingIssues) console.error(`- ${issue}`);
  process.exit(1);
}
