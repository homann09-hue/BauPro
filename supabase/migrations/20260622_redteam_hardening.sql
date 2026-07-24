-- RedTeam-Hardening: doppelte Lieferanten/Stundenzettel in frischen Installationen verhindern.
-- Bestehende Datenbanken mit bereits vorhandenen Duplikaten werden nicht hart blockiert;
-- die betroffenen Dubletten muessen dann erst fachlich zusammengefuehrt werden.

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'suppliers_company_lower_name_unique_idx'
  ) and not exists (
    select 1
    from (
      select company_id, lower(trim(name)) as normalized_name, count(*) as duplicate_count
      from public.suppliers
      where active is true
      group by company_id, lower(trim(name))
      having count(*) > 1
    ) duplicates
  ) then
    execute 'create unique index suppliers_company_lower_name_unique_idx on public.suppliers (company_id, lower(trim(name))) where active is true';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'time_reports_company_employee_period_unique_idx'
  ) and not exists (
    select 1
    from (
      select company_id, coalesce(employee_id, '00000000-0000-0000-0000-000000000000'::uuid) as employee_key, year, month, count(*) as duplicate_count
      from public.time_reports
      where status <> 'archived'
      group by company_id, coalesce(employee_id, '00000000-0000-0000-0000-000000000000'::uuid), year, month
      having count(*) > 1
    ) duplicates
  ) then
    execute 'create unique index time_reports_company_employee_period_unique_idx on public.time_reports (company_id, coalesce(employee_id, ''00000000-0000-0000-0000-000000000000''::uuid), year, month) where status <> ''archived''';
  end if;
end
$$;
