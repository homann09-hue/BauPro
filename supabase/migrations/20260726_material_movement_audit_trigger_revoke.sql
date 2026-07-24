-- Redteam-Nachhaertung:
-- record_material_movement_from_audit ist ein interner SECURITY-DEFINER-
-- Trigger-Helfer fuer Materialbewegungen aus Audit-Events. Direkte RPC-
-- Ausfuehrung wird entzogen; der Trigger selbst bleibt funktionsfaehig.

do $$
begin
  if to_regprocedure('public.record_material_movement_from_audit()') is not null then
    revoke all on function public.record_material_movement_from_audit() from public;
    revoke all on function public.record_material_movement_from_audit() from anon;
    revoke all on function public.record_material_movement_from_audit() from authenticated;
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');
