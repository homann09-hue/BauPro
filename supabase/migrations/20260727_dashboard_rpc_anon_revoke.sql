-- Redteam-Nachhaertung:
-- get_dashboard_summary ist eine authentifizierte Dashboard-RPC mit eigener
-- Nutzer-/Firmenpruefung. Anonyme Aufrufe brauchen keinen Execute-Zugriff.

revoke all on function public.get_dashboard_summary(uuid, uuid, boolean, date) from public;
revoke all on function public.get_dashboard_summary(uuid, uuid, boolean, date) from anon;
grant execute on function public.get_dashboard_summary(uuid, uuid, boolean, date) to authenticated;

select pg_notify('pgrst', 'reload schema');
