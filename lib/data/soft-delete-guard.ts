export const PROTECTED_TABLES: string[] = [
  "companies",
  "customers",
  "jobsites",
  "orders",
  "order_measurement_items",
  "commercial_documents",
  "invoices",
  "invoice_items",
  "job_dimensions",
  "job_material_requirements",
  "reports",
  "report_photos",
  "jobsite_documents",
  "jobsite_activity_events",
  "digital_signatures",
  "digital_document_versions",
  "time_entries",
  "materials",
  "inventory_items",
  "material_usage_reports",
  "vehicles",
  "vehicle_materials",
  "planning_resources",
  "planning_assignments",
  "planning_weather_checks",
  "resource_documents",
  "checklist_templates",
  "checklist_template_items",
  "jobsite_checklists",
  "jobsite_checklist_items",
  "checklist_item_photos",
  "defects",
  "defect_photos",
  "defect_notifications",
  "tasks"
];

export function assertNotHardDelete(tableName: string) {
  if (PROTECTED_TABLES.includes(tableName)) {
    throw new Error(`Hard-Delete ist fuer geschaeftskritische Tabelle "${tableName}" verboten.`);
  }
}
