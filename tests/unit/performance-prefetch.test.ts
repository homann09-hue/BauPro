import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prefetchRoutesForRole, prefetchScopesForRole } from "@/lib/performance/prefetch";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function filesUnder(dir: string): string[] {
  const absolute = path.join(root, dir);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(relative);
    return /\.(ts|tsx)$/.test(entry.name) ? [relative] : [];
  });
}

const broadSelectPattern = /\.select\(\s*["'`]\s*\*/;

function expectNoBroadSelects(file: string) {
  expect(source(file), file).not.toMatch(broadSelectPattern);
}

describe("predictive prefetching", () => {
  it("prefetches manager routes without exposing employee pricing routes", () => {
    expect(prefetchRoutesForRole("chef", true)).toEqual(
      expect.arrayContaining([
        "/dashboard",
        "/baustellen",
        "/time-tracking/daily",
        "/berichte",
        "/materials/inventory",
        "/plantafel",
        "/orders",
        "/customers",
        "/materials/delivery-notes",
        "/time-tracking/reports"
      ])
    );
    expect(prefetchScopesForRole("chef", true)).toEqual(
      expect.arrayContaining(["dashboard", "jobsites", "time", "materials"])
    );
    expect(prefetchScopesForRole("chef", true)).not.toContain("weather");
  });

  it("keeps employee and customer prefetch conservative", () => {
    expect(prefetchRoutesForRole("mitarbeiter", false)).toEqual(
      expect.arrayContaining(["/dashboard", "/time-tracking", "/time/new", "/baustellen", "/berichte", "/bring-lists", "/material-melden"])
    );
    expect(prefetchRoutesForRole("mitarbeiter", false)).not.toContain("/team");
    expect(prefetchRoutesForRole("kunde", false)).toEqual([]);
    expect(prefetchScopesForRole("kunde", false)).toEqual([]);
  });

  it("keeps mobile-first loading skeletons on core high-traffic routes", () => {
    for (const file of [
      "app/(app)/dashboard/loading.tsx",
      "app/(app)/baustellen/loading.tsx",
      "app/(app)/bring-lists/loading.tsx",
      "app/(app)/plantafel/loading.tsx",
      "app/(app)/materials/delivery-notes/loading.tsx",
      "app/(app)/materials/inventory/loading.tsx",
      "app/(app)/team/loading.tsx",
      "app/(app)/time-tracking/loading.tsx"
    ]) {
      const code = source(file);
      expect(code, file).toMatch(/PageSkeleton|animate-pulse|skeleton-line/);
    }
  });

  it("mounts predictive prefetching in the authenticated shell", () => {
    const appShell = source("components/app-shell.tsx");
    expect(appShell).toContain("PredictivePrefetch");
    expect(appShell).toContain("role={context.profile.role}");
    expect(appShell).toContain("canManage={context.canManage}");
  });

  it("keeps the route-data warmup endpoint small, private and price-free", () => {
    const route = source("app/api/prefetch/route-data/route.ts");
    expect(route).toContain("stale-while-revalidate=300");
    expect(route).toContain('"X-BauPro-Prefetch"');
    expect(route).toContain("checkRateLimit");
    expect(route).toContain("getClientIp(request.headers)");
    expect(route).toContain("`prefetch:${context.companyId}:${context.userId}:${clientIp}`");
    expect(route).not.toMatch(broadSelectPattern);
    expect(route).not.toMatch(/\b(purchase_price|sales_price|markup_percent|price_net|price_gross|margin_total)\b/);
    expect(route).toContain('scope === "weather"');
    expect(route).toContain("!context.canManage");
    expect(route).toContain('.eq("company_id", context.companyId)');
    expect(route).toContain('.is("archived_at", null)');
    expect(route).toContain('.contains("assigned_employee_ids", [context.userId])');
    expect(route).toContain('.eq("employee_id", context.userId)');
    expect(route).toContain(`.or(\`assigned_to.eq.\${context.userId},created_by.eq.\${context.userId}\`)`);
    expect(route).toContain('.eq("assigned_to", context.userId)');
    expect(route).toContain('scope === "tasks"');
    expect(route).toContain('scope === "time"');
    expect(route).toContain('scope === "planning"');
    expect(route).toContain('scope === "team"');
    expect(route).toContain('.limit(context.canManage ? 180 : 40)');
  });

  it("keeps warm prefetch payloads small and connection-aware in the client", () => {
    const client = source("components/performance/PredictivePrefetch.tsx");
    expect(client).toContain("PREFETCH_PAYLOAD_MAX_CHARS");
    expect(client).toContain("cachePrefetchPayload");
    expect(client).toContain("shouldReduceBackgroundWork");
    expect(client).toContain("connection?.saveData");
    expect(client).toContain("effectiveType");
  });

  it("avoids unbounded child-row reads on heavy material pages", () => {
    const deliveryNotes = source("app/(app)/materials/delivery-notes/page.tsx");
    const catalog = source("app/(app)/materials/catalog/page.tsx");

    expect(deliveryNotes).toContain(".in(\"delivery_note_id\", noteIds)");
    expect(deliveryNotes).not.toContain(".limit(2000)");
    expect(catalog).toContain(".in(\"catalog_item_id\", catalogItemIds)");
    expect(catalog).not.toContain("supabase.from(\"material_aliases\").select(\"catalog_item_id, alias\")\n  ]");
  });

  it("documents and ships follow-up indexes for newer scalable modules", () => {
    const migration = source("supabase/migrations/20260707_performance_followup_indexes.sql");
    const schema = source("supabase/schema.sql");

    for (const indexName of [
      "idx_planning_assignments_company_status_period",
      "idx_delivery_note_items_company_note_created",
      "idx_jobsite_checklists_company_status_created",
      "idx_defects_company_due_status",
      "idx_customer_portal_messages_company_status_created",
      "idx_job_material_requirements_company_order_active"
    ]) {
      expect(migration).toContain(indexName);
      expect(schema).toContain(indexName);
    }
    expect(migration).toContain("to_regclass");
  });

  it("keeps high-traffic app pages away from broad select star queries", () => {
    for (const file of [
      "app/(app)/dashboard/page.tsx",
      "app/(app)/baustellen/[id]/page.tsx",
      "app/(app)/baustellen/[id]/bearbeiten/page.tsx",
      "app/(app)/baustellen/neu/page.tsx",
      "app/(app)/time-tracking/page.tsx",
      "app/(app)/time-tracking/[id]/edit/page.tsx",
      "app/(app)/time-tracking/daily/page.tsx",
      "app/(app)/time-tracking/new/page.tsx",
      "app/(app)/time-tracking/reports/page.tsx",
      "app/(app)/materials/inventory/page.tsx",
      "app/(app)/orders/page.tsx",
      "app/(app)/orders/[id]/page.tsx",
      "app/(app)/orders/new/page.tsx",
      "app/(app)/customers/page.tsx",
      "app/(app)/customers/[id]/page.tsx",
      "app/(app)/customers/[id]/edit/page.tsx",
      "app/(app)/berichte/page.tsx",
      "app/(app)/berichte/[id]/page.tsx",
      "app/(app)/berichte/[id]/bearbeiten/page.tsx",
      "app/(app)/berichte/neu/page.tsx",
      "app/(app)/bring-lists/new/page.tsx",
      "app/(app)/material-melden/page.tsx",
      "lib/customer-portal/tokens.ts",
      "lib/data/selects.ts",
      "lib/time-report-export.ts",
      "lib/auth.ts"
    ]) {
      expectNoBroadSelects(file);
    }
  });

  it("keeps dashboard data warmups explicitly tenant- and role-scoped", () => {
    const dashboard = source("app/(app)/dashboard/page.tsx");
    const dashboardData = source("lib/data/dashboard.ts");
    const dashboardRpc = source("supabase/migrations/20260619_dashboard_rpc.sql");

    expect(dashboard).toContain("loadDashboardSummary");
    expect(dashboard).toContain("loadDashboardDetails");
    expect(dashboard).not.toContain(".from(");
    expect(dashboardData).toContain('supabase.rpc("get_dashboard_summary"');
    expect(dashboardData).toContain("p_company_id: context.companyId");
    expect(dashboardData).toContain("p_user_id: context.userId");
    expect(dashboardData).toContain("p_can_manage: context.canManage");
    expect(dashboardData).toContain("dashboardTag(context.companyId)");
    expect(dashboardRpc).toContain("security definer");
    expect(dashboardRpc).toContain("and p.company_id = p_company_id");
    expect(dashboardRpc).toContain("v_can_manage := v_role in ('admin', 'chef')");
    expect(dashboardRpc).toContain("p_user_id = any(coalesce(j.assigned_employee_ids");
    expect(dashboardRpc).toContain("r.created_by = p_user_id");
    expect(dashboardRpc).toContain("t.assigned_to = p_user_id");
    expect(dashboardRpc).toContain("bl.assigned_to = p_user_id or bl.created_by = p_user_id");
    expect(dashboardRpc).toContain("p.role in ('mitarbeiter', 'vorarbeiter')");
  });

  it("keeps operational list pages tenant- and assignment-scoped for non-managers", () => {
    const jobsitesPage = source("app/(app)/baustellen/page.tsx");
    const calendarPage = source("app/(app)/calendar/page.tsx");
    const calendarData = source("lib/data/calendar-events.ts");
    const bringListsPage = source("app/(app)/bring-lists/page.tsx");
    const timePage = source("app/(app)/time-tracking/page.tsx");

    for (const code of [jobsitesPage, calendarData, bringListsPage, timePage]) {
      expect(code).toContain('.eq("company_id", context.companyId)');
    }

    expect(jobsitesPage).toContain('.contains("assigned_employee_ids", [context.userId])');
    expect(jobsitesPage).toContain("activeCountQuery = activeCountQuery.contains");
    expect(calendarPage).toContain("loadCalendarEvents");
    expect(calendarData).toContain('.contains("assigned_employee_ids", [context.userId])');
    expect(calendarData).toContain('.eq("employee_id", context.userId)');
    expect(bringListsPage).toContain(`.or(\`assigned_to.eq.\${context.userId},created_by.eq.\${context.userId}\`)`);
    expect(timePage).toContain('.eq("employee_id", context.userId)');
  });

  it("loads time tracking relation labels separately to avoid Supabase embed ambiguity", () => {
    for (const file of ["app/(app)/time-tracking/page.tsx", "app/(app)/time-tracking/daily/page.tsx"]) {
      const code = source(file);
      expect(code, file).toContain("selectTimeEntriesWithWeatherFallback");
      expect(code, file).toMatch(/\.select\(select(?:,\s*\{\s*count:\s*"exact"\s*\})?\)/);
      expect(code, file).toContain("profilesById");
      expect(code, file).toContain("jobsitesById");
      expect(code, file).not.toContain("profiles!time_entries_employee_id_fkey");
      expect(code, file).not.toContain("dailyTimeEntrySelect");
    }
  });

  it("keeps time tracking usable when optional weather migration is not applied yet", () => {
    const loader = source("lib/data/time-entries.ts");
    const actions = source("lib/actions/time-tracking-actions.ts");
    const exportData = source("lib/time-report-export.ts");

    expect(source("lib/data/selects.ts")).toContain("timeEntryLegacySelect");
    expect(loader).toContain("isMissingTimeEntryWeatherSchema");
    expect(loader).toContain("stripTimeEntryWeatherPayload");
    expect(actions).toContain("timeEntryWriteOptions");
    expect(exportData).toContain("selectTimeEntriesWithWeatherFallback");
    expect(exportData).not.toContain("profiles!time_entries_employee_id_fkey");
  });

  it("keeps report, jobsite and mobile form loaders scoped before exposing detail data", () => {
    for (const file of [
      "app/(app)/berichte/[id]/page.tsx",
      "app/(app)/berichte/[id]/bearbeiten/page.tsx",
      "app/(app)/berichte/neu/page.tsx",
      "app/(app)/baustellen/[id]/page.tsx",
      "app/(app)/bring-lists/new/page.tsx",
      "app/(app)/material-melden/page.tsx",
      "app/(app)/time-tracking/[id]/edit/page.tsx",
      "app/(app)/time-tracking/new/page.tsx"
    ]) {
      const code = source(file);
      expect(code, file).toContain('.eq("company_id", context.companyId)');
    }

    expect(source("lib/data/reports.ts")).toContain("if (!canManage) reportsQuery = reportsQuery.eq(\"created_by\", userId)");
    expect(source("app/(app)/berichte/[id]/page.tsx")).toContain('reportQuery = reportQuery.eq("created_by", context.userId)');
    expect(source("app/(app)/berichte/[id]/bearbeiten/page.tsx")).toContain('reportQuery = reportQuery.eq("created_by", context.userId)');
    expect(source("app/(app)/baustellen/[id]/page.tsx")).toContain('.contains("assigned_employee_ids", [context.userId])');

    for (const file of [
      "app/(app)/berichte/[id]/bearbeiten/page.tsx",
      "app/(app)/berichte/neu/page.tsx",
      "app/(app)/bring-lists/new/page.tsx",
      "app/(app)/material-melden/page.tsx",
      "app/(app)/time-tracking/[id]/edit/page.tsx",
      "app/(app)/time-tracking/new/page.tsx"
    ]) {
      expect(source(file), file).toContain('.contains("assigned_employee_ids", [context.userId])');
    }
  });

  it("keeps pricing and supplier offer pages manager-only and tenant-filtered", () => {
    for (const file of [
      "app/(app)/materials/inventory/[id]/page.tsx",
      "app/(app)/materials/online-discovery/page.tsx",
      "app/(app)/materials/live-offers/page.tsx",
      "app/(app)/materials/live-offers/new/page.tsx"
    ]) {
      const code = source(file);
      expect(code, file).toContain("requireManager");
      expect(code, file).toContain('.eq("company_id", context.companyId)');
    }

    const liveOffers = source("app/(app)/materials/live-offers/page.tsx");
    expect(liveOffers).toContain('const context = await requireManager()');
    expect(liveOffers).toContain('.from("supplier_offers")');
    expect(liveOffers).toContain('.from("supplier_offer_matches")');
  });

  it("keeps authenticated app pages free of broad select star queries", () => {
    for (const file of filesUnder("app/(app)")) {
      expectNoBroadSelects(file);
    }
  });

  it("keeps critical server actions away from broad select star queries", () => {
    for (const file of [
      "lib/actions/time-tracking-actions.ts",
      "lib/actions/order-actions.ts",
      "lib/actions/material-calculation-actions.ts",
      "lib/actions/bring-list-actions.ts",
      "lib/actions/customer-portal-actions.ts",
      "lib/actions/ai-actions.ts",
      "lib/actions/ai-job-actions.ts"
    ]) {
      expectNoBroadSelects(file);
    }

    expect(source("lib/actions/time-tracking-actions.ts")).toContain("timeEntryWriteOptions");
    expect(source("lib/actions/order-actions.ts")).toContain("customerFormSelect");
    expect(source("lib/actions/order-actions.ts")).toContain("jobDimensionSelect");
    expect(source("lib/actions/material-calculation-actions.ts")).toContain("materialCalculationRuleSelect");
    expect(source("lib/actions/material-calculation-actions.ts")).toContain("inventoryItemCalculationSelect");
  });

  it("keeps shared server modules away from broad select star queries", () => {
    for (const file of filesUnder("lib")) {
      expectNoBroadSelects(file);
    }
  });

  it("does not pull encrypted supplier API keys into app pages", () => {
    const selects = source("lib/data/selects.ts");
    const supplierIntegrationList = selects.match(/supplierIntegrationListSelect =\n  "([^"]+)";/)?.[1] ?? "";
    expect(supplierIntegrationList).not.toContain("api_key_encrypted");

    for (const file of [
      "app/(app)/suppliers/page.tsx",
      "app/(app)/materials/live-offers/new/page.tsx",
      "app/(app)/materials/live-offers/import/page.tsx"
    ]) {
      expect(source(file), file).toContain("supplierIntegrationListSelect");
      expect(source(file), file).not.toContain("integration.api_key_encrypted");
    }
  });

  it("keeps form loaders tenant-scoped and operational role lists price-safe", () => {
    for (const file of [
      "app/(app)/baustellen/[id]/page.tsx",
      "app/(app)/baustellen/[id]/bearbeiten/page.tsx",
      "app/(app)/baustellen/neu/page.tsx",
      "app/(app)/orders/new/page.tsx",
      "app/(app)/customers/[id]/edit/page.tsx",
      "app/(app)/berichte/[id]/bearbeiten/page.tsx",
      "app/(app)/berichte/neu/page.tsx",
      "app/(app)/time-tracking/[id]/edit/page.tsx",
      "app/(app)/time-tracking/reports/page.tsx",
      "app/(app)/bring-lists/new/page.tsx",
      "app/(app)/material-melden/page.tsx"
    ]) {
      expect(source(file), file).toContain('.eq("company_id", context.companyId)');
    }

    for (const file of [
      "app/(app)/baustellen/[id]/bearbeiten/page.tsx",
      "app/(app)/baustellen/neu/page.tsx",
      "app/(app)/orders/new/page.tsx",
      "app/(app)/berichte/[id]/bearbeiten/page.tsx",
      "app/(app)/berichte/neu/page.tsx",
      "app/(app)/time-tracking/[id]/edit/page.tsx",
      "app/(app)/time-tracking/reports/page.tsx",
      "app/(app)/bring-lists/new/page.tsx"
    ]) {
      expect(source(file), file).toContain('.in("role", ["mitarbeiter", "vorarbeiter"])');
    }

    const selects = source("lib/data/selects.ts");
    const publicCalculationItems = selects.match(/jobMaterialCalculationItemPublicSelect =\n  "([^"]+)";/)?.[1] ?? "";
    expect(publicCalculationItems).not.toMatch(/\b(purchase_price|sales_price|purchase_total|sales_total|margin_total)\b/);
  });

  it("keeps operational lists paginated and visibly loading", () => {
    for (const file of ["lib/data/orders.ts", "lib/data/customers.ts", "lib/data/reports.ts"]) {
      const code = source(file);
      expect(code, file).toMatch(/PageSize/);
      expect(code, file).toContain(".range(");
    }

    expect(source("app/(app)/orders/page.tsx")).toContain("loadOrderList");
    expect(source("app/(app)/customers/page.tsx")).toContain("loadCustomerList");
    expect(source("app/(app)/berichte/page.tsx")).toContain("loadReportList");

    for (const file of ["app/(app)/materials/inventory/page.tsx", "app/(app)/baustellen/page.tsx", "app/(app)/time-tracking/page.tsx"]) {
      const code = source(file);
      expect(code, file).toContain("pageSize");
      expect(code, file).toContain(".range(");
    }

    const inventoryPage = source("app/(app)/materials/inventory/page.tsx");
    const dashboardPage = source("app/(app)/dashboard/page.tsx");
    const nextConfig = source("next.config.mjs");

    expect(inventoryPage).toContain("lowStockScanLimit = 300");
    expect(inventoryPage).not.toContain(".limit(1000)");
    expect(dashboardPage).toContain("DashboardDetailsSkeleton");
    expect(nextConfig).toContain('"/time-tracking"');
    expect(nextConfig).toContain('"/material-melden"');

    for (const file of [
      "app/(app)/orders/loading.tsx",
      "app/(app)/customers/loading.tsx",
      "app/(app)/berichte/loading.tsx",
      "app/(app)/customers/[id]/loading.tsx",
      "app/(app)/berichte/[id]/loading.tsx",
      "app/portal/[token]/loading.tsx",
      "app/(app)/dashboard/loading.tsx"
    ]) {
      expect(source(file), file).toContain("PageSkeleton");
    }
  });

  it("keeps legacy navigation entry points as explicit redirects", () => {
    expect(source("app/(app)/material/page.tsx")).toContain('redirect("/materials/inventory")');
    expect(source("app/(app)/materials/page.tsx")).toContain('redirect("/materials/inventory")');
    expect(source("app/(app)/time/new/page.tsx")).toContain('redirect("/time-tracking/new")');
  });

  it("keeps the mobile all-functions entry as a real navigation surface", () => {
    const morePage = source("app/(app)/mehr/page.tsx");
    expect(morePage).toContain("Alle Funktionen");
    expect(morePage).toContain("Was möchtest du tun?");
    expect(morePage).not.toContain("redirect(");
  });

  it("prefetches already-authorized portal assets for customers", () => {
    const portal = source("app/portal/[token]/page.tsx");
    const component = source("components/performance/PortalAssetPrefetch.tsx");
    expect(portal).toContain("PortalAssetPrefetch");
    expect(portal).toContain("prefetchAssetUrls");
    expect(component).toContain('link.rel = "prefetch"');
  });
});
