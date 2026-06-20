-- Ergaenzende Performance-Indizes fuer gewachsene SaaS-Module.
-- Defensiv/idempotent, damit bestehende Installationen mit fehlenden optionalen Modulen nicht abbrechen.

do $$
begin
  if to_regclass('public.planning_assignments') is not null then
    execute 'create index if not exists idx_planning_assignments_company_status_period on public.planning_assignments (company_id, status, start_date, end_date) where archived_at is null';
    execute 'create index if not exists idx_planning_assignments_company_resource_period on public.planning_assignments (company_id, resource_type, start_date, end_date) where archived_at is null';
  end if;

  if to_regclass('public.planning_resources') is not null then
    execute 'create index if not exists idx_planning_resources_company_status_kind on public.planning_resources (company_id, status, resource_kind, name) where archived_at is null';
  end if;

  if to_regclass('public.planning_weather_checks') is not null then
    execute 'create index if not exists idx_planning_weather_checks_assignment_period on public.planning_weather_checks (company_id, planning_assignment_id, period_start, period_end)';
    execute 'create index if not exists idx_planning_weather_checks_jobsite_risk on public.planning_weather_checks (company_id, jobsite_id, risk_level, fetched_at desc)';
  end if;

  if to_regclass('public.material_movements') is not null then
    execute 'create index if not exists idx_material_movements_company_jobsite_created on public.material_movements (company_id, jobsite_id, created_at desc) where jobsite_id is not null';
    execute 'create index if not exists idx_material_movements_company_inventory_created on public.material_movements (company_id, inventory_item_id, created_at desc)';
  end if;

  if to_regclass('public.material_reservations') is not null then
    execute 'create index if not exists idx_material_reservations_company_bring_status on public.material_reservations (company_id, bring_list_id, status) where bring_list_id is not null';
    execute 'create index if not exists idx_material_reservations_company_inventory_status on public.material_reservations (company_id, inventory_item_id, status) where inventory_item_id is not null';
  end if;

  if to_regclass('public.material_usage_reports') is not null then
    execute 'create index if not exists idx_material_usage_reports_company_status_created on public.material_usage_reports (company_id, status, created_at desc)';
    execute 'create index if not exists idx_material_usage_reports_company_jobsite_status on public.material_usage_reports (company_id, jobsite_id, status) where jobsite_id is not null';
  end if;

  if to_regclass('public.delivery_notes') is not null then
    execute 'create index if not exists idx_delivery_notes_company_status_created on public.delivery_notes (company_id, status, created_at desc)';
  end if;

  if to_regclass('public.delivery_note_items') is not null then
    execute 'create index if not exists idx_delivery_note_items_company_note_created on public.delivery_note_items (company_id, delivery_note_id, created_at)';
    execute 'create index if not exists idx_delivery_note_items_company_inventory on public.delivery_note_items (company_id, inventory_item_id) where inventory_item_id is not null';
  end if;

  if to_regclass('public.delivery_note_item_prices') is not null then
    execute 'create index if not exists idx_delivery_note_item_prices_company_item on public.delivery_note_item_prices (company_id, delivery_note_item_id)';
  end if;

  if to_regclass('public.jobsite_checklists') is not null then
    execute 'create index if not exists idx_jobsite_checklists_company_status_created on public.jobsite_checklists (company_id, status, created_at desc) where archived_at is null';
    execute 'create index if not exists idx_jobsite_checklists_company_due on public.jobsite_checklists (company_id, due_date, status) where archived_at is null and due_date is not null';
  end if;

  if to_regclass('public.jobsite_checklist_items') is not null then
    execute 'create index if not exists idx_jobsite_checklist_items_checklist_order on public.jobsite_checklist_items (checklist_id, sort_order) where archived_at is null';
    execute 'create index if not exists idx_jobsite_checklist_items_company_status on public.jobsite_checklist_items (company_id, status, updated_at desc) where archived_at is null';
  end if;

  if to_regclass('public.checklist_item_photos') is not null then
    execute 'create index if not exists idx_checklist_item_photos_company_item_created on public.checklist_item_photos (company_id, checklist_item_id, created_at desc) where archived_at is null';
  end if;

  if to_regclass('public.defects') is not null then
    execute 'create index if not exists idx_defects_company_due_status on public.defects (company_id, due_date, status, priority) where archived_at is null and due_date is not null';
    execute 'create index if not exists idx_defects_company_customer_visible on public.defects (company_id, jobsite_id, visible_to_customer, created_at desc) where archived_at is null';
  end if;

  if to_regclass('public.defect_photos') is not null then
    execute 'create index if not exists idx_defect_photos_company_defect_created on public.defect_photos (company_id, defect_id, created_at desc) where archived_at is null';
  end if;

  if to_regclass('public.defect_notifications') is not null then
    execute 'create index if not exists idx_defect_notifications_company_user_read_due on public.defect_notifications (company_id, user_id, read_at, due_at) where archived_at is null';
  end if;

  if to_regclass('public.supplier_offers') is not null then
    execute 'create index if not exists idx_supplier_offers_company_provider_checked on public.supplier_offers (company_id, provider_key, last_checked_at desc)';
    execute 'create index if not exists idx_supplier_offers_company_total_price on public.supplier_offers (company_id, total_price_gross)';
  end if;

  if to_regclass('public.supplier_offer_matches') is not null then
    execute 'create index if not exists idx_supplier_offer_matches_company_material_score on public.supplier_offer_matches (company_id, material_id, match_score desc)';
  end if;

  if to_regclass('public.online_price_discoveries') is not null then
    execute 'create index if not exists idx_online_price_discoveries_company_material_created on public.online_price_discoveries (company_id, material_id, created_at desc)';
  end if;

  if to_regclass('public.online_price_offers') is not null then
    execute 'create index if not exists idx_online_price_offers_company_discovery_price on public.online_price_offers (company_id, discovery_id, total_price_gross)';
  end if;

  if to_regclass('public.customer_portal_events') is not null then
    execute 'create index if not exists idx_customer_portal_events_company_jobsite_date on public.customer_portal_events (company_id, jobsite_id, event_date desc) where visible_to_customer = true';
  end if;

  if to_regclass('public.customer_documents') is not null then
    execute 'create index if not exists idx_customer_documents_company_jobsite_created on public.customer_documents (company_id, jobsite_id, created_at desc) where visible_to_customer = true';
  end if;

  if to_regclass('public.customer_portal_messages') is not null then
    execute 'create index if not exists idx_customer_portal_messages_company_status_created on public.customer_portal_messages (company_id, status, created_at desc)';
  end if;

  if to_regclass('public.order_measurement_items') is not null then
    execute 'create index if not exists idx_order_measurement_items_company_order_created on public.order_measurement_items (company_id, order_id, created_at) where archived_at is null';
  end if;

  if to_regclass('public.job_material_calculations') is not null then
    execute 'create index if not exists idx_job_material_calculations_company_jobsite_created on public.job_material_calculations (company_id, jobsite_id, created_at desc)';
  end if;

  if to_regclass('public.job_material_calculation_items') is not null then
    execute 'create index if not exists idx_job_material_calculation_items_company_calc on public.job_material_calculation_items (company_id, calculation_id)';
  end if;

  if to_regclass('public.job_material_requirements') is not null then
    execute 'create index if not exists idx_job_material_requirements_company_order_active on public.job_material_requirements (company_id, order_id, created_at desc) where archived_at is null';
  end if;

  if to_regclass('public.privacy_requests') is not null then
    execute 'create index if not exists idx_privacy_requests_company_status_due on public.privacy_requests (company_id, status, due_at)';
  end if;
end $$;
