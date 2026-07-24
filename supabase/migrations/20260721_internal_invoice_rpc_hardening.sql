-- Redteam-Haertung: interne Invoice-Helfer duerfen nicht direkt ueber PostgREST/RPC
-- von normalen Nutzern aufgerufen werden. Erlaubt bleiben die geprueften Wrapper
-- create_invoice_with_items, update_invoice_with_items und get_invoice_stats.

revoke all on function public.generate_invoice_number(uuid, text) from public;
revoke all on function public.recalculate_invoice_totals(uuid) from public;

select pg_notify('pgrst', 'reload schema');
