-- Redteam-Nachhaertung:
-- Reine Trigger-Funktionen brauchen keine direkte RPC-Ausfuehrbarkeit.
-- Postgres-Trigger laufen weiterhin, auch wenn PUBLIC/anon/authenticated kein
-- EXECUTE-Recht auf die Trigger-Funktion besitzen. Dadurch wird die Data-API
-- Angriffsoberflaeche fuer SECURITY-DEFINER-Trigger reduziert.

revoke all on function public.assert_employee_permission_change_allowed() from public;
revoke all on function public.assert_employee_permission_change_allowed() from anon;
revoke all on function public.assert_employee_permission_change_allowed() from authenticated;

revoke all on function public.assert_role_change_allowed() from public;
revoke all on function public.assert_role_change_allowed() from anon;
revoke all on function public.assert_role_change_allowed() from authenticated;

revoke all on function public.create_defect_due_notification() from public;
revoke all on function public.create_defect_due_notification() from anon;
revoke all on function public.create_defect_due_notification() from authenticated;

revoke all on function public.create_defect_from_checklist_problem() from public;
revoke all on function public.create_defect_from_checklist_problem() from anon;
revoke all on function public.create_defect_from_checklist_problem() from authenticated;

revoke all on function public.create_task_for_checklist_problem() from public;
revoke all on function public.create_task_for_checklist_problem() from anon;
revoke all on function public.create_task_for_checklist_problem() from authenticated;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

revoke all on function public.recalculate_commercial_document_totals_trigger() from public;
revoke all on function public.recalculate_commercial_document_totals_trigger() from anon;
revoke all on function public.recalculate_commercial_document_totals_trigger() from authenticated;

revoke all on function public.recalculate_invoice_totals_trigger() from public;
revoke all on function public.recalculate_invoice_totals_trigger() from anon;
revoke all on function public.recalculate_invoice_totals_trigger() from authenticated;

revoke all on function public.validate_checklist_tenant() from public;
revoke all on function public.validate_checklist_tenant() from anon;
revoke all on function public.validate_checklist_tenant() from authenticated;

revoke all on function public.validate_defect_tenant() from public;
revoke all on function public.validate_defect_tenant() from anon;
revoke all on function public.validate_defect_tenant() from authenticated;

revoke all on function public.validate_resource_document_tenant() from public;
revoke all on function public.validate_resource_document_tenant() from anon;
revoke all on function public.validate_resource_document_tenant() from authenticated;

select pg_notify('pgrst', 'reload schema');
