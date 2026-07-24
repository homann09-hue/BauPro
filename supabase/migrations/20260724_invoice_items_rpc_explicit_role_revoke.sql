-- Redteam-Nachhaertung: insert_invoice_items_from_json ist ein interner
-- SECURITY-DEFINER-Helfer fuer create_invoice_with_items/update_invoice_with_items.
-- Direkte RPC-Ausfuehrung wuerde die Wrapper-Pruefungen umgehen.

revoke all on function public.insert_invoice_items_from_json(uuid, jsonb) from public;
revoke all on function public.insert_invoice_items_from_json(uuid, jsonb) from anon;
revoke all on function public.insert_invoice_items_from_json(uuid, jsonb) from authenticated;

select pg_notify('pgrst', 'reload schema');
