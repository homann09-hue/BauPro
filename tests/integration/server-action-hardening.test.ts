import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function actionBlock(sourceCode: string, actionName: string, nextActionName?: string) {
  const start = sourceCode.indexOf(`export async function ${actionName}`);
  const end = nextActionName ? sourceCode.indexOf(`export async function ${nextActionName}`, start) : sourceCode.length;
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return sourceCode.slice(start, end);
}

describe("server action hardening", () => {
  it("decrypts supplier API keys only at provider-call time", () => {
    const supplierActions = source("lib/actions/supplier-actions.ts");
    expect(supplierActions).toContain("function decryptApiKey");
    expect(supplierActions).toContain("apiKey: decryptApiKey(typed.api_key_encrypted)");
    expect(supplierActions).not.toContain("apiKey: typed.api_key_encrypted");
  });

  it("does not trust report photo storage paths from FormData", () => {
    const reportActions = source("lib/actions/report-actions.ts");
    const deletePhotoAction = reportActions.slice(reportActions.indexOf("export async function deleteReportPhotoAction"));
    expect(deletePhotoAction).not.toContain('requiredString(formData, "storage_path")');
    expect(deletePhotoAction).toContain('.select("storage_path, created_by")');
  });

  it("uses the atomic stock RPC when catalog imports update existing inventory", () => {
    const inventoryActions = source("lib/actions/inventory-actions.ts");
    const addCatalogAction = inventoryActions.slice(
      inventoryActions.indexOf("export async function addCatalogItemToInventoryAction"),
      inventoryActions.indexOf("export async function createCustomInventoryItemAction")
    );

    expect(addCatalogAction).toContain('.select("id")');
    expect(addCatalogAction).toContain('rpc("adjust_inventory_stock"');
    expect(addCatalogAction).toContain('p_mode: "increase"');
    expect(addCatalogAction).not.toContain('.select("id, stock")');
    expect(addCatalogAction).not.toContain("+ stock : stock");
  });

  it("ignores inventory price FormData for non-manager inventory editors", () => {
    const inventoryActions = source("lib/actions/inventory-actions.ts");
    const addCatalogAction = actionBlock(inventoryActions, "addCatalogItemToInventoryAction", "createCustomInventoryItemAction");
    const customItemAction = actionBlock(inventoryActions, "createCustomInventoryItemAction", "adjustInventoryStockAction");

    expect(addCatalogAction).toContain("context.canManage");
    expect(addCatalogAction).toContain('optionalString(formData, "supplier_name")');
    expect(addCatalogAction).toContain("...(context.canManage");
    expect(addCatalogAction).toContain('purchase_price: optionalNumber(formData, "purchase_price")');
    expect(addCatalogAction).toContain("sales_price: item.sales_price");

    expect(customItemAction).toContain('purchase_price: context.canManage ? optionalNumber(formData, "purchase_price") : null');
    expect(customItemAction).toContain('sales_price: context.canManage ? optionalNumber(formData, "sales_price") : null');
    expect(customItemAction).not.toContain('purchase_price: optionalNumber(formData, "purchase_price"),');
    expect(customItemAction).not.toContain('sales_price: optionalNumber(formData, "sales_price"),');
  });

  it("keeps order cost and material price generation manager-only", () => {
    const orderActions = source("lib/actions/order-actions.ts");
    const orderPage = source("app/(app)/orders/new/page.tsx");
    const orderForm = source("components/forms/order-wizard-form.tsx");
    const createAction = actionBlock(orderActions, "createOrderAction", "updateOrderDimensionsAction");
    const updateDimensionsAction = actionBlock(orderActions, "updateOrderDimensionsAction", "createOrderMeasurementItemAction");
    const recalculateAction = actionBlock(orderActions, "recalculateOrderMaterialsAction", "updateOrderStatusAction");
    const materials = source("lib/order-materials.ts");

    expect(createAction).toContain("if (context.canManage)");
    expect(createAction).toContain("saveOrderCostEstimate");
    expect(createAction).toContain("includePrices: context.canManage");
    expect(updateDimensionsAction).toContain("includePrices: context.canManage");
    expect(recalculateAction).toContain("includePrices: context.canManage");

    expect(materials).toContain("includePrices = true");
    expect(materials).toContain('const inventorySource = includePrices ? "inventory_items" : "inventory_items_public"');
    expect(materials).toContain("purchasePrice: null");
    expect(materials).toContain("salesPrice: null");

    expect(orderPage).toContain("canManage={context.canManage}");
    expect(orderForm).toContain("canManage: boolean");
    expect(orderForm).toContain("{canManage ? (");
    expect(orderForm).toContain("Kosten, EK/VK und Margen bleiben Chef vorbehalten.");
  });

  it("does not trust material usage FormData for company or actor ids", () => {
    const inventoryActions = source("lib/actions/inventory-actions.ts");
    const reportAction = actionBlock(inventoryActions, "reportMaterialUsageAction", "confirmMaterialUsageReportAction");
    const confirmStart = inventoryActions.indexOf("async function confirmMaterialUsageReport");
    const confirmEnd = inventoryActions.indexOf("export async function reserveMaterialForJobsiteAction");
    expect(confirmStart).toBeGreaterThanOrEqual(0);
    expect(confirmEnd).toBeGreaterThan(confirmStart);
    const confirmAction = inventoryActions.slice(confirmStart, confirmEnd);
    const reserveAction = actionBlock(inventoryActions, "reserveMaterialForJobsiteAction", "createInventoryLocationAction");

    expect(reportAction).toContain("requireAppContext");
    expect(reportAction).toContain("company_id: context.companyId");
    expect(reportAction).toContain("reported_by: context.userId");
    expect(reportAction).toContain("assertJobsiteInCompany");
    expect(reportAction).toContain("assertBringListAccess");
    expect(reportAction).not.toContain('formData, "company_id"');
    expect(reportAction).not.toContain('formData, "reported_by"');

    expect(confirmAction).toContain("context.canOperate");
    expect(confirmAction).toContain('rpc("confirm_material_usage_report"');
    expect(confirmAction).toContain("p_company_id: context.companyId");
    expect(confirmAction).toContain("p_actor_id: context.userId");
    expect(confirmAction).not.toContain('formData, "company_id"');
    expect(confirmAction).not.toContain('formData, "actor_id"');

    expect(reserveAction).toContain('requirePermission("inventory.edit"');
    expect(reserveAction).toContain('rpc("reserve_inventory_for_jobsite"');
    expect(reserveAction).toContain("p_company_id: context.companyId");
    expect(reserveAction).toContain("p_reserved_by: context.userId");
    expect(reserveAction).not.toContain('formData, "company_id"');
    expect(reserveAction).not.toContain('formData, "reserved_by"');
  });

  it("keeps delivery note recognition tenant-safe and confirmation-only", () => {
    const deliveryActions = source("lib/actions/delivery-note-actions.ts");
    const createAction = actionBlock(deliveryActions, "createDeliveryNoteFromPhotoAction", "confirmDeliveryNoteAction");
    const confirmAction = actionBlock(deliveryActions, "confirmDeliveryNoteAction");

    expect(createAction).toContain("ensureOperator(context)");
    expect(createAction).toContain("validateReportPhoto(photo)");
    expect(createAction).toContain('storage.from("delivery-notes").upload');
    expect(createAction).toContain("recognizeDeliveryNoteFromImage");
    expect(createAction).toContain("company_id: context.companyId");
    expect(createAction).toContain("created_by: context.userId");
    expect(createAction).toContain("context.canManage");
    expect(createAction).toContain('from("delivery_note_item_prices")');
    expect(createAction).not.toContain('formData, "company_id"');
    expect(createAction).not.toContain('formData, "created_by"');

    expect(confirmAction).toContain("ensureOperator(context)");
    expect(confirmAction).toContain('from("delivery_note_item_prices").upsert');
    expect(confirmAction).toContain('rpc("confirm_delivery_note"');
    expect(confirmAction).toContain("p_company_id: context.companyId");
    expect(confirmAction).toContain("p_actor_id: context.userId");
    expect(confirmAction).toContain("context.canManage ? numberAt(unitPrices, index) : null");
    expect(confirmAction).not.toContain('formData, "company_id"');
    expect(confirmAction).not.toContain('formData, "actor_id"');
  });

  it("does not trust vehicle ids from FormData when deleting vehicle materials", () => {
    const vehicleActions = source("lib/actions/vehicle-actions.ts");
    const deleteAction = vehicleActions.slice(vehicleActions.indexOf("export async function deleteVehicleMaterialAction"));

    expect(deleteAction).toContain('.select("id, vehicle_id")');
    expect(deleteAction).toContain("vehicleId = vehicleMaterial.vehicle_id");
    expect(deleteAction).toContain('.eq("company_id", context.companyId)');
  });

  it("archives legacy operational records instead of hard deleting them", () => {
    const actions = [
      ["lib/actions/material-actions.ts", "deleteMaterialAction"],
      ["lib/actions/vehicle-actions.ts", "deleteVehicleAction", "addVehicleMaterialAction"],
      ["lib/actions/task-actions.ts", "deleteTaskAction"]
    ] as const;

    for (const [file, actionName, nextActionName] of actions) {
      const deleteAction = actionBlock(source(file), actionName, nextActionName);

      expect(deleteAction, file).toContain("archived_at");
      expect(deleteAction, file).toContain(".update(");
      expect(deleteAction, file).not.toContain(".delete()");
    }
  });

  it("archives daily reports instead of hard deleting report documentation", () => {
    const reportActions = source("lib/actions/report-actions.ts");
    const deleteReportAction = actionBlock(reportActions, "deleteReportAction", "deleteReportPhotoAction");

    expect(deleteReportAction).toContain("archived_at");
    expect(deleteReportAction).toContain(".update(");
    expect(deleteReportAction).toContain('.is("archived_at", null)');
    expect(deleteReportAction).toContain('.select("id")');
    expect(deleteReportAction).toContain(".maybeSingle()");
    expect(deleteReportAction).toContain("if (error || !data)");
    expect(deleteReportAction).not.toContain(".delete()");
    expect(deleteReportAction).not.toContain("storage.from(\"report-photos\").remove");
  });

  it("does not expose raw database errors from customer actions", () => {
    const customerActions = source("lib/actions/customer-actions.ts");

    expect(customerActions).toContain("safeErrorMessage");
    expect(customerActions).not.toContain("error.message");
    expect(customerActions).not.toContain("error?.message");
  });

  it("does not expose raw database errors from time tracking actions", () => {
    const timeActions = source("lib/actions/time-tracking-actions.ts");

    expect(timeActions).toContain("safeErrorMessage");
    expect(timeActions).not.toContain("error.message");
    expect(timeActions).not.toContain("error?.message");
    expect(timeActions).not.toContain("entriesError.message");
    expect(timeActions).not.toContain("linkError.message");
  });

  it("does not let employees update unassigned tasks by spoofing FormData ids", () => {
    const taskActions = source("lib/actions/task-actions.ts");
    const updateAction = actionBlock(taskActions, "updateTaskStatusAction", "deleteTaskAction");

    expect(updateAction).toContain("requireAppContext");
    expect(updateAction).toContain('.is("archived_at", null)');
    expect(updateAction).toContain('taskQuery.eq("assigned_to", context.userId)');
    expect(updateAction).toContain('updateQuery.eq("assigned_to", context.userId)');
    expect(updateAction).toContain("Aufgabe wurde nicht gefunden oder ist dir nicht zugewiesen.");
    expect(updateAction).toContain("safeErrorMessage");
  });

  it("only lets managers assign operational employees to jobsites", () => {
    const jobsiteActions = source("lib/actions/jobsite-actions.ts");
    const createAction = actionBlock(jobsiteActions, "createJobsiteAction", "updateJobsiteAction");
    const updateAction = actionBlock(jobsiteActions, "updateJobsiteAction", "deleteJobsiteAction");
    const deleteAction = actionBlock(jobsiteActions, "deleteJobsiteAction");

    expect(jobsiteActions).toContain('.in("role", ["mitarbeiter", "vorarbeiter"])');
    expect(jobsiteActions).toContain("ids.length !== requestedIds.length");
    expect(jobsiteActions).toContain("Nur aktive Mitarbeiter oder Vorarbeiter dieser Firma duerfen zugeordnet werden.");

    for (const action of [createAction, updateAction, deleteAction]) {
      expect(action).toContain('.select("id")');
      expect(action).toContain(".maybeSingle()");
      expect(action).toContain("if (error || !data)");
    }

    expect(updateAction).toContain('.eq("company_id", context.companyId)');
    expect(deleteAction).toContain('.eq("company_id", context.companyId)');
  });

  it("only lets managers assign operational employees to orders", () => {
    const orderActions = source("lib/actions/order-actions.ts");

    expect(orderActions).toContain('.in("role", ["mitarbeiter", "vorarbeiter"])');
    expect(orderActions).toContain("ids.length !== requestedIds.length");
    expect(orderActions).toContain("Nur aktive Mitarbeiter oder Vorarbeiter dieser Firma duerfen zugeordnet werden.");
    expect(orderActions).toContain('optionalFormUuid(formData, "customer_id", "Kunde")');
    expect(orderActions).toContain('requiredFormUuid(formData, "order_id", "Auftrag")');
  });

  it("checks affected rows for customer updates and status changes", () => {
    const customerActions = source("lib/actions/customer-actions.ts");
    const updateCustomer = actionBlock(customerActions, "updateCustomerAction", "updateCustomerStatusAction");
    const updateStatus = actionBlock(customerActions, "updateCustomerStatusAction");

    for (const action of [updateCustomer, updateStatus]) {
      expect(action).toContain('requiredFormUuid(formData, "id", "Kunde")');
      expect(action).toContain('.eq("company_id", context.companyId)');
      expect(action).toContain('.select("id")');
      expect(action).toContain(".maybeSingle()");
      expect(action).toContain("if (error || !data)");
    }
  });

  it("does not report bring-list updates as successful when no row was changed", () => {
    const bringListActions = source("lib/actions/bring-list-actions.ts");
    const packedAction = actionBlock(bringListActions, "updateBringListItemPackedAction", "updateBringListStatusAction");
    const statusAction = actionBlock(bringListActions, "updateBringListStatusAction", "reportMissingBringListItemAction");
    const missingAction = actionBlock(bringListActions, "reportMissingBringListItemAction", "reserveBringListMaterialsAction");
    const suggestionAction = actionBlock(bringListActions, "updatePurchaseSuggestionStatusAction");

    for (const action of [packedAction, statusAction, missingAction, suggestionAction]) {
      expect(action).toContain('.select("id")');
      expect(action).toContain(".maybeSingle()");
    }

    expect(packedAction).toContain("if (error || !data)");
    expect(statusAction).toContain("if (error || !data)");
    expect(missingAction).toContain("if (updateError || !updatedItem)");
    expect(suggestionAction).toContain("if (error || !data)");
    expect(missingAction).toContain("safeErrorMessage");
  });

  it("keeps automatic bring-list actions tenant scoped and source audited", () => {
    const bringListActions = source("lib/actions/bring-list-actions.ts");
    const syncAction = actionBlock(bringListActions, "syncAutomaticBringListsAction", "addBringListItemAction");
    const addItemAction = actionBlock(bringListActions, "addBringListItemAction", "updatePurchaseSuggestionStatusAction");

    expect(syncAction).toContain("requireAppContext");
    expect(syncAction).toContain("context.canOperate");
    expect(syncAction).toContain("ensureAutomaticBringListsForDate");
    expect(syncAction).not.toContain('formData, "company_id"');
    expect(syncAction).not.toContain('formData, "created_by"');

    expect(addItemAction).toContain("requireAppContext");
    expect(addItemAction).toContain("assertBringListAccess");
    expect(addItemAction).toContain("source_type: \"manual\"");
    expect(addItemAction).toContain("auto_generated: false");
    expect(addItemAction).toContain("logBringListAudit");
    expect(addItemAction).not.toContain('formData, "company_id"');
    expect(addItemAction).not.toContain('formData, "assigned_to"');
    expect(addItemAction).not.toContain('formData, "vehicle_id"');
  });

  it("checks affected rows for security-sensitive update and delete actions", () => {
    const checkedActions = [
      ["lib/actions/material-actions.ts", "updateMaterialAction", "deleteMaterialAction"],
      ["lib/actions/material-actions.ts", "deleteMaterialAction"],
      ["lib/actions/vehicle-actions.ts", "updateVehicleAction", "deleteVehicleAction"],
      ["lib/actions/vehicle-actions.ts", "deleteVehicleAction", "addVehicleMaterialAction"],
      ["lib/actions/report-actions.ts", "updateReportAction", "deleteReportAction"],
      ["lib/actions/report-actions.ts", "deleteReportAction", "deleteReportPhotoAction"],
      ["lib/actions/vehicle-actions.ts", "deleteVehicleMaterialAction"],
      ["lib/actions/order-actions.ts", "updateOrderDimensionsAction"],
      ["lib/actions/order-actions.ts", "updateOrderStatusAction"],
      ["lib/actions/auth-actions.ts", "updateCompanyProfileAction"],
      ["lib/actions/ai-job-actions.ts", "rejectAiJobDraftAction", "saveAiJobDraftAction"],
      ["lib/actions/ai-job-actions.ts", "saveAiJobDraftAction", "updateAiJobDraftPreviewAction"]
    ] as const;

    for (const [file, actionName, nextActionName] of checkedActions) {
      const action = actionBlock(source(file), actionName, nextActionName);
      expect(action, `${file}:${actionName}`).toContain('.select("id")');
      expect(action, `${file}:${actionName}`).toContain(".maybeSingle()");
      expect(action, `${file}:${actionName}`).toMatch(/if \([^)]*(error|Error)[^)]*\|\| !/);
    }
  });

  it("does not expose raw database errors from order and calculation actions", () => {
    for (const file of ["lib/actions/order-actions.ts", "lib/actions/material-calculation-actions.ts"]) {
      const actionSource = source(file);

      expect(actionSource, file).toContain("safeErrorMessage");
      expect(actionSource, file).not.toContain("error.message");
      expect(actionSource, file).not.toContain("error?.message");
      expect(actionSource, file).not.toContain("Error ? error.message");
    }
  });

  it("does not expose raw provider or database errors from AI and voice actions", () => {
    for (const file of ["lib/actions/ai-job-actions.ts", "lib/actions/voice-actions.ts"]) {
      const actionSource = source(file);

      expect(actionSource, file).toContain("safeErrorMessage");
      expect(actionSource, file).not.toContain("error.message");
      expect(actionSource, file).not.toContain("error?.message");
      expect(actionSource, file).not.toContain("Error ? error.message");
    }
  });

  it("keeps employee AI context scoped and price-sanitized", () => {
    const aiActions = source("lib/actions/ai-actions.ts");

    expect(aiActions).toContain("const jobsitesQuery = (");
    expect(aiActions).toContain('.contains("assigned_employee_ids", [context.userId])');
    expect(aiActions).toContain("const ordersQuery = (");
    expect(aiActions).toContain("const bringListsQuery = (");
    expect(aiActions).toContain(`.or(\`assigned_to.eq.\${context.userId},created_by.eq.\${context.userId}\`)`);
    expect(aiActions).toContain("removePricesForEmployees(context, item)");

    const permissions = source("lib/ai/permissions.ts");
    for (const field of ["purchase_price", "sales_price", "price_net", "price_gross", "total_price_gross", "margin_total", "markup_percent"]) {
      expect(permissions).toContain(`"${field}"`);
    }
  });

  it("does not expose raw auth or OpenAI provider messages to users", () => {
    const authCallback = source("app/auth/callback/route.ts");
    const openAiClient = source("lib/ai/openai.ts");

    expect(authCallback).toContain("AUTH_CALLBACK_ERROR");
    expect(authCallback).not.toContain("encodeURIComponent(callbackError)");
    expect(authCallback).not.toContain("encodeURIComponent(error.message)");
    expect(openAiClient).not.toContain("message: payload.error?.message");
    expect(openAiClient).toContain("KI-Anfrage konnte nicht verarbeitet werden.");
  });

  it("uses the shared safe return-path helper instead of ad-hoc return_to redirects", () => {
    expect(source("lib/security/redirects.ts")).toContain("path.startsWith(\"//\")");

    for (const file of fs.readdirSync(path.join(root, "lib/actions")).filter((name) => name.endsWith(".ts"))) {
      const actionSource = source(`lib/actions/${file}`);
      expect(actionSource, file).not.toContain('String(formData.get("return_to")');
      expect(actionSource, file).not.toContain('requiredString(formData, "return_to"');
      expect(actionSource, file).not.toContain('optionalString(formData, "return_to"');
      expect(actionSource, file).not.toContain('return value.startsWith("/")');
    }
  });

  it("sanitizes query errors before rendering high-traffic app pages", () => {
    expect(source("lib/security/errors.ts")).toContain("function safeQueryErrorMessage");

    for (const file of [
      "app/(app)/orders/page.tsx",
      "app/(app)/customers/page.tsx",
      "app/(app)/berichte/page.tsx",
      "app/(app)/calendar/page.tsx",
      "app/(app)/dashboard/page.tsx",
      "app/(app)/time-tracking/page.tsx",
      "app/(app)/time-tracking/new/page.tsx",
      "app/(app)/time-tracking/[id]/edit/page.tsx",
      "app/(app)/time-tracking/daily/page.tsx",
      "app/(app)/time-tracking/reports/page.tsx",
      "app/(app)/bring-lists/page.tsx",
      "app/(app)/bring-lists/new/page.tsx",
      "app/(app)/bring-lists/[id]/page.tsx",
      "app/(app)/ai/job-wizard/page.tsx"
    ]) {
      const pageSource = source(file);
      expect(pageSource, file).toContain("safeQueryErrorMessage");
      expect(pageSource, file).not.toContain("?.message");
    }
  });

  it("hardens planning actions against tenant and resource spoofing", () => {
    const planningActions = source("lib/actions/planning-actions.ts");
    const createAssignment = actionBlock(planningActions, "createPlanningAssignmentAction", "archivePlanningAssignmentAction");
    const moveAssignment = actionBlock(planningActions, "movePlanningAssignmentAction", "setPlanningWeatherWarningAction");
    const weatherWarningAction = actionBlock(planningActions, "setPlanningWeatherWarningAction");

    expect(planningActions).toContain("requireManager");
    expect(planningActions).toContain("function assertTargetInCompany");
    expect(planningActions).toContain("assertProfilesInCompany");
    expect(planningActions).toContain("assertVehicleInCompany");
    expect(planningActions).toContain("assertPlanningResourceInCompany");
    expect(planningActions).not.toContain('formData.get("company_id")');
    expect(createAssignment).toContain("resourceTargetFromForm(formData)");
    expect(createAssignment).toContain("company_id: context.companyId");
    expect(createAssignment).toContain("await assertTargetInCompany");
    expect(createAssignment).toContain("loadJobsiteName");
    expect(createAssignment).toContain('.select("id")');
    expect(createAssignment).toContain(".maybeSingle()");
    expect(createAssignment).toContain("if (error || !data)");
    expect(moveAssignment).toContain("moveInputSchema.parse");
    expect(moveAssignment).toContain("await assertTargetInCompany");
    expect(moveAssignment).toContain('.eq("company_id", context.companyId)');
    expect(weatherWarningAction).toContain('requiredFormUuid(formData, "check_id", "Wetterwarnung")');
    expect(weatherWarningAction).toContain('.from("planning_weather_checks")');
    expect(weatherWarningAction).toContain("acknowledged_by: context.userId");
    expect(weatherWarningAction).toContain('.eq("company_id", context.companyId)');
    expect(weatherWarningAction).toContain('.select("id")');
    expect(weatherWarningAction).toContain(".maybeSingle()");
    expect(weatherWarningAction).toContain("if (error || !data)");
  });
});
