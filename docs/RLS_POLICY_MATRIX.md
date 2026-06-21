# RLS Policy Matrix

Automatisch erzeugt mit `node scripts/audit-rls-policies.mjs` aus `supabase/schema.sql`.

## Zusammenfassung

- Final wirksame Policies: 370
- Redteam-Fallback-Policies im finalen Schema: 105
- Tabellen/Operationen mit Fallback plus spezifischer Policy: 55
- Automatisch als exakt redundant erkannte Fallback-Policies: 0

Sicherheitsregel: Eine Fallback-Policy gilt nur dann als automatisch entfernbar, wenn eine spezifische Policy fuer dieselbe Tabelle und Operation exakt dieselbe normalisierte USING/WITH-CHECK-Bedingung hat. Alles andere bleibt unveraendert und ist manuell zu pruefen.

## Exakt Redundante Fallback-Policies

Keine exakt deckungsgleichen Fallback-Policies gefunden.

## Potenzielle Redundanz-Kandidaten

| Tabelle | Operation | Fallback | Spezifische Policies | Bewertung |
| --- | --- | --- | --- | --- |
| public.ai_actions | insert | redteam managers insert fallback | create own ai actions | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.ai_actions | select | redteam managers select fallback | read relevant ai actions | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.ai_actions | update | redteam managers update fallback | update own proposed ai actions | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.ai_job_drafts | insert | redteam managers insert fallback | managers create ai job drafts | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.ai_settings | select | redteam managers select fallback | company members read ai settings | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.ai_usage_logs | insert | redteam managers insert fallback | company members create own ai usage logs | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.bring_list_audit_log | insert | redteam managers insert fallback | create relevant bring list audit log | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.bring_list_audit_log | select | redteam managers select fallback | read relevant bring list audit log | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.bring_list_availability_snapshots | insert | redteam managers insert fallback | create relevant availability snapshots | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.bring_list_availability_snapshots | select | redteam managers select fallback | read relevant availability snapshots | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.bring_lists | insert | redteam managers insert fallback | create bring lists | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.bring_lists | select | redteam managers select fallback | read relevant bring lists | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.bring_lists | update | redteam managers update fallback | update relevant bring lists | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.digital_document_versions | insert | redteam managers insert fallback | members insert digital document versions | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.digital_document_versions | select | redteam managers select fallback | managers read digital document versions | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.digital_signatures | insert | redteam managers insert fallback | members insert own digital signatures | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.digital_signatures | select | redteam managers select fallback | members read permitted digital signatures | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.job_dimensions | select | redteam managers select fallback | read relevant job dimensions | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.job_material_calculations | select | redteam managers select fallback | read relevant job material calculations | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.jobsite_activity_events | insert | redteam managers insert fallback | members insert assigned jobsite activity | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.jobsite_activity_events | select | redteam managers select fallback | members read assigned jobsite activity | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.jobsite_documents | insert | redteam managers insert fallback | managers and foremen insert jobsite documents | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.jobsite_documents | select | redteam managers select fallback | members read assigned jobsite documents | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.jobsites | select | redteam managers select fallback | read relevant jobsites | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.material_alerts | insert | redteam managers insert fallback | create material alerts | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.material_alerts | select | redteam managers select fallback | read relevant material alerts | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.material_calculation_rules | select | redteam managers select fallback | members can read calculation rules | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.material_movements | select | redteam managers select fallback | read relevant material movements | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.material_reservations | select | redteam managers select fallback | read relevant material reservations | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.planning_assignments | select | redteam managers select fallback | members read planning assignments | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.planning_resources | select | redteam managers select fallback | members read planning resources | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.planning_weather_checks | select | redteam managers select fallback | read relevant planning weather checks | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.privacy_requests | insert | redteam managers insert fallback | create own privacy requests | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.privacy_requests | select | redteam managers select fallback | read own or managed privacy requests | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.profiles | select | redteam managers select fallback | members can read profiles in own company | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.purchase_suggestions | insert | redteam managers insert fallback | company members create purchase suggestions | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.report_photos | insert | redteam managers insert fallback | create report photos | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.report_photos | select | redteam managers select fallback | read relevant report photos | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.reports | insert | redteam managers insert fallback | create own reports | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.reports | select | redteam managers select fallback | read relevant reports | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.reports | update | redteam managers update fallback | update relevant reports | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.resource_documents | select | redteam managers select fallback | members read resource documents | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.tasks | select | redteam managers select fallback | read relevant tasks | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.tasks | update | redteam managers update fallback | update relevant tasks | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.time_entries | insert | redteam managers insert fallback | create time entries | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.time_entries | select | redteam managers select fallback | read relevant time entries | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.time_entries | update | redteam managers update fallback | update relevant time entries | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.time_entry_audit_log | insert | redteam managers insert fallback | create time audits | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.time_entry_audit_log | select | redteam managers select fallback | read relevant time audits | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.vehicle_materials | select | redteam managers select fallback | read own company vehicle materials | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.vehicles | select | redteam managers select fallback | read own company vehicles | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.voice_notes | insert | redteam managers insert fallback | create own voice notes | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.voice_notes | select | redteam managers select fallback | read own voice notes | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.voice_routing_rules | select | redteam managers select fallback | read active voice routing rules | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |
| public.work_orders | delete | redteam managers delete fallback | managers delete unsigned work orders | Manuell pruefen: spezifische Policy ist nicht deckungsgleich; Fallback bleibt erhalten und sichert ggf. noetige Chef/Admin-Basisrechte. |

## Beibehaltene Fallback-Only-Policies

Diese Policies bleiben unveraendert, weil keine spezifische Policy dieselbe Tabelle/Operation abdeckt. Sie sichern die Chef/Admin-Basisrechte fuer Mandantentabellen.

| Tabelle | Operation | Policy-Name | Grund |
| --- | --- | --- | --- |
| public.ai_actions | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.ai_job_drafts | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.ai_settings | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.ai_usage_logs | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.ai_usage_logs | update | redteam managers update fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.bring_list_audit_log | update | redteam managers update fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.calculation_settings | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.calculation_settings | insert | redteam managers insert fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.calculation_settings | update | redteam managers update fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.commercial_documents | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.company_audit_log | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.company_audit_log | update | redteam managers update fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.company_pricing_settings | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.customer_documents | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.customer_documents | insert | redteam managers insert fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.customer_documents | update | redteam managers update fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.customer_portal_events | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.customer_portal_events | insert | redteam managers insert fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.customer_portal_events | update | redteam managers update fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.digital_document_versions | update | redteam managers update fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.digital_signatures | update | redteam managers update fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.job_estimates | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.job_estimates | update | redteam managers update fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.jobsite_activity_events | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.jobsite_documents | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.material_alerts | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.material_movements | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.material_reservations | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.online_price_discoveries | update | redteam managers update fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.online_price_offers | update | redteam managers update fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.order_measurement_items | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.planning_assignments | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.planning_resources | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.planning_weather_checks | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.privacy_requests | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.purchase_suggestions | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.supplier_price_history | update | redteam managers update fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.time_entry_audit_log | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.time_entry_audit_log | update | redteam managers update fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.user_help_state | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.user_help_state | insert | redteam managers insert fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.user_help_state | select | redteam managers select fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.user_help_state | update | redteam managers update fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.voice_notes | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.voice_notes | update | redteam managers update fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.voice_routing_rules | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.voice_routing_rules | insert | redteam managers insert fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.voice_routing_rules | update | redteam managers update fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.work_order_versions | delete | redteam managers delete fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |
| public.work_order_versions | update | redteam managers update fallback | Keine spezifische Policy fuer dieselbe Operation vorhanden. |

## Vollstaendige Policy-Matrix

| Tabelle | Operation | Policy-Name | Bedingung (gekuerzt) | Redteam-Fallback |
| --- | --- | --- | --- | --- |
| public.ai_actions | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.ai_actions | insert | create own ai actions | CHECK: company_id = public.current_company_id() and user_id = auth.uid() | nein |
| public.ai_actions | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.ai_actions | select | read relevant ai actions | USING: company_id = public.current_company_id() and (public.can_manage_company() or user_id = auth.uid()) | nein |
| public.ai_actions | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.ai_actions | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.ai_actions | update | update own proposed ai actions | USING: company_id = public.current_company_id() and (public.can_manage_company() or user_id = auth.uid()) / CHECK: company_id = public.cu... | nein |
| public.ai_job_drafts | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.ai_job_drafts | insert | managers create ai job drafts | CHECK: company_id = public.current_company_id() and created_by = auth.uid() and public.can_manage_company() | nein |
| public.ai_job_drafts | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.ai_job_drafts | select | managers read ai job drafts | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.ai_job_drafts | update | managers update ai job drafts | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.ai_settings | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.ai_settings | insert | managers insert ai settings | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.ai_settings | select | company members read ai settings | USING: company_id = public.current_company_id() | nein |
| public.ai_settings | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.ai_settings | update | managers update ai settings | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.ai_usage_logs | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.ai_usage_logs | insert | company members create own ai usage logs | CHECK: company_id = public.current_company_id() and user_id = auth.uid() | nein |
| public.ai_usage_logs | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.ai_usage_logs | select | managers read ai usage logs | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.ai_usage_logs | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.bring_list_audit_log | insert | create relevant bring list audit log | CHECK: company_id = public.current_company_id() and actor_id = auth.uid() and exists ( select 1 from public.bring_lists bl where bl.id = ... | nein |
| public.bring_list_audit_log | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.bring_list_audit_log | select | read relevant bring list audit log | USING: exists ( select 1 from public.bring_lists bl where bl.id = bring_list_id and public.can_access_bring_list(bl.company_id, bl.job_id... | nein |
| public.bring_list_audit_log | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.bring_list_audit_log | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.bring_list_availability_snapshots | delete | managers delete availability snapshots | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.bring_list_availability_snapshots | insert | create relevant availability snapshots | CHECK: company_id = public.current_company_id() and exists ( select 1 from public.bring_lists bl where bl.id = bring_list_id and bl.compa... | nein |
| public.bring_list_availability_snapshots | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.bring_list_availability_snapshots | select | read relevant availability snapshots | USING: company_id = public.current_company_id() and ( public.can_manage_company() or exists ( select 1 from public.bring_lists bl where b... | nein |
| public.bring_list_availability_snapshots | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.bring_list_availability_snapshots | update | managers maintain availability snapshots | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.bring_list_items | delete | managers delete bring list items | USING: exists ( select 1 from public.bring_lists bl where bl.id = bring_list_id and bl.company_id = public.current_company_id() and publi... | nein |
| public.bring_list_items | insert | create relevant bring list items | CHECK: exists ( select 1 from public.bring_lists bl where bl.id = bring_list_id and public.can_access_bring_list(bl.company_id, bl.job_id... | nein |
| public.bring_list_items | select | read relevant bring list items | USING: exists ( select 1 from public.bring_lists bl where bl.id = bring_list_id and public.can_access_bring_list(bl.company_id, bl.job_id... | nein |
| public.bring_list_items | update | update relevant bring list items | USING: exists ( select 1 from public.bring_lists bl where bl.id = bring_list_id and public.can_access_bring_list(bl.company_id, bl.job_id... | nein |
| public.bring_lists | delete | managers delete bring lists | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.bring_lists | insert | create bring lists | CHECK: company_id = public.current_company_id() and (public.can_manage_company() or created_by = auth.uid()) | nein |
| public.bring_lists | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.bring_lists | select | read relevant bring lists | USING: public.can_access_bring_list(company_id, job_id, assigned_to, created_by) | nein |
| public.bring_lists | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.bring_lists | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.bring_lists | update | update relevant bring lists | USING: public.can_access_bring_list(company_id, job_id, assigned_to, created_by) / CHECK: public.can_access_bring_list(company_id, job_id... | nein |
| public.calculation_settings | all | managers manage calculation settings | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.calculation_settings | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.calculation_settings | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.calculation_settings | select | managers read calculation settings | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.calculation_settings | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.checklist_item_photos | insert | members insert checklist item photos | CHECK: company_id = public.current_company_id() and exists ( select 1 from public.jobsite_checklists c join public.jobsites j on j.id = c... | nein |
| public.checklist_item_photos | select | members read checklist item photos | USING: company_id = public.current_company_id() and archived_at is null and exists ( select 1 from public.jobsite_checklists c join publi... | nein |
| public.checklist_item_photos | update | managers update checklist item photos | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.checklist_template_items | insert | managers insert checklist template items | CHECK: public.can_manage_company() and company_id = public.current_company_id() and exists ( select 1 from public.checklist_templates t w... | nein |
| public.checklist_template_items | select | members read checklist template items | USING: archived_at is null and exists ( select 1 from public.checklist_templates t where t.id = template_id and t.archived_at is null and... | nein |
| public.checklist_template_items | update | managers update checklist template items | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.checklist_templates | insert | managers insert checklist templates | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.checklist_templates | select | members read checklist templates | USING: archived_at is null and active and (company_id is null or company_id = public.current_company_id()) | nein |
| public.checklist_templates | update | managers update checklist templates | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.commercial_document_items | delete | managers delete commercial document items | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.commercial_document_items | insert | managers insert commercial document items | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.commercial_document_items | select | managers read commercial document items | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.commercial_document_items | update | managers update commercial document items | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.commercial_documents | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.commercial_documents | insert | managers insert commercial documents | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.commercial_documents | select | managers read commercial documents | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.commercial_documents | update | managers update commercial documents | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.companies | select | company members can read own company | USING: id = public.current_company_id() | nein |
| public.companies | update | managers can update own company | USING: id = public.current_company_id() and public.can_manage_company() / CHECK: id = public.current_company_id() and public.can_manage_c... | nein |
| public.company_audit_log | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.company_audit_log | insert | managers create company audit log | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.company_audit_log | select | managers read company audit log | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.company_audit_log | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.company_pricing_settings | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.company_pricing_settings | insert | managers can insert pricing settings | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.company_pricing_settings | select | managers can read pricing settings | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.company_pricing_settings | update | managers can update pricing settings | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.customer_documents | all | managers write customer documents | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.customer_documents | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.customer_documents | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.customer_documents | select | managers read customer documents | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.customer_documents | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.customer_portal_events | all | managers write customer portal events | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.customer_portal_events | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.customer_portal_events | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.customer_portal_events | select | managers read customer portal events | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.customer_portal_events | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.customer_portal_messages | delete | managers delete customer portal messages | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.customer_portal_messages | insert | managers insert customer portal messages | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.customer_portal_messages | select | managers read customer portal messages | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.customer_portal_messages | update | managers update customer portal messages | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.customer_portal_tokens | delete | managers delete customer portal tokens | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.customer_portal_tokens | insert | managers insert customer portal tokens | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.customer_portal_tokens | select | managers read customer portal tokens | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.customer_portal_tokens | update | managers update customer portal tokens | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.customers | insert | managers can insert customers | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.customers | select | managers can read customers | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.customers | update | managers can update customers | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.defect_notifications | select | members read relevant defect notifications | USING: company_id = public.current_company_id() and archived_at is null and ( public.can_manage_company() or user_id = auth.uid() or exis... | nein |
| public.defect_notifications | update | members update own defect notifications | USING: company_id = public.current_company_id() and (public.can_manage_company() or user_id = auth.uid()) / CHECK: company_id = public.cu... | nein |
| public.defect_photos | insert | members insert relevant defect photos | CHECK: company_id = public.current_company_id() and exists ( select 1 from public.defects d join public.jobsites j on j.id = d.jobsite_id... | nein |
| public.defect_photos | select | members read relevant defect photos | USING: company_id = public.current_company_id() and archived_at is null and exists ( select 1 from public.defects d join public.jobsites ... | nein |
| public.defect_photos | update | managers update defect photos | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.defects | insert | members insert assigned jobsite defects | CHECK: company_id = public.current_company_id() and exists ( select 1 from public.jobsites j where j.id = jobsite_id and j.company_id = p... | nein |
| public.defects | select | members read relevant defects | USING: company_id = public.current_company_id() and archived_at is null and exists ( select 1 from public.jobsites j where j.id = jobsite... | nein |
| public.defects | update | members update relevant defects | USING: company_id = public.current_company_id() and archived_at is null and exists ( select 1 from public.jobsites j where j.id = jobsite... | nein |
| public.delivery_note_item_prices | insert | managers create delivery note item prices | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.delivery_note_item_prices | select | managers read delivery note item prices | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.delivery_note_item_prices | update | managers update delivery note item prices | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.delivery_note_items | insert | operators create delivery note items | CHECK: company_id = public.current_company_id() and public.current_role() in ('admin', 'chef', 'vorarbeiter') | nein |
| public.delivery_note_items | select | operators read delivery note items | USING: company_id = public.current_company_id() and public.current_role() in ('admin', 'chef', 'vorarbeiter') | nein |
| public.delivery_note_items | update | operators update delivery note items | USING: company_id = public.current_company_id() and public.current_role() in ('admin', 'chef', 'vorarbeiter') / CHECK: company_id = publi... | nein |
| public.delivery_notes | insert | operators create delivery notes | CHECK: company_id = public.current_company_id() and created_by = auth.uid() and public.current_role() in ('admin', 'chef', 'vorarbeiter') | nein |
| public.delivery_notes | select | operators read delivery notes | USING: company_id = public.current_company_id() and public.current_role() in ('admin', 'chef', 'vorarbeiter') | nein |
| public.delivery_notes | update | operators update delivery notes | USING: company_id = public.current_company_id() and public.current_role() in ('admin', 'chef', 'vorarbeiter') / CHECK: company_id = publi... | nein |
| public.digital_document_versions | insert | members insert digital document versions | CHECK: company_id = public.current_company_id() and (public.can_manage_company() or created_by = auth.uid()) | nein |
| public.digital_document_versions | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.digital_document_versions | select | managers read digital document versions | USING: company_id = public.current_company_id() and ( public.can_manage_company() or created_by = auth.uid() ) | nein |
| public.digital_document_versions | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.digital_document_versions | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.digital_signatures | insert | members insert own digital signatures | CHECK: company_id = public.current_company_id() and signer_user_id = auth.uid() and signer_role = public.current_role() | nein |
| public.digital_signatures | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.digital_signatures | select | members read permitted digital signatures | USING: company_id = public.current_company_id() and ( public.can_manage_company() or signer_user_id = auth.uid() or exists ( select 1 fro... | nein |
| public.digital_signatures | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.digital_signatures | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.inventory_items | insert | managers can insert inventory items | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.inventory_items | select | managers can read inventory items with prices | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.inventory_items | update | managers can update inventory items | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.inventory_locations | delete | managers can delete inventory locations | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.inventory_locations | insert | managers can insert inventory locations | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.inventory_locations | select | read own company inventory locations | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.inventory_locations | update | managers can update inventory locations | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.job_dimensions | insert | managers can insert job dimensions | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.job_dimensions | select | read relevant job dimensions | USING: company_id = public.current_company_id() and ( public.can_manage_company() or exists ( select 1 from public.orders o where o.id = ... | nein |
| public.job_dimensions | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.job_dimensions | update | managers can update job dimensions | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.job_estimate_items | insert | managers create job estimate items | CHECK: exists ( select 1 from public.job_estimates e where e.id = estimate_id and e.company_id = public.current_company_id() and public.c... | nein |
| public.job_estimate_items | select | managers read job estimate items | USING: exists ( select 1 from public.job_estimates e where e.id = estimate_id and e.company_id = public.current_company_id() and public.c... | nein |
| public.job_estimates | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.job_estimates | insert | managers create job estimates | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.job_estimates | select | managers read job estimates | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.job_estimates | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.job_material_calculation_items | delete | managers can delete calculation items | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.job_material_calculation_items | insert | managers can insert calculation items | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.job_material_calculation_items | select | managers can read priced calculation items | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.job_material_calculation_items | update | managers can update calculation items | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.job_material_calculations | delete | managers can delete job material calculations | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.job_material_calculations | insert | managers can insert job material calculations | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.job_material_calculations | select | read relevant job material calculations | USING: company_id = public.current_company_id() and ( public.can_manage_company() or exists ( select 1 from public.jobsites j where j.id ... | nein |
| public.job_material_calculations | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.job_material_calculations | update | managers can update job material calculations | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.job_material_requirements | insert | managers can insert order requirements | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.job_material_requirements | select | managers can read priced order requirements | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.job_material_requirements | update | managers can update order requirements | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.jobsite_activity_events | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.jobsite_activity_events | insert | members insert assigned jobsite activity | CHECK: company_id = public.current_company_id() and exists ( select 1 from public.jobsites j where j.id = jobsite_id and j.company_id = p... | nein |
| public.jobsite_activity_events | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.jobsite_activity_events | select | members read assigned jobsite activity | USING: company_id = public.current_company_id() and archived_at is null and exists ( select 1 from public.jobsites j where j.id = jobsite... | nein |
| public.jobsite_activity_events | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.jobsite_activity_events | update | managers archive jobsite activity | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.jobsite_checklist_items | insert | operators insert jobsite checklist items | CHECK: company_id = public.current_company_id() and exists ( select 1 from public.jobsite_checklists c join public.jobsites j on j.id = c... | nein |
| public.jobsite_checklist_items | select | members read jobsite checklist items | USING: company_id = public.current_company_id() and archived_at is null and exists ( select 1 from public.jobsite_checklists c join publi... | nein |
| public.jobsite_checklist_items | update | operators update jobsite checklist items | USING: company_id = public.current_company_id() and archived_at is null and exists ( select 1 from public.jobsite_checklists c join publi... | nein |
| public.jobsite_checklists | insert | operators insert jobsite checklists | CHECK: company_id = public.current_company_id() and exists ( select 1 from public.jobsites j where j.id = jobsite_id and j.company_id = p... | nein |
| public.jobsite_checklists | select | members read jobsite checklists | USING: company_id = public.current_company_id() and archived_at is null and exists ( select 1 from public.jobsites j where j.id = jobsite... | nein |
| public.jobsite_checklists | update | operators update jobsite checklists | USING: company_id = public.current_company_id() and archived_at is null and exists ( select 1 from public.jobsites j where j.id = jobsite... | nein |
| public.jobsite_documents | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.jobsite_documents | insert | managers and foremen insert jobsite documents | CHECK: company_id = public.current_company_id() and exists ( select 1 from public.jobsites j where j.id = jobsite_id and j.company_id = p... | nein |
| public.jobsite_documents | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.jobsite_documents | select | members read assigned jobsite documents | USING: company_id = public.current_company_id() and archived_at is null and exists ( select 1 from public.jobsites j where j.id = jobsite... | nein |
| public.jobsite_documents | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.jobsite_documents | update | managers update jobsite documents | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.jobsites | insert | managers can insert jobsites | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.jobsites | select | read relevant jobsites | USING: company_id = public.current_company_id() and (public.can_manage_company() or auth.uid() = any(assigned_employee_ids)) | nein |
| public.jobsites | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.jobsites | update | managers can update jobsites | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.material_alerts | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.material_alerts | insert | create material alerts | CHECK: company_id = public.current_company_id() | nein |
| public.material_alerts | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.material_alerts | select | read relevant material alerts | USING: company_id = public.current_company_id() and ( public.can_manage_company() or exists ( select 1 from public.bring_lists bl where b... | nein |
| public.material_alerts | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.material_alerts | update | managers update material alerts | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.material_aliases | select | authenticated can read material aliases | USING: exists ( select 1 from public.material_catalog c where c.id = catalog_item_id and c.active = true ) | nein |
| public.material_calculation_rules | delete | managers can delete calculation rules | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.material_calculation_rules | insert | managers can insert calculation rules | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.material_calculation_rules | select | members can read calculation rules | USING: active = true and (company_id is null or company_id = public.current_company_id()) | nein |
| public.material_calculation_rules | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.material_calculation_rules | update | managers can update calculation rules | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.material_catalog | select | managers can read priced material catalog | USING: active = true and public.can_manage_company() | nein |
| public.material_categories | select | authenticated can read active material categories | USING: active = true | nein |
| public.material_import_templates | select | authenticated can read material import templates | USING: active = true | nein |
| public.material_movements | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.material_movements | insert | managers create material movements | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.material_movements | select | read relevant material movements | USING: company_id = public.current_company_id() and ( public.can_manage_company() or created_by = auth.uid() or exists ( select 1 from pu... | nein |
| public.material_movements | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.material_movements | update | managers update material movements | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.material_reservations | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.material_reservations | insert | managers create material reservations | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.material_reservations | select | read relevant material reservations | USING: company_id = public.current_company_id() and ( public.can_manage_company() or exists ( select 1 from public.bring_lists bl where b... | nein |
| public.material_reservations | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.material_reservations | update | managers update material reservations | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.material_subcategories | select | authenticated can read active material subcategories | USING: active = true | nein |
| public.material_usage_reports | insert | members create material usage reports | CHECK: company_id = public.current_company_id() and reported_by = auth.uid() and ( public.can_manage_company() or exists ( select 1 from ... | nein |
| public.material_usage_reports | select | read relevant material usage reports | USING: company_id = public.current_company_id() and ( public.can_manage_company() or reported_by = auth.uid() or exists ( select 1 from p... | nein |
| public.material_usage_reports | update | operators update material usage reports | USING: company_id = public.current_company_id() and ( public.can_manage_company() or ( public.current_role() = 'vorarbeiter' and exists (... | nein |
| public.materials | insert | managers can insert materials | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.materials | select | managers can read materials with prices | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.materials | update | managers can update materials | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.online_price_discoveries | delete | managers can delete online price discoveries | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.online_price_discoveries | insert | managers can insert online price discoveries | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.online_price_discoveries | select | managers can read online price discoveries | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.online_price_discoveries | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.online_price_offers | delete | managers can delete online price offers | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.online_price_offers | insert | managers can insert online price offers | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.online_price_offers | select | managers can read online price offers | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.online_price_offers | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.order_measurement_items | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.order_measurement_items | insert | managers insert order measurement items | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.order_measurement_items | select | managers read order measurement items | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.order_measurement_items | update | managers update order measurement items | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.orders | insert | managers can insert orders | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.orders | select | managers can read orders | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.orders | update | managers can update orders | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.planning_assignments | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.planning_assignments | insert | managers insert planning assignments | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.planning_assignments | select | members read planning assignments | USING: company_id = public.current_company_id() and archived_at is null and ( public.can_manage_company() or exists ( select 1 from publi... | nein |
| public.planning_assignments | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.planning_assignments | update | managers update planning assignments | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.planning_resources | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.planning_resources | insert | managers insert planning resources | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.planning_resources | select | members read planning resources | USING: company_id = public.current_company_id() and archived_at is null and ( public.can_manage_company() or exists ( select 1 from publi... | nein |
| public.planning_resources | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.planning_resources | update | managers update planning resources | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.planning_weather_checks | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.planning_weather_checks | insert | managers insert planning weather checks | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.planning_weather_checks | select | read relevant planning weather checks | USING: company_id = public.current_company_id() and ( public.can_manage_company() or exists ( select 1 from public.profiles p where p.id ... | nein |
| public.planning_weather_checks | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.planning_weather_checks | update | managers update planning weather checks | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.privacy_requests | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.privacy_requests | insert | create own privacy requests | CHECK: company_id = public.current_company_id() and requester_id = auth.uid() | nein |
| public.privacy_requests | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.privacy_requests | select | read own or managed privacy requests | USING: company_id = public.current_company_id() and (public.can_manage_company() or requester_id = auth.uid()) | nein |
| public.privacy_requests | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.privacy_requests | update | managers update privacy requests | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.profiles | delete | managers can delete profiles | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.profiles | insert | managers can insert profiles | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.profiles | select | members can read profiles in own company | USING: company_id = public.current_company_id() | nein |
| public.profiles | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.profiles | update | managers can update profiles | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.purchase_suggestions | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.purchase_suggestions | insert | company members create purchase suggestions | CHECK: company_id = public.current_company_id() | nein |
| public.purchase_suggestions | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.purchase_suggestions | select | managers read purchase suggestions | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.purchase_suggestions | update | managers update purchase suggestions | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.report_photos | insert | create report photos | CHECK: company_id = public.current_company_id() and created_by = auth.uid() | nein |
| public.report_photos | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.report_photos | select | read relevant report photos | USING: company_id = public.current_company_id() and ( public.can_manage_company() or created_by = auth.uid() or exists ( select 1 from pu... | nein |
| public.report_photos | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.report_photos | update | managers update report photo release | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.reports | insert | create own reports | CHECK: company_id = public.current_company_id() and (public.can_manage_company() or (created_by = auth.uid() and auth.uid() = any(employe... | nein |
| public.reports | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.reports | select | read relevant reports | USING: company_id = public.current_company_id() and archived_at is null and (public.can_manage_company() or created_by = auth.uid() or au... | nein |
| public.reports | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.reports | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.reports | update | update relevant reports | USING: company_id = public.current_company_id() and archived_at is null and ( public.can_manage_company() or ( created_by = auth.uid() an... | nein |
| public.resource_documents | insert | managers insert resource documents | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.resource_documents | select | members read resource documents | USING: company_id = public.current_company_id() and archived_at is null | nein |
| public.resource_documents | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.resource_documents | update | managers update resource documents | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.supplier_integrations | delete | managers can delete supplier integrations | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.supplier_integrations | insert | managers can insert supplier integrations | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.supplier_integrations | select | managers can read supplier integrations | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.supplier_integrations | update | managers can update supplier integrations | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.supplier_offer_matches | delete | managers can delete supplier offer matches | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.supplier_offer_matches | insert | managers can insert supplier offer matches | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.supplier_offer_matches | select | managers can read supplier offer matches | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.supplier_offer_matches | update | managers can update supplier offer matches | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.supplier_offers | delete | managers can delete supplier offers | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.supplier_offers | insert | managers can insert supplier offers | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.supplier_offers | select | managers can read supplier offers | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.supplier_offers | update | managers can update supplier offers | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.supplier_price_history | delete | managers can delete supplier price history | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.supplier_price_history | insert | managers can insert supplier price history | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.supplier_price_history | select | managers can read supplier price history | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.supplier_price_history | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.suppliers | delete | managers can delete suppliers | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.suppliers | insert | managers can insert suppliers | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.suppliers | select | read own company suppliers | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.suppliers | update | managers can update suppliers | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.tasks | insert | managers can insert tasks | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.tasks | select | read relevant tasks | USING: company_id = public.current_company_id() and archived_at is null and (public.can_manage_company() or assigned_to = auth.uid()) | nein |
| public.tasks | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.tasks | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.tasks | update | update relevant tasks | USING: company_id = public.current_company_id() and archived_at is null and (public.can_manage_company() or assigned_to = auth.uid()) / C... | nein |
| public.time_entries | insert | create time entries | CHECK: company_id = public.current_company_id() and ( public.can_manage_company() or ( employee_id = auth.uid() and created_by = auth.uid... | nein |
| public.time_entries | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.time_entries | select | read relevant time entries | USING: company_id = public.current_company_id() and (public.can_manage_company() or employee_id = auth.uid()) | nein |
| public.time_entries | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.time_entries | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.time_entries | update | update relevant time entries | USING: company_id = public.current_company_id() and ( public.can_manage_company() or (employee_id = auth.uid() and status <> 'approved') ... | nein |
| public.time_entry_audit_log | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.time_entry_audit_log | insert | create time audits | CHECK: company_id = public.current_company_id() and changed_by = auth.uid() | nein |
| public.time_entry_audit_log | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.time_entry_audit_log | select | read relevant time audits | USING: company_id = public.current_company_id() and ( public.can_manage_company() or exists ( select 1 from public.time_entries te where ... | nein |
| public.time_entry_audit_log | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.time_entry_audit_log | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.time_report_entries | delete | managers can delete time report entries | USING: exists ( select 1 from public.time_reports tr where tr.id = time_report_id and tr.company_id = public.current_company_id() and pub... | nein |
| public.time_report_entries | insert | managers can insert time report entries | CHECK: exists ( select 1 from public.time_reports tr where tr.id = time_report_id and tr.company_id = public.current_company_id() and pub... | nein |
| public.time_report_entries | select | managers can read time report entries | USING: exists ( select 1 from public.time_reports tr where tr.id = time_report_id and tr.company_id = public.current_company_id() and pub... | nein |
| public.time_reports | delete | managers can delete time reports | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.time_reports | insert | managers can insert time reports | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.time_reports | select | managers can read time reports | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.time_reports | update | managers can update time reports | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.user_help_state | all | users manage own help state | USING: company_id = public.current_company_id() and user_id = auth.uid() / CHECK: company_id = public.current_company_id() and user_id = ... | nein |
| public.user_help_state | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.user_help_state | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.user_help_state | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.user_help_state | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.vehicle_materials | insert | managers can insert vehicle materials | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.vehicle_materials | select | read own company vehicle materials | USING: company_id = public.current_company_id() | nein |
| public.vehicle_materials | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.vehicle_materials | update | managers can update vehicle materials | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.vehicles | insert | managers can insert vehicles | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.vehicles | select | read own company vehicles | USING: company_id = public.current_company_id() | nein |
| public.vehicles | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.vehicles | update | managers can update vehicles | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.voice_notes | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.voice_notes | insert | create own voice notes | CHECK: company_id = public.current_company_id() and user_id = auth.uid() | nein |
| public.voice_notes | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.voice_notes | select | read own voice notes | USING: company_id = public.current_company_id() and (public.can_manage_company() or user_id = auth.uid()) | nein |
| public.voice_notes | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.voice_notes | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.voice_routing_rules | all | managers manage voice routing rules | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.voice_routing_rules | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.voice_routing_rules | insert | redteam managers insert fallback | CHECK: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.voice_routing_rules | select | read active voice routing rules | USING: active = true and (company_id is null or company_id = public.current_company_id()) | nein |
| public.voice_routing_rules | select | redteam managers select fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.voice_routing_rules | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.weather_snapshots | delete | managers can delete weather snapshots | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.weather_snapshots | insert | managers can insert weather snapshots | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.weather_snapshots | select | managers can read weather snapshots | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.weather_snapshots | update | managers can update weather snapshots | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| public.work_order_versions | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.work_order_versions | insert | managers insert work order versions | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.work_order_versions | select | managers read work order versions | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.work_order_versions | update | redteam managers update fallback | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | ja |
| public.work_orders | delete | managers delete unsigned work orders | USING: company_id = public.current_company_id() and public.can_manage_company() and status in ('draft', 'sent') | nein |
| public.work_orders | delete | redteam managers delete fallback | USING: company_id = public.current_company_id() and public.can_manage_company() | ja |
| public.work_orders | insert | managers insert work orders | CHECK: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.work_orders | select | managers read work orders | USING: company_id = public.current_company_id() and public.can_manage_company() | nein |
| public.work_orders | update | managers update work orders | USING: company_id = public.current_company_id() and public.can_manage_company() / CHECK: company_id = public.current_company_id() and pub... | nein |
| storage.objects | delete | managers can delete customer documents storage | USING: bucket_id = 'customer-documents' and (storage.foldername(name))[1] = public.current_company_id()::text and public.can_manage_compa... | nein |
| storage.objects | delete | managers delete checklist photos storage | USING: bucket_id = 'checklist-photos' and (storage.foldername(name))[1] = public.current_company_id()::text and public.can_manage_company() | nein |
| storage.objects | delete | managers delete defect photos storage | USING: bucket_id = 'defect-photos' and (storage.foldername(name))[1] = public.current_company_id()::text and public.can_manage_company() | nein |
| storage.objects | delete | managers delete jobsite documents storage | USING: bucket_id = 'jobsite-documents' and (storage.foldername(name))[1] = public.current_company_id()::text and public.can_manage_company() | nein |
| storage.objects | delete | managers delete resource documents storage | USING: bucket_id = 'resource-documents' and (storage.foldername(name))[1] = public.current_company_id()::text and public.can_manage_compa... | nein |
| storage.objects | delete | members can delete own report photos | USING: bucket_id = 'report-photos' and (storage.foldername(name))[1] = public.current_company_id()::text and (public.can_manage_company()... | nein |
| storage.objects | insert | managers and foremen upload jobsite documents storage | CHECK: bucket_id = 'jobsite-documents' and (storage.foldername(name))[1] = public.current_company_id()::text and (storage.foldername(name... | nein |
| storage.objects | insert | managers can upload customer documents storage | CHECK: bucket_id = 'customer-documents' and (storage.foldername(name))[1] = public.current_company_id()::text and (storage.foldername(nam... | nein |
| storage.objects | insert | managers upload resource documents storage | CHECK: bucket_id = 'resource-documents' and (storage.foldername(name))[1] = public.current_company_id()::text and public.can_manage_compa... | nein |
| storage.objects | insert | members can upload company report photos | CHECK: bucket_id = 'report-photos' and (storage.foldername(name))[1] = public.current_company_id()::text and (storage.foldername(name))[2... | nein |
| storage.objects | insert | members upload checklist photos storage | CHECK: bucket_id = 'checklist-photos' and (storage.foldername(name))[1] = public.current_company_id()::text and (storage.foldername(name)... | nein |
| storage.objects | insert | members upload defect photos storage | CHECK: bucket_id = 'defect-photos' and (storage.foldername(name))[1] = public.current_company_id()::text and (storage.foldername(name))[2... | nein |
| storage.objects | insert | operators upload delivery note storage | CHECK: bucket_id = 'delivery-notes' and (storage.foldername(name))[1] = public.current_company_id()::text and (storage.foldername(name))[... | nein |
| storage.objects | select | managers can read customer documents storage | USING: bucket_id = 'customer-documents' and (storage.foldername(name))[1] = public.current_company_id()::text and public.can_manage_compa... | nein |
| storage.objects | select | members can read company report photos | USING: bucket_id = 'report-photos' and (storage.foldername(name))[1] = public.current_company_id()::text | nein |
| storage.objects | select | members read assigned jobsite documents storage | USING: bucket_id = 'jobsite-documents' and (storage.foldername(name))[1] = public.current_company_id()::text and (storage.foldername(name... | nein |
| storage.objects | select | members read checklist photos storage | USING: bucket_id = 'checklist-photos' and (storage.foldername(name))[1] = public.current_company_id()::text and (storage.foldername(name)... | nein |
| storage.objects | select | members read defect photos storage | USING: bucket_id = 'defect-photos' and (storage.foldername(name))[1] = public.current_company_id()::text and (storage.foldername(name))[2... | nein |
| storage.objects | select | members read resource documents storage | USING: bucket_id = 'resource-documents' and (storage.foldername(name))[1] = public.current_company_id()::text and ( ( (storage.foldername... | nein |
| storage.objects | select | operators read delivery note storage | USING: bucket_id = 'delivery-notes' and (storage.foldername(name))[1] = public.current_company_id()::text and (storage.foldername(name))[... | nein |
