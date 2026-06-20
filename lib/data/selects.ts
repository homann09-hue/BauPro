export const profileOptionSelect = "id, company_id, email, full_name, role, active";

export const teamProfileSelect = "id, company_id, email, full_name, role, active";

export const jobsiteFormSelect =
  "id, company_id, name, customer, address, start_date, status, notes, assigned_employee_ids, latitude, longitude, weather_last_checked_at, created_at";

export const customerFormSelect =
  "id, company_id, customer_type, company, first_name, last_name, contact_person, phone, email, billing_address, jobsite_address, notes, tax_id, payment_terms, status, created_by, created_at, updated_at";

export const companyPricingSettingsSelect = "company_id, waste_percent, default_markup_percent, auto_calculate_sales_price";

export const jobDimensionSelect =
  "id, company_id, order_id, length_m, width_m, area_m2, roof_pitch, eaves_length_m, ridge_length_m, verge_length_m, valley_length_m, wall_connection_length_m, building_height_m, downpipe_length_m, roof_windows_count, penetrations_count, roof_drains_count, emergency_overflows_count, waste_percent, notes, created_by, archived_at, created_at, updated_at";

export const orderMeasurementItemSelect =
  "id, company_id, order_id, item_type, label, length_m, width_m, quantity, pitch_deg, calculated_area_m2, calculated_length_m, count_value, notes, created_by, archived_at, created_at, updated_at";

export const vehicleOptionSelect =
  "id, company_id, name, license_plate, tuv_date, status, inspection_due_date, maintenance_interval_days, last_maintenance_at, next_maintenance_at, location_text, responsible_employee_id, qr_code, nfc_tag_id, notes, archived_at";

export const planningResourceSelect =
  "id, company_id, name, resource_kind, status, inspection_due_date, maintenance_interval_days, last_maintenance_at, next_maintenance_at, location_text, responsible_employee_id, vehicle_id, qr_code, nfc_tag_id, notes, active, created_by, created_at, updated_at, archived_at, vehicles(id, name, license_plate)";

export const planningAssignmentSelect =
  "id, company_id, jobsite_id, title, resource_type, employee_id, vehicle_id, planning_resource_id, start_date, end_date, status, color, notes, created_by, created_at, updated_at, archived_at, jobsites(id, name, customer, address, assigned_employee_ids, status, latitude, longitude, weather_last_checked_at), profiles(id, full_name, email, role), vehicles(id, name, license_plate), planning_resources(id, name, resource_kind, status)";

export const planningWeatherCheckSelect =
  "id, company_id, planning_assignment_id, jobsite_id, period_start, period_end, risk_level, summary, rule_codes, temperature_min_c, temperature_max_c, precipitation_mm, precipitation_probability, wind_kmh, wind_gust_kmh, weather_code, source, fetched_at, acknowledged_action, acknowledged_by, acknowledged_at, acknowledgment_note, created_at, updated_at";

export const legacyMaterialVehicleSelect = "id, company_id, name, category, unit, stock, minimum_stock, location, archived_at";

export const vehicleMaterialSelect =
  "id, vehicle_id, material_id, quantity, notes, archived_at, materials(id, name, unit)";

export const resourceDocumentSelect =
  "id, company_id, planning_resource_id, vehicle_id, document_type, title, storage_path, file_name, content_type, size_bytes, uploaded_by, created_at, updated_at, archived_at";

export const checklistTemplateSelect =
  "id, company_id, name, category, description, active, created_by, created_at, updated_at, archived_at";

export const checklistTemplateItemSelect =
  "id, template_id, company_id, label, help_text, required, photo_required, sort_order, created_at, updated_at, archived_at";

export const jobsiteChecklistListSelect =
  "id, company_id, jobsite_id, template_id, title, category, status, due_date, completed_at, completed_by, signature_name, signature_role, signature_signed_at, notes, created_by, created_at, updated_at, archived_at, jobsites(id, name, customer, address, assigned_employee_ids)";

export const jobsiteChecklistDetailSelect =
  "id, company_id, jobsite_id, template_id, title, category, status, due_date, completed_at, completed_by, signature_name, signature_data_url, signature_role, signature_signed_at, notes, created_by, created_at, updated_at, archived_at, jobsites(id, name, customer, address, assigned_employee_ids), profiles!jobsite_checklists_completed_by_fkey(id, full_name, email)";

export const jobsiteChecklistItemSelect =
  "id, company_id, checklist_id, template_item_id, jobsite_id, label, help_text, required, photo_required, status, notes, problem_description, resolved_task_id, checked_by, checked_at, sort_order, created_at, updated_at, archived_at, tasks(id, title, status)";

export const checklistItemPhotoSelect =
  "id, company_id, checklist_id, checklist_item_id, jobsite_id, storage_path, file_name, content_type, size_bytes, uploaded_by, created_at, archived_at";

export const defectListSelect =
  "id, company_id, jobsite_id, title, description, priority, status, assigned_to, due_date, visible_to_customer, customer_released_at, customer_released_by, source_type, source_report_id, source_report_photo_id, source_checklist_id, source_checklist_item_id, source_customer_message_id, source_task_id, closed_at, accepted_at, created_by, created_at, updated_at, archived_at, jobsites(id, name, customer, address, assigned_employee_ids), profiles!defects_assigned_to_fkey(id, full_name, email, role)";

export const defectDetailSelect =
  "id, company_id, jobsite_id, title, description, priority, status, assigned_to, due_date, visible_to_customer, customer_released_at, customer_released_by, source_type, source_report_id, source_report_photo_id, source_checklist_id, source_checklist_item_id, source_customer_message_id, source_task_id, closed_at, accepted_at, created_by, created_at, updated_at, archived_at, jobsites(id, name, customer, address, assigned_employee_ids), profiles!defects_assigned_to_fkey(id, full_name, email, role), reports(id, report_date, activities, issues), report_photos(id, file_name, storage_path), jobsite_checklists(id, title, category), jobsite_checklist_items(id, label, status, problem_description), customer_portal_messages(id, sender_name, message, created_at), tasks(id, title, status)";

export const defectPhotoSelect =
  "id, company_id, defect_id, jobsite_id, storage_path, file_name, content_type, size_bytes, visible_to_customer, uploaded_by, created_at, archived_at";

export const defectNotificationSelect =
  "id, company_id, defect_id, user_id, notification_type, title, body, due_at, delivered_at, read_at, created_at, archived_at, defects(id, title, priority, status, due_date, jobsite_id)";

export const inventoryLocationSelect =
  "id, company_id, name, location_type, address, vehicle_id, notes, active, created_at";

export const supplierIntegrationListSelect =
  "id, company_id, name, type, provider_key, base_url, active, supports_price, supports_stock, supports_delivery_time, supports_product_url, notes, created_by, created_at, updated_at";

export const supplierIntegrationSecretSelect =
  "id, company_id, name, type, provider_key, base_url, api_key_encrypted, active, supports_price, supports_stock, supports_delivery_time, supports_product_url, notes, created_by, created_at, updated_at";

export const calendarOrderSelect =
  "id, company_id, customer_id, jobsite_id, order_number, title, order_type, status, priority, jobsite_address, start_date, end_date, description, internal_notes, assigned_employee_ids, has_dimensions, created_by, created_at, updated_at, customers(id, company, first_name, last_name, contact_person)";

export const orderBringListSourceSelect =
  "id, company_id, jobsite_id, title, order_type, jobsites(id, name)";

export const calendarTimeEntrySelect =
  "id, company_id, employee_id, job_id, customer_id, date, work_location, work_address, start_time, end_time, break_minutes, gross_minutes, net_minutes, activity, weather, weather_summary, weather_temperature_c, weather_precipitation_mm, weather_wind_kmh, weather_source, weather_fetched_at, weather_lat, weather_lng, kilometers, notes, status, approved_by, approved_at, created_by, created_at, updated_at, jobsites(id, name, address, customer), profiles!time_entries_employee_id_fkey(id, full_name, email)";

export const dailyTimeEntrySelect =
  "id, company_id, employee_id, job_id, customer_id, date, work_location, work_address, start_time, end_time, break_minutes, gross_minutes, net_minutes, activity, weather, weather_summary, weather_temperature_c, weather_precipitation_mm, weather_wind_kmh, weather_source, weather_fetched_at, weather_lat, weather_lng, kilometers, notes, status, approved_by, approved_at, created_by, created_at, updated_at, profiles!time_entries_employee_id_fkey(id, full_name, email), jobsites(id, name, address, customer), approved_profile:profiles!time_entries_approved_by_fkey(id, full_name, email)";

export const materialCategorySelect = "id, slug, name, sort_order, active";

export const materialCatalogItemSelect =
  "id, category_id, subcategory_id, name, unit, package_unit, default_minimum_stock, short_description, search_terms, typical_use, manufacturer, article_number, ean, purchase_price, sales_price, markup_percent, sales_unit, price_per_unit, last_price_changed_at, popularity, active, material_categories(id, name, slug), material_subcategories(id, name, slug)";

export const inventoryItemManagerDetailSelect =
  "id, company_id, catalog_item_id, category_id, subcategory_id, location_id, supplier_id, name, unit, stock, minimum_stock, package_unit, manufacturer, article_number, ean, purchase_price, sales_price, markup_percent, sales_unit, price_per_unit, last_price_changed_at, notes, created_by, inventory_locations(id, name, location_type, vehicle_id), material_categories(id, name, slug), material_subcategories(id, name, slug), suppliers(id, name)";

export const inventoryItemCalculationSelect =
  "id, company_id, catalog_item_id, category_id, subcategory_id, location_id, supplier_id, name, unit, stock, minimum_stock, package_unit, manufacturer, article_number, ean, purchase_price, sales_price, markup_percent, sales_unit, price_per_unit, last_price_changed_at, notes, created_by, inventory_locations(id, name, location_type, vehicle_id)";

export const inventoryItemMatchSelect =
  "id, company_id, catalog_item_id, category_id, subcategory_id, location_id, supplier_id, name, unit, stock, minimum_stock, package_unit, manufacturer, article_number, ean, purchase_price, sales_price, markup_percent, sales_unit, price_per_unit, last_price_changed_at, notes, created_by, material_categories(id, name, slug), material_subcategories(id, name, slug), material_catalog(id, search_terms)";

export const supplierOfferSelect =
  "id, company_id, supplier_integration_id, provider_key, supplier_name, external_product_id, product_name, manufacturer, category, unit, package_size, price_net, price_gross, currency, vat_rate, shipping_cost, total_price_gross, delivery_time_text, delivery_time_days_min, delivery_time_days_max, stock_status, product_url, image_url, last_checked_at, valid_until, source_type, created_by, created_at, updated_at";

export const supplierOfferWithIntegrationSelect =
  "id, company_id, supplier_integration_id, provider_key, supplier_name, external_product_id, product_name, manufacturer, category, unit, package_size, price_net, price_gross, currency, vat_rate, shipping_cost, total_price_gross, delivery_time_text, delivery_time_days_min, delivery_time_days_max, stock_status, product_url, image_url, last_checked_at, valid_until, source_type, created_by, created_at, updated_at, supplier_integrations(id, name, provider_key, type)";

export const supplierOfferMatchSelect =
  "id, company_id, material_id, supplier_offer_id, match_score, match_type, approved_by_admin, created_by, created_at, supplier_offers(id, company_id, supplier_integration_id, provider_key, supplier_name, external_product_id, product_name, manufacturer, category, unit, package_size, price_net, price_gross, currency, vat_rate, shipping_cost, total_price_gross, delivery_time_text, delivery_time_days_min, delivery_time_days_max, stock_status, product_url, image_url, last_checked_at, valid_until, source_type, created_by, created_at, updated_at)";

export const supplierOfferMatchLiveSelect =
  "id, company_id, material_id, supplier_offer_id, match_score, match_type, approved_by_admin, created_by, created_at, supplier_offers(id, company_id, supplier_integration_id, provider_key, supplier_name, external_product_id, product_name, manufacturer, category, unit, package_size, price_net, price_gross, currency, vat_rate, shipping_cost, total_price_gross, delivery_time_text, delivery_time_days_min, delivery_time_days_max, stock_status, product_url, image_url, last_checked_at, valid_until, source_type, created_by, created_at, updated_at), inventory_items(id, name, unit, purchase_price, manufacturer)";

export const onlinePriceDiscoverySelect =
  "id, company_id, material_id, query, status, source_statuses, cheapest_price_gross, average_price_gross, offer_count, created_by, created_at";

export const onlinePriceOfferSelect =
  "id, company_id, discovery_id, material_id, source_key, supplier_name, product_name, product_url, price_gross, shipping_cost, total_price_gross, delivery_time_text, checked_at, source_note";

export const inventoryPriceOptionSelect = "id, company_id, name, unit, purchase_price, manufacturer";

export const bringListDetailSelect =
  "id, company_id, job_id, date, title, notes, status, created_by, assigned_to, vehicle_id, auto_generated, generation_source, last_auto_synced_at, source_hash, created_at, updated_at, jobsites(id, name, customer, address), profiles!bring_lists_assigned_to_fkey(id, full_name, email), vehicles(id, name, license_plate)";

export const bringListOperationalSelect =
  "id, company_id, job_id, date, title, notes, status, created_by, assigned_to, vehicle_id, auto_generated, generation_source, last_auto_synced_at, source_hash, created_at, updated_at";

export const bringListItemSelect =
  "id, bring_list_id, material_id, inventory_item_id, custom_item_name, item_type, quantity, unit, storage_location, vehicle_id, packed, packed_by, packed_at, missing_reported, notes, auto_generated, source_type, source_ref, required_vehicle_id, created_at, updated_at";

export const bringListItemWithInventorySelect =
  "id, bring_list_id, material_id, inventory_item_id, custom_item_name, item_type, quantity, unit, storage_location, vehicle_id, packed, packed_by, packed_at, missing_reported, notes, auto_generated, source_type, source_ref, required_vehicle_id, created_at, updated_at, inventory_items(id, name, unit, stock, minimum_stock, location_id, inventory_locations(id, name, location_type, vehicle_id))";

export const bringListAuditLogSelect =
  "id, company_id, bring_list_id, actor_id, action, old_values, new_values, created_at, profiles!bring_list_audit_log_actor_id_fkey(id, full_name, email)";

export const materialReservationSelect =
  "id, company_id, job_id, bring_list_id, material_id, inventory_item_id, quantity_required, quantity_reserved, unit, status, reserved_by, reserved_at, created_at, updated_at";

export const materialUsageReportSelect =
  "id, company_id, inventory_item_id, jobsite_id, bring_list_id, quantity, unit, booking_type, status, movement_id, reported_by, confirmed_by, confirmed_at, notes, rejection_reason, created_at, updated_at, inventory_items(id, name, unit, stock, minimum_stock, location_id, inventory_locations(id, name, location_type)), jobsites(id, name, address, customer), reported_profile:profiles!material_usage_reports_reported_by_fkey(id, full_name, email, role), confirmed_profile:profiles!material_usage_reports_confirmed_by_fkey(id, full_name, email, role), material_movements(id, movement_type, created_at)";

export const materialMovementSelect =
  "id, company_id, inventory_item_id, from_location_id, to_location_id, jobsite_id, bring_list_id, quantity, unit, movement_type, created_by, created_at, notes, inventory_items(id, name, unit, stock, minimum_stock, location_id), jobsites(id, name, address, customer), profiles!material_movements_created_by_fkey(id, full_name, email)";

export const deliveryNoteSelect =
  "id, company_id, supplier_id, supplier_name, document_date, status, storage_path, file_name, content_type, recognition_model, recognition_confidence, recognized_json, notes, created_by, confirmed_by, confirmed_at, created_at, updated_at, suppliers(id, name), profiles!delivery_notes_created_by_fkey(id, full_name, email)";

export const deliveryNoteItemSelect =
  "id, company_id, delivery_note_id, inventory_item_id, supplier_article_number, article_name, quantity, unit, target_location_id, recognition_confidence, created_at, updated_at, inventory_items(id, name, unit, stock, minimum_stock, location_id), inventory_locations(id, name, location_type)";

export const deliveryNoteItemPriceSelect =
  "id, company_id, delivery_note_item_id, unit_price, total_price, currency, created_at, updated_at";

export const materialAlertSelect =
  "id, company_id, material_id, inventory_item_id, job_id, bring_list_id, alert_type, severity, message, required_quantity, available_quantity, missing_quantity, unit, status, created_by_system, assigned_to_admin, created_at, acknowledged_at, resolved_at";

export const purchaseSuggestionSelect =
  "id, company_id, material_id, inventory_item_id, job_id, bring_list_id, quantity_needed, unit, reason, status, created_at, updated_at";

export const inventoryAvailabilitySelect =
  "id, company_id, catalog_item_id, category_id, subcategory_id, location_id, name, unit, stock, minimum_stock, package_unit, manufacturer, article_number, notes";

export const inventoryLowStockSelect =
  "id, company_id, catalog_item_id, category_id, subcategory_id, location_id, supplier_id, name, unit, stock, minimum_stock, package_unit, manufacturer, article_number, ean, notes, created_by, inventory_locations(id, name, location_type, vehicle_id), material_categories(id, name, slug)";

export const jobMaterialRequirementPublicSelect =
  "id, company_id, order_id, dimension_id, jobsite_id, rule_id, catalog_item_id, inventory_item_id, material_name, unit, base_quantity, waste_percent, waste_quantity, total_quantity, location_name, stock, minimum_stock, archived_at, created_at";

export const aiJobDraftSelect =
  "id, company_id, created_by, raw_input, parsed_json, preview_json, confidence, status, missing_fields, converted_order_id, created_at, updated_at";

export const aiActionSelect =
  "id, company_id, user_id, action_type, raw_input, parsed_json, confidence, status, linked_customer_id, linked_job_id, linked_time_entry_id, linked_bring_list_id, created_at, confirmed_at";

export const aiSettingsSelect =
  "id, company_id, enabled, default_model, allow_employee_ai, allow_ai_daily_reports, allow_ai_time_tracking, allow_ai_material_matching, created_at, updated_at";

export const calculationSettingsSelect =
  "id, company_id, default_waste_percent, default_vat_rate, default_labor_rate_net, default_internal_hourly_cost, default_profit_markup_percent, default_overhead_percent, default_travel_flat_rate, allow_ai_job_creation, require_admin_confirmation, created_at, updated_at";

export const jobMaterialCalculationSelect =
  "id, company_id, jobsite_id, roof_type, roof_form, material_type, length_m, width_m, area_m2, roof_pitch, eaves_length_m, ridge_length_m, verge_length_m, valley_length_m, wall_connection_length_m, penetrations_count, roof_windows_count, dormers_count, chimneys_count, waste_percent, ai_enabled, ai_model, ai_confidence, ai_notes, review_notice, notes, created_by, created_at";

export const jobMaterialCalculationItemManagerSelect =
  "id, company_id, calculation_id, jobsite_id, rule_id, catalog_item_id, inventory_item_id, material_name, unit, base_quantity, waste_percent, waste_quantity, total_quantity, purchase_price, sales_price, purchase_total, sales_total, margin_total, location_name, stock, minimum_stock, missing_quantity, source, ai_reason, created_at";

export const jobMaterialCalculationItemPublicSelect =
  "id, company_id, calculation_id, jobsite_id, rule_id, catalog_item_id, inventory_item_id, material_name, unit, base_quantity, waste_percent, waste_quantity, total_quantity, location_name, stock, minimum_stock, missing_quantity, source, ai_reason, created_at";

export const materialCalculationRuleSelect =
  "id, company_id, rule_key, roof_type, name, material_name, catalog_item_id, unit, calculation_method, factor, spacing_m, waste_applies, sort_order, active";

export const reportFormSelect =
  "id, company_id, jobsite_id, report_date, weather, weather_summary, weather_temperature_c, weather_precipitation_mm, weather_wind_kmh, weather_source, weather_fetched_at, weather_lat, weather_lng, work_start, work_end, employee_ids, activities, material_usage, machine_usage, vehicle_ids, linked_time_entry_ids, issues, report_status, submitted_at, reviewed_by, reviewed_at, approved_by, approved_at, visible_to_customer, customer_summary, customer_released_at, customer_released_by, signature_name, signature_status, signature_data_url, signature_signed_at, signature_role, signature_content_hash, source_report_id, document_version, created_by, created_at";

export const reportPhotoSelect =
  "id, company_id, report_id, jobsite_id, storage_path, file_name, content_type, visible_to_customer, customer_caption, thumbnail_path, approved_by, approved_at, archived_at, created_at";

export const customerPortalTokenActionSelect =
  "id, company_id, customer_id, jobsite_id, label, expires_at, revoked_at, created_by, created_at, last_used_at";

export const jobsiteDocumentSelect =
  "id, company_id, jobsite_id, category, title, storage_path, file_name, content_type, size_bytes, visible_to_customer, uploaded_by, signed_by, signed_at, signature_name, signature_data_url, signature_role, signature_content_hash, archived_at, created_at, updated_at";

export const jobsiteActivityEventSelect =
  "id, company_id, jobsite_id, event_type, title, body, visibility, actor_id, source_table, source_id, archived_at, created_at";

export const workOrderActionSelect =
  "id, company_id, customer_id, jobsite_id, order_id, title, description, scope_of_work, price_note, status, version, content_hash, sent_at, viewed_at, signed_at, rejected_at, signer_name, signer_ip, signer_user_agent, signature_data_url, signature_role, rejection_reason, created_by, created_at, updated_at";

export const digitalSignatureSelect =
  "id, company_id, document_type, document_id, document_version, jobsite_id, status, signer_name, signer_role, signer_user_id, signer_ip, signer_user_agent, signature_data_url, signed_at, rejected_at, rejection_reason, content_hash, metadata, created_at";

export const digitalDocumentVersionSelect =
  "id, company_id, document_type, document_id, version, snapshot, content_hash, created_by, created_at";

export const commercialDocumentListSelect =
  "id, company_id, order_id, customer_id, jobsite_id, document_type, document_number, status, subject, customer_snapshot, issue_date, due_date, valid_until, subtotal_net, tax_rate, tax_total, total_gross, notes, payment_terms, created_by, sent_at, accepted_at, paid_at, archived_at, created_at, updated_at, orders(id, order_number, title, status), customers(id, company, first_name, last_name, contact_person, email, phone)";

export const commercialDocumentItemSelect =
  "id, company_id, document_id, source_requirement_id, position, title, description, quantity, unit, unit_price_net, discount_percent, line_total_net, created_at, updated_at";

export const timeEntryFormSelect =
  "id, company_id, employee_id, job_id, customer_id, date, work_location, work_address, start_time, end_time, break_minutes, gross_minutes, net_minutes, activity, weather, weather_summary, weather_temperature_c, weather_precipitation_mm, weather_wind_kmh, weather_source, weather_fetched_at, weather_lat, weather_lng, kilometers, notes, status, approved_by, approved_at, created_by, created_at, updated_at";

export const timeEntryLegacySelect =
  "id, company_id, employee_id, job_id, customer_id, date, work_location, work_address, start_time, end_time, break_minutes, gross_minutes, net_minutes, activity, weather, kilometers, notes, status, approved_by, approved_at, created_by, created_at, updated_at";

export const timeEntryAuditSelect =
  "id, company_id, time_entry_id, changed_by, old_values, new_values, change_reason, created_at, profiles!time_entry_audit_log_changed_by_fkey(id, full_name, email)";

export const timeReportListSelect =
  "id, company_id, employee_id, month, year, date_from, date_to, status, generated_by, generated_at, profiles!time_reports_employee_id_fkey(id, full_name, email)";
