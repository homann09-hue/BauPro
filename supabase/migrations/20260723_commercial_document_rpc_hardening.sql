-- Redteam-Haertung: Die Summenberechnung fuer Angebote/Rechnungen ist ein
-- interner Trigger-Helfer. Direkte RPC-Aufrufe wuerden wegen SECURITY DEFINER
-- RLS umgehen und duerfen nicht fuer API-Rollen offen sein.

revoke all on function public.recalculate_commercial_document_totals(uuid) from public;
revoke all on function public.recalculate_commercial_document_totals(uuid) from anon;
revoke all on function public.recalculate_commercial_document_totals(uuid) from authenticated;

select pg_notify('pgrst', 'reload schema');
