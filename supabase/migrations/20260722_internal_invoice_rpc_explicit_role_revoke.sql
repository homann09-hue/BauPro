-- Redteam-Nachhaertung: Einige Projekte haben direkte EXECUTE-Grants auf den
-- Rollen anon/authenticated. PUBLIC-Revoke allein entfernt diese expliziten
-- Grants nicht. Die internen Helfer duerfen nur durch gepruefte Wrapper laufen.

revoke all on function public.generate_invoice_number(uuid, text) from anon;
revoke all on function public.generate_invoice_number(uuid, text) from authenticated;
revoke all on function public.recalculate_invoice_totals(uuid) from anon;
revoke all on function public.recalculate_invoice_totals(uuid) from authenticated;

select pg_notify('pgrst', 'reload schema');
