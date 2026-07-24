export const rpcExecuteRoles = ["public", "anon", "authenticated"] as const;

export const triggerOnlySecurityDefinerFunctions = [
  "assert_employee_permission_change_allowed",
  "assert_role_change_allowed",
  "create_defect_due_notification",
  "create_defect_from_checklist_problem",
  "create_task_for_checklist_problem",
  "handle_new_user",
  "record_material_movement_from_audit",
  "recalculate_commercial_document_totals_trigger",
  "recalculate_invoice_totals_trigger",
  "validate_checklist_tenant",
  "validate_defect_tenant",
  "validate_resource_document_tenant"
] as const;

export type RpcExecuteRole = (typeof rpcExecuteRoles)[number];
export type TriggerOnlySecurityDefinerFunction = (typeof triggerOnlySecurityDefinerFunctions)[number];

export function expectedFunctionRevoke(functionName: string, roleName: RpcExecuteRole) {
  return `revoke all on function public.${functionName}() from ${roleName}`;
}

export function collectTriggerHelperGrantIssues({
  schema,
  migration
}: {
  schema: string;
  migration: string;
}) {
  const issues: string[] = [];

  for (const functionName of triggerOnlySecurityDefinerFunctions) {
    if (!schema.includes(`create or replace function public.${functionName}()`)) {
      issues.push(`${functionName}: missing function definition`);
    }

    if (!schema.includes(`execute function public.${functionName}()`)) {
      issues.push(`${functionName}: missing trigger binding`);
    }

    if (schema.includes(`grant execute on function public.${functionName}() to authenticated`)) {
      issues.push(`${functionName}: direct authenticated grant found`);
    }

    for (const roleName of rpcExecuteRoles) {
      const expected = expectedFunctionRevoke(functionName, roleName);
      if (!schema.includes(expected)) {
        issues.push(`${functionName}: schema missing ${roleName} revoke`);
      }
      if (!migration.includes(expected)) {
        issues.push(`${functionName}: migration missing ${roleName} revoke`);
      }
    }
  }

  return issues;
}
