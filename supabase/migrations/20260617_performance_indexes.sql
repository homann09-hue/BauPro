-- Performance indexes for high-traffic SaaS surfaces.
-- Idempotent and guarded so existing installations with partial modules can run it safely.

do $$
begin
  if to_regclass('public.jobsites') is not null then
    execute 'create index if not exists idx_jobsites_company_status_start on public.jobsites (company_id, status, start_date)';
    execute 'create index if not exists idx_jobsites_company_created on public.jobsites (company_id, created_at desc)';
    execute 'create index if not exists idx_jobsites_assigned_employees on public.jobsites using gin (assigned_employee_ids)';
  end if;

  if to_regclass('public.orders') is not null then
    execute 'create index if not exists idx_orders_company_status_start on public.orders (company_id, status, start_date)';
    execute 'create index if not exists idx_orders_company_created on public.orders (company_id, created_at desc)';
    execute 'create index if not exists idx_orders_company_customer on public.orders (company_id, customer_id, created_at desc)';
    execute 'create index if not exists idx_orders_company_jobsite on public.orders (company_id, jobsite_id)';
  end if;

  if to_regclass('public.reports') is not null then
    execute 'create index if not exists idx_reports_company_report_date on public.reports (company_id, report_date desc)';
    execute 'create index if not exists idx_reports_company_jobsite on public.reports (company_id, jobsite_id, report_date desc)';
  end if;

  if to_regclass('public.tasks') is not null then
    execute 'create index if not exists idx_tasks_company_status_due on public.tasks (company_id, status, due_date)';
    execute 'create index if not exists idx_tasks_company_assigned on public.tasks (company_id, assigned_to, status)';
  end if;

  if to_regclass('public.time_entries') is not null then
    execute 'create index if not exists idx_time_entries_company_date_employee on public.time_entries (company_id, date desc, employee_id)';
    execute 'create index if not exists idx_time_entries_company_status_date on public.time_entries (company_id, status, date desc)';
    execute 'create index if not exists idx_time_entries_employee_status on public.time_entries (employee_id, status, date desc)';
  end if;

  if to_regclass('public.inventory_items') is not null then
    execute 'create index if not exists idx_inventory_items_company_name on public.inventory_items (company_id, name)';
    execute 'create index if not exists idx_inventory_items_company_location on public.inventory_items (company_id, location_id, name)';
    execute 'create index if not exists idx_inventory_items_company_stock on public.inventory_items (company_id, stock, minimum_stock)';
  end if;

  if to_regclass('public.material_alerts') is not null then
    execute 'create index if not exists idx_material_alerts_company_status_created on public.material_alerts (company_id, status, created_at desc)';
    execute 'create index if not exists idx_material_alerts_company_bring_list on public.material_alerts (company_id, bring_list_id, status)';
  end if;

  if to_regclass('public.purchase_suggestions') is not null then
    execute 'create index if not exists idx_purchase_suggestions_company_status_created on public.purchase_suggestions (company_id, status, created_at desc)';
    execute 'create index if not exists idx_purchase_suggestions_company_bring_list on public.purchase_suggestions (company_id, bring_list_id, status)';
  end if;

  if to_regclass('public.bring_lists') is not null then
    execute 'create index if not exists idx_bring_lists_company_date_status on public.bring_lists (company_id, date, status)';
    execute 'create index if not exists idx_bring_lists_company_assigned on public.bring_lists (company_id, assigned_to, date)';
  end if;

  if to_regclass('public.customers') is not null then
    execute 'create index if not exists idx_customers_company_status_updated on public.customers (company_id, status, updated_at desc)';
    execute 'create index if not exists idx_customers_company_type_updated on public.customers (company_id, customer_type, updated_at desc)';
  end if;

  if to_regclass('public.customer_portal_tokens') is not null then
    execute 'create index if not exists idx_customer_portal_tokens_token_hash on public.customer_portal_tokens (token_hash)';
    execute 'create index if not exists idx_customer_portal_tokens_company_customer on public.customer_portal_tokens (company_id, customer_id, revoked_at)';
  end if;

  if to_regclass('public.report_photos') is not null then
    execute 'create index if not exists idx_report_photos_report_visible on public.report_photos (report_id, visible_to_customer, created_at desc)';
  end if;

  if to_regclass('public.work_orders') is not null then
    execute 'create index if not exists idx_work_orders_company_order_status on public.work_orders (company_id, order_id, status, created_at desc)';
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');
