-- 20260708_privacy_security_hardening
-- Datenschutz- und Tenant-Haertung:
-- Alle Mandantentabellen mit company_id werden explizit auf RLS + FORCE RLS gesetzt.
-- Das schuetzt neue Tabellen davor, versehentlich ohne erzwungene Mandantentrennung produktiv zu gehen.

do $$
declare
  tenant_table record;
begin
  for tenant_table in
    select table_schema, table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'company_id'
      and table_name not like 'pg_%'
  loop
    execute format('alter table %I.%I enable row level security', tenant_table.table_schema, tenant_table.table_name);
    execute format('alter table %I.%I force row level security', tenant_table.table_schema, tenant_table.table_name);
  end loop;
end $$;

alter table if exists public.companies enable row level security;
alter table if exists public.companies force row level security;

-- Reine Datenschutz-Exporte sollen Preisfelder nur im eingeschraenkten Chef-Block fuehren.
comment on table public.company_audit_log is
  'Audit-Log fuer kritische Aktionen. Datenschutz-/Firmenexporte loggen nur Metadaten, keine exportierten personenbezogenen Inhalte.';

comment on column public.materials.purchase_price is
  'EK-Preis: darf nur ueber Chef-Views, Server Actions oder eingeschraenkte Firmenexports sichtbar sein.';
comment on column public.materials.sales_price is
  'VK-Preis: darf nur ueber Chef-Views, Server Actions oder eingeschraenkte Firmenexports sichtbar sein.';
comment on column public.inventory_items.purchase_price is
  'EK-Preis: darf niemals an Mitarbeiter-, Vorarbeiter- oder Kundenportal-Responses ausgeliefert werden.';
comment on column public.inventory_items.sales_price is
  'VK-Preis: darf niemals an Mitarbeiter-, Vorarbeiter- oder Kundenportal-Responses ausgeliefert werden.';
comment on column public.inventory_items.markup_percent is
  'Marge/Aufschlag: nur fuer Chef, nicht fuer Mitarbeiter/Vorarbeiter/Kundenportal.';

select pg_notify('pgrst', 'reload schema');
