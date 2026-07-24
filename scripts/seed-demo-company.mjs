#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY_NAME = "Müller Dachtechnik GmbH";
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || "BauProDemo!2026";
const EMAIL_DOMAIN = "mueller-dachtechnik.example";
const DEMO_CUSTOMER_PORTAL_TOKEN = "demo-schmidt-kundenportal-2026-sicherer-beispiellink";
const downgradedRoles = new Set();

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Bitte NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY setzen.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function todayOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function currentMonth() {
  const date = new Date();
  return { month: date.getMonth() + 1, year: date.getFullYear() };
}

function hashCustomerPortalToken(token) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function contentHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function minutes(start, end, pause) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const gross = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  return { gross_minutes: gross, net_minutes: gross - pause };
}

function rounded(value) {
  return Math.round(value * 100) / 100;
}

function buildCalculationItem({
  companyId,
  calculationId,
  jobsiteId,
  inventoryItem,
  materialName,
  unit,
  baseQuantity,
  wastePercent = 20,
  locationName,
  source = "rule",
  aiReason,
  createdBy
}) {
  const wasteQuantity = rounded((baseQuantity * wastePercent) / 100);
  const totalQuantity = rounded(baseQuantity + wasteQuantity);
  const purchasePrice = Number(inventoryItem?.purchase_price ?? 0);
  const salesPrice = Number(inventoryItem?.sales_price ?? 0);
  const stock = Number(inventoryItem?.stock ?? 0);
  const minimumStock = Number(inventoryItem?.minimum_stock ?? 0);
  const purchaseTotal = purchasePrice > 0 ? rounded(totalQuantity * purchasePrice) : null;
  const salesTotal = salesPrice > 0 ? rounded(totalQuantity * salesPrice) : null;
  const marginTotal = purchaseTotal !== null && salesTotal !== null ? rounded(salesTotal - purchaseTotal) : null;

  return {
    company_id: companyId,
    calculation_id: calculationId,
    jobsite_id: jobsiteId,
    inventory_item_id: inventoryItem?.id ?? null,
    material_name: materialName,
    unit,
    base_quantity: baseQuantity,
    waste_percent: wastePercent,
    waste_quantity: wasteQuantity,
    total_quantity: totalQuantity,
    purchase_price: purchasePrice || null,
    sales_price: salesPrice || null,
    purchase_total: purchaseTotal,
    sales_total: salesTotal,
    margin_total: marginTotal,
    location_name: locationName ?? null,
    stock,
    minimum_stock: minimumStock,
    missing_quantity: rounded(Math.max(totalQuantity - stock, 0)),
    source,
    ai_reason: aiReason ?? null,
    created_by: createdBy
  };
}

function isMissingSchemaError(error) {
  const message = error?.message ?? "";
  return (
    error?.code === "42P01" ||
    error?.code === "42703" ||
    error?.code === "PGRST205" ||
    message.includes("Could not find the table") ||
    message.includes("Could not find the column") ||
    (message.includes("Could not find") && message.includes("column"))
  );
}

function isOptionalSeedPermissionError(error) {
  return error?.message === "not_authorized" || error?.message === "actor_mismatch";
}

async function allowMissing(label, promise) {
  const { error, data } = await promise;
  if (error && !isMissingSchemaError(error)) {
    throw new Error(`${label}: ${error.message}`);
  }
  return data ?? null;
}

async function insertRows(table, rows, select = "*") {
  if (!rows.length) return [];
  const { data, error } = await supabase.from(table).insert(rows).select(select);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function insertOptionalRows(table, rows, select = "*") {
  if (!rows.length) return [];
  const { data, error } = await supabase.from(table).insert(rows).select(select);
  if (error && isMissingSchemaError(error)) {
    console.warn(`Ueberspringe ${table}: Tabelle/Spalte fehlt in der Live-Datenbank.`);
    return [];
  }
  if (error && isOptionalSeedPermissionError(error)) {
    console.warn(`Ueberspringe ${table}: Direkter Demo-Seed ist durch Sicherheitsregeln blockiert.`);
    return [];
  }
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function upsertOptionalRow(table, row, onConflict) {
  const { data, error } = await supabase.from(table).upsert(row, { onConflict }).select("*").single();
  if (error && isMissingSchemaError(error)) {
    console.warn(`Ueberspringe ${table}: Tabelle/Spalte fehlt in der Live-Datenbank.`);
    return null;
  }
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function listAllUsers() {
  const users = [];
  for (let page = 1; page < 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Auth-User konnten nicht geladen werden: ${error.message}`);
    users.push(...(data.users ?? []));
    if ((data.users ?? []).length < 1000) break;
  }
  return users;
}

async function ensureCompany() {
  const { data: existingRows, error: selectError } = await supabase
    .from("companies")
    .select("id, name")
    .eq("name", COMPANY_NAME)
    .limit(1);

  if (selectError) throw new Error(`companies: ${selectError.message}`);
  if (existingRows?.[0]) return existingRows[0];

  const { data, error } = await supabase.from("companies").insert({ name: COMPANY_NAME }).select("id, name").single();
  if (error) throw new Error(`Demo-Firma konnte nicht angelegt werden: ${error.message}`);
  return data;
}

async function markDemoCompanyReady(companyId) {
  await allowMissing(
    "companies onboarding cleanup",
    supabase
      .from("companies")
      .update({
        contact_email: `chef@${EMAIL_DOMAIN}`,
        address: "Dachdeckerweg 8, 50667 Koeln",
        phone: "0221 555000",
        website: "https://mueller-dachtechnik.example",
        onboarding_completed_at: new Date().toISOString()
      })
      .eq("id", companyId)
  );
}

async function ensureUser({ key, email, fullName, role, companyId }, existingUsers) {
  const existing = existingUsers.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  let authRole = role;
  const buildMetadata = (selectedRole) => ({ company_id: companyId, full_name: fullName, role: selectedRole, demo_key: key });
  const authResult = existing
    ? await supabase.auth.admin.updateUserById(existing.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: buildMetadata(authRole)
      })
    : await supabase.auth.admin.createUser({
        email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: buildMetadata(authRole)
      });

  if (authResult.error && role === "vorarbeiter") {
    authRole = "mitarbeiter";
    downgradedRoles.add(email);
    const fallbackResult = existing
      ? await supabase.auth.admin.updateUserById(existing.id, {
          password: DEMO_PASSWORD,
          email_confirm: true,
          user_metadata: buildMetadata(authRole)
        })
      : await supabase.auth.admin.createUser({
          email,
          password: DEMO_PASSWORD,
          email_confirm: true,
          user_metadata: buildMetadata(authRole)
        });
    if (fallbackResult.error || !fallbackResult.data.user) {
      throw new Error(`Demo-User ${email}: ${fallbackResult.error?.message ?? "unbekannter Fehler"}`);
    }
    authResult.data = fallbackResult.data;
    authResult.error = null;
  }

  if (authResult.error || !authResult.data.user) {
    throw new Error(`Demo-User ${email}: ${authResult.error?.message ?? "unbekannter Fehler"}`);
  }

  const user = authResult.data.user;
  const profileRow = {
    id: user.id,
    company_id: companyId,
    email,
    full_name: fullName,
    role: authRole,
    active: true
  };
  let { error: profileError } = await supabase.from("profiles").upsert(profileRow, { onConflict: "id" }).select("*").single();

  if (profileError && role === "vorarbeiter") {
    authRole = "mitarbeiter";
    downgradedRoles.add(email);
    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: buildMetadata(authRole)
    });
    profileError = (
      await supabase
        .from("profiles")
        .upsert({ ...profileRow, role: authRole }, { onConflict: "id" })
        .select("*")
        .single()
    ).error;
  }

  if (profileError) throw new Error(`profiles: ${profileError.message}`);

  return { key, id: user.id, email, fullName, role: authRole };
}

async function cleanupCompany(companyId) {
  const { data: estimates } = await supabase.from("job_estimates").select("id").eq("company_id", companyId);
  const estimateIds = (estimates ?? []).map((row) => row.id);
  if (estimateIds.length) {
    await allowMissing("job_estimate_items cleanup", supabase.from("job_estimate_items").delete().in("estimate_id", estimateIds));
  }

  const { data: reports } = await supabase.from("time_reports").select("id").eq("company_id", companyId);
  const reportIds = (reports ?? []).map((row) => row.id);
  if (reportIds.length) {
    await allowMissing("time_report_entries cleanup", supabase.from("time_report_entries").delete().in("time_report_id", reportIds));
  }

  const { data: bringLists } = await supabase.from("bring_lists").select("id").eq("company_id", companyId);
  const bringListIds = (bringLists ?? []).map((row) => row.id);
  if (bringListIds.length) {
    await allowMissing("bring_list_items cleanup", supabase.from("bring_list_items").delete().in("bring_list_id", bringListIds));
  }

  const tables = [
    "work_order_versions",
    "digital_document_versions",
    "work_orders",
    "customer_portal_messages",
    "customer_portal_events",
    "customer_documents",
    "customer_portal_tokens",
    "job_estimates",
    "ai_job_drafts",
    "ai_actions",
    "ai_usage_logs",
    "time_entry_audit_log",
    "time_reports",
    "time_entries",
    "report_photos",
    "reports",
    "material_alerts",
    "purchase_suggestions",
    "material_usage_reports",
    "material_movements",
    "material_reservations",
    "bring_lists",
    "tasks",
    "job_material_requirements",
    "job_material_calculation_items",
    "job_material_calculations",
    "order_measurement_items",
    "job_dimensions",
    "planning_weather_checks",
    "planning_assignments",
    "resource_documents",
    "planning_resources",
    "orders",
    "jobsites",
    "vehicle_materials",
    "vehicles",
    "inventory_items",
    "suppliers",
    "inventory_locations",
    "materials",
    "customers",
    "calculation_settings",
    "company_pricing_settings",
    "ai_settings"
  ];

  for (const table of tables) {
    await allowMissing(`${table} cleanup`, supabase.from(table).delete().eq("company_id", companyId));
  }
}

async function main() {
  const company = await ensureCompany();
  await markDemoCompanyReady(company.id);
  const existingUsers = await listAllUsers();
  const demoUsers = [
    { key: "chef", email: `chef@${EMAIL_DOMAIN}`, fullName: "Sabine Müller", role: "chef" },
    { key: "v1", email: `niklas@${EMAIL_DOMAIN}`, fullName: "Niklas Berger", role: "vorarbeiter" },
    { key: "v2", email: `tobias@${EMAIL_DOMAIN}`, fullName: "Tobias Klein", role: "vorarbeiter" },
    { key: "m1", email: `max@${EMAIL_DOMAIN}`, fullName: "Max Schneider", role: "mitarbeiter" },
    { key: "m2", email: `lena@${EMAIL_DOMAIN}`, fullName: "Lena Fischer", role: "mitarbeiter" },
    { key: "m3", email: `emre@${EMAIL_DOMAIN}`, fullName: "Emre Yilmaz", role: "mitarbeiter" },
    { key: "m4", email: `sophie@${EMAIL_DOMAIN}`, fullName: "Sophie Weber", role: "mitarbeiter" },
    { key: "m5", email: `jan@${EMAIL_DOMAIN}`, fullName: "Jan Hoffmann", role: "mitarbeiter" }
  ];

  const users = {};
  for (const demoUser of demoUsers) {
    const user = await ensureUser({ ...demoUser, companyId: company.id }, existingUsers);
    users[user.key] = user;
  }

  await cleanupCompany(company.id);

  await upsertOptionalRow(
    "company_pricing_settings",
    {
      company_id: company.id,
      waste_percent: 20,
      default_markup_percent: 35,
      auto_calculate_sales_price: true,
      created_by: users.chef.id
    },
    "company_id"
  );

  await upsertOptionalRow(
    "calculation_settings",
    {
      company_id: company.id,
      default_waste_percent: 20,
      default_vat_rate: 19,
      default_labor_rate_net: 68,
      default_internal_hourly_cost: 39,
      default_profit_markup_percent: 12,
      default_overhead_percent: 14,
      default_travel_flat_rate: 45,
      allow_ai_job_creation: true,
      require_admin_confirmation: true
    },
    "company_id"
  );

  await upsertOptionalRow(
    "ai_settings",
    {
      company_id: company.id,
      enabled: true,
      default_model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      allow_employee_ai: true,
      allow_ai_daily_reports: true,
      allow_ai_time_tracking: true,
      allow_ai_material_matching: true
    },
    "company_id"
  );

  const customers = await insertRows("customers", [
    {
      company_id: company.id,
      customer_type: "privatkunde",
      first_name: "Anna",
      last_name: "Schmidt",
      phone: "0221 555010",
      email: "anna.schmidt@example.com",
      billing_address: "Hauptstrasse 12, 50667 Koeln",
      jobsite_address: "Hauptstrasse 12, 50667 Koeln",
      notes: "Steildachsanierung mit Tonziegeln, Zugang ueber Hof.",
      status: "aktiv",
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      customer_type: "gewerbekunde",
      company: "Baeckerei Kranz GmbH",
      contact_person: "Thomas Kranz",
      phone: "0211 555019",
      email: "technik@baeckerei-kranz.example",
      billing_address: "Marktallee 7, 40213 Duesseldorf",
      jobsite_address: "Marktallee 7, 40213 Duesseldorf",
      notes: "Flachdach ueber Produktion, Arbeiten nur ab 14 Uhr moeglich.",
      status: "aktiv",
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      customer_type: "hausverwaltung",
      company: "Hausverwaltung Rheinblick",
      contact_person: "Katrin Neumann",
      phone: "0228 555023",
      email: "service@rheinblick.example",
      billing_address: "Bonner Strasse 88, 53111 Bonn",
      jobsite_address: "Rosenweg 4, 53115 Bonn",
      notes: "Mehrfamilienhaus, Dachrinne und Fallrohre erneuern.",
      status: "aktiv",
      created_by: users.chef.id
    }
  ]);

  const [schmidt, kranz, rheinblick] = customers;
  const jobsites = await insertRows("jobsites", [
    {
      company_id: company.id,
      name: "Steildachsanierung Schmidt",
      customer: "Anna Schmidt",
      address: "Hauptstrasse 12, 50667 Koeln",
      start_date: todayOffset(1),
      status: "aktiv",
      notes: "120 m2 Dachflaeche, Traufe 18 m, First 11 m. Unterspannbahn und Lattung morgen starten.",
      assigned_employee_ids: [users.v1.id, users.m1.id, users.m2.id, users.m3.id],
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      name: "Flachdach Baeckerei Kranz",
      customer: "Baeckerei Kranz GmbH",
      address: "Marktallee 7, 40213 Duesseldorf",
      start_date: todayOffset(3),
      status: "geplant",
      notes: "Schweissbahn Oberlage, Daemmung pruefen, Ablaufe freihalten.",
      assigned_employee_ids: [users.v2.id, users.m4.id, users.m5.id],
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      name: "Rinnenanlage Rosenweg",
      customer: "Hausverwaltung Rheinblick",
      address: "Rosenweg 4, 53115 Bonn",
      start_date: todayOffset(2),
      status: "geplant",
      notes: "Dachrinne 28 m, zwei Fallrohre, Bewohnerinfo beachten.",
      assigned_employee_ids: [users.v1.id, users.m1.id, users.m5.id],
      created_by: users.chef.id
    }
  ]);

  const [jobSchmidt, jobKranz, jobRheinblick] = jobsites;
  const demoOrders = await insertOptionalRows("orders", [
    {
      company_id: company.id,
      customer_id: schmidt.id,
      jobsite_id: jobSchmidt.id,
      order_number: `AU-${new Date().getFullYear()}-0001`,
      title: "Steildachsanierung Schmidt",
      order_type: "steildach",
      status: "in_arbeit",
      priority: "hoch",
      jobsite_address: jobSchmidt.address,
      start_date: todayOffset(1),
      description: "Unterspannbahn, Konterlattung, Dachlattung und Tonziegel erneuern.",
      internal_notes: "Geruest steht. Materialcheck bis heute 16 Uhr.",
      assigned_employee_ids: [users.v1.id, users.m1.id, users.m2.id, users.m3.id],
      has_dimensions: true,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      customer_id: kranz.id,
      jobsite_id: jobKranz.id,
      order_number: `AU-${new Date().getFullYear()}-0002`,
      title: "Flachdach Baeckerei Kranz",
      order_type: "flachdach",
      status: "angebot",
      priority: "normal",
      jobsite_address: jobKranz.address,
      start_date: todayOffset(3),
      description: "Vor-Kalkulation fuer 95 m2 Flachdach mit Dampfsperre, Daemmung und Oberlage.",
      internal_notes: "Preisbindung beim Baustoffhandel pruefen.",
      assigned_employee_ids: [users.v2.id, users.m4.id, users.m5.id],
      has_dimensions: true,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      customer_id: rheinblick.id,
      jobsite_id: jobRheinblick.id,
      order_number: `AU-${new Date().getFullYear()}-0003`,
      title: "Rinnenanlage Rosenweg",
      order_type: "dachrinne",
      status: "geplant",
      priority: "normal",
      jobsite_address: jobRheinblick.address,
      start_date: todayOffset(2),
      description: "Dachrinne 28 m, zwei Fallrohre, Rinnenhalter und Ablaufstutzen erneuern.",
      internal_notes: "Bewohnerinfo beachten. Materialbedarf mit 20 Prozent Reserve vorbereitet.",
      assigned_employee_ids: [users.v1.id, users.m1.id, users.m5.id],
      has_dimensions: true,
      created_by: users.chef.id
    }
  ]);
  const [orderSchmidt, orderKranz, orderRheinblick] = demoOrders;

  const dimensions =
    orderSchmidt && orderKranz && orderRheinblick
      ? await insertOptionalRows("job_dimensions", [
          {
            company_id: company.id,
            order_id: orderSchmidt.id,
            length_m: 10.8,
            width_m: 14.52,
            area_m2: 112,
            roof_pitch: 35,
            eaves_length_m: 18,
            ridge_length_m: 11,
            verge_length_m: 16,
            valley_length_m: 4,
            wall_connection_length_m: 3.5,
            building_height_m: 7.2,
            roof_windows_count: 2,
            penetrations_count: 3,
            roof_drains_count: 0,
            emergency_overflows_count: 0,
            waste_percent: 20,
            notes: "Demo-Aufmass: zwei Dachflaechen, Abzug Dachfenster/Gaube, Ortgang links beschaedigt.",
            created_by: users.chef.id
          },
          {
            company_id: company.id,
            order_id: orderKranz.id,
            length_m: 9.5,
            width_m: 10,
            area_m2: 95,
            wall_connection_length_m: 22,
            building_height_m: 4.8,
            roof_windows_count: 0,
            penetrations_count: 0,
            roof_drains_count: 2,
            emergency_overflows_count: 1,
            waste_percent: 20,
            notes: "Demo-Flachdach: Produktionsdach, Attika und zwei Ablaeufe, Arbeiten nachmittags planen.",
            created_by: users.chef.id
          },
          {
            company_id: company.id,
            order_id: orderRheinblick.id,
            area_m2: 0,
            eaves_length_m: 28,
            building_height_m: 6.5,
            downpipe_length_m: 14,
            roof_windows_count: 0,
            penetrations_count: 0,
            roof_drains_count: 0,
            emergency_overflows_count: 0,
            waste_percent: 20,
            notes: "Demo-Entwaesserung: RG 333, zwei Fallrohre, Ablaufstutzen korrodiert.",
            created_by: users.chef.id
          }
        ])
      : [];
  const dimensionByOrder = Object.fromEntries(dimensions.map((row) => [row.order_id, row]));

  if (orderSchmidt && orderKranz && orderRheinblick) {
    await insertOptionalRows("order_measurement_items", [
      { company_id: company.id, order_id: orderSchmidt.id, item_type: "roof_area", label: "Hauptdach links", length_m: 10, width_m: 6, quantity: 1, pitch_deg: 35, calculated_area_m2: 73.24, calculated_length_m: 0, count_value: 0, created_by: users.chef.id },
      { company_id: company.id, order_id: orderSchmidt.id, item_type: "roof_area", label: "Hauptdach rechts", length_m: 9, width_m: 5.2, quantity: 1, pitch_deg: 35, calculated_area_m2: 57.13, calculated_length_m: 0, count_value: 0, created_by: users.chef.id },
      { company_id: company.id, order_id: orderSchmidt.id, item_type: "deduction_area", label: "Dachfenster und Gaube", length_m: 3.4, width_m: 5.4, quantity: 1, calculated_area_m2: 18.36, calculated_length_m: 0, count_value: 0, created_by: users.chef.id },
      { company_id: company.id, order_id: orderSchmidt.id, item_type: "eaves_length", label: "Traufe vorne/hinten", length_m: 9, quantity: 2, calculated_area_m2: 0, calculated_length_m: 18, count_value: 0, created_by: users.chef.id },
      { company_id: company.id, order_id: orderSchmidt.id, item_type: "ridge_length", label: "First", length_m: 11, quantity: 1, calculated_area_m2: 0, calculated_length_m: 11, count_value: 0, created_by: users.chef.id },
      { company_id: company.id, order_id: orderSchmidt.id, item_type: "verge_length", label: "Ortgang links/rechts", length_m: 8, quantity: 2, calculated_area_m2: 0, calculated_length_m: 16, count_value: 0, notes: "Ortgang links beschaedigt, Chef prueft Ersatz.", created_by: users.chef.id },
      { company_id: company.id, order_id: orderSchmidt.id, item_type: "valley_length", label: "Kehle an Gaube", length_m: 4, quantity: 1, calculated_area_m2: 0, calculated_length_m: 4, count_value: 0, created_by: users.chef.id },
      { company_id: company.id, order_id: orderSchmidt.id, item_type: "wall_connection_length", label: "Wandanschluss Gaube", length_m: 3.5, quantity: 1, calculated_area_m2: 0, calculated_length_m: 3.5, count_value: 0, created_by: users.chef.id },
      { company_id: company.id, order_id: orderSchmidt.id, item_type: "roof_window", label: "Dachfenster", quantity: 2, calculated_area_m2: 0, calculated_length_m: 0, count_value: 2, created_by: users.chef.id },
      { company_id: company.id, order_id: orderSchmidt.id, item_type: "penetration", label: "Schornstein/Luefter", quantity: 3, calculated_area_m2: 0, calculated_length_m: 0, count_value: 3, created_by: users.chef.id },
      { company_id: company.id, order_id: orderKranz.id, item_type: "roof_area", label: "Flachdach Produktion", length_m: 9.5, width_m: 10, quantity: 1, calculated_area_m2: 95, calculated_length_m: 0, count_value: 0, created_by: users.chef.id },
      { company_id: company.id, order_id: orderKranz.id, item_type: "wall_connection_length", label: "Attika/Wandanschluss", length_m: 22, quantity: 1, calculated_area_m2: 0, calculated_length_m: 22, count_value: 0, created_by: users.chef.id },
      { company_id: company.id, order_id: orderKranz.id, item_type: "roof_drain", label: "Dachablaeufe", quantity: 2, calculated_area_m2: 0, calculated_length_m: 0, count_value: 2, created_by: users.chef.id },
      { company_id: company.id, order_id: orderKranz.id, item_type: "emergency_overflow", label: "Notueberlauf", quantity: 1, calculated_area_m2: 0, calculated_length_m: 0, count_value: 1, created_by: users.chef.id },
      { company_id: company.id, order_id: orderRheinblick.id, item_type: "eaves_length", label: "Dachrinne Vorderseite", length_m: 28, quantity: 1, calculated_area_m2: 0, calculated_length_m: 28, count_value: 0, created_by: users.chef.id },
      { company_id: company.id, order_id: orderRheinblick.id, item_type: "downpipe_length", label: "Zwei Fallrohre", length_m: 7, quantity: 2, calculated_area_m2: 0, calculated_length_m: 14, count_value: 0, created_by: users.chef.id },
      { company_id: company.id, order_id: orderRheinblick.id, item_type: "penetration", label: "Ablaufstutzen ersetzen", quantity: 2, calculated_area_m2: 0, calculated_length_m: 0, count_value: 2, notes: "Altbestand korrodiert.", created_by: users.chef.id }
    ]);
  }

  const locations = await insertRows("inventory_locations", [
    { company_id: company.id, name: "Hauptlager Koeln", location_type: "Hauptlager", notes: "Regal A-C, Palettenplatz hinten" },
    { company_id: company.id, name: "Sprinter K-DT 210", location_type: "Fahrzeuglager", notes: "Vorarbeiter Niklas" },
    { company_id: company.id, name: "Sprinter K-DT 211", location_type: "Fahrzeuglager", notes: "Vorarbeiter Tobias" },
    { company_id: company.id, name: "Container Schmidt", location_type: "Baustelle", notes: "Baustelle Hauptstrasse 12" }
  ]);
  const location = Object.fromEntries(locations.map((row) => [row.name, row]));

  const suppliers = await insertRows("suppliers", [
    { company_id: company.id, name: "Baustoffhandel Rhein", contact_name: "Herr Vogel", phone: "0221 555030", active: true },
    { company_id: company.id, name: "Wuerth Niederlassung Koeln", contact_name: "Frau Klein", phone: "0221 555031", active: true }
  ]);

  const inventory = await insertRows("inventory_items", [
    {
      company_id: company.id,
      location_id: location["Hauptlager Koeln"].id,
      supplier_id: suppliers[0].id,
      name: "Unterspannbahn diffusionsoffen",
      unit: "m2",
      stock: 160,
      minimum_stock: 80,
      package_unit: "Rolle 75 m2",
      manufacturer: "Klober",
      purchase_price: 1.85,
      sales_price: 3.1,
      markup_percent: 35,
      sales_unit: "m2",
      price_per_unit: 3.1,
      notes: "Standard fuer Steildach, immer auf Mindestbestand achten.",
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      location_id: location["Hauptlager Koeln"].id,
      supplier_id: suppliers[0].id,
      name: "Dachlatte 30/50 impr.",
      unit: "lfm",
      stock: 420,
      minimum_stock: 300,
      package_unit: "Bund",
      purchase_price: 0.72,
      sales_price: 1.15,
      markup_percent: 40,
      sales_unit: "lfm",
      price_per_unit: 1.15,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      location_id: location["Hauptlager Koeln"].id,
      supplier_id: suppliers[0].id,
      name: "Konterlatte 40/60 impr.",
      unit: "lfm",
      stock: 210,
      minimum_stock: 250,
      package_unit: "Bund",
      purchase_price: 0.9,
      sales_price: 1.42,
      markup_percent: 38,
      sales_unit: "lfm",
      price_per_unit: 1.42,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      location_id: location["Sprinter K-DT 210"].id,
      supplier_id: suppliers[1].id,
      name: "Spenglerschrauben 4,5x35 Edelstahl",
      unit: "Stueck",
      stock: 280,
      minimum_stock: 500,
      package_unit: "Pack 100",
      manufacturer: "Wuerth",
      purchase_price: 0.08,
      sales_price: 0.16,
      markup_percent: 50,
      sales_unit: "Stueck",
      price_per_unit: 0.16,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      location_id: location["Hauptlager Koeln"].id,
      supplier_id: suppliers[0].id,
      name: "Schweissbahn PYE PV200 S5 Oberlage",
      unit: "m2",
      stock: 70,
      minimum_stock: 120,
      package_unit: "Rolle 5 m2",
      purchase_price: 8.4,
      sales_price: 13.9,
      markup_percent: 40,
      sales_unit: "m2",
      price_per_unit: 13.9,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      location_id: location["Hauptlager Koeln"].id,
      supplier_id: suppliers[0].id,
      name: "Dampfsperre Alu-Bitumen",
      unit: "m2",
      stock: 130,
      minimum_stock: 100,
      package_unit: "Rolle 10 m2",
      purchase_price: 4.3,
      sales_price: 7.2,
      markup_percent: 40,
      sales_unit: "m2",
      price_per_unit: 7.2,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      location_id: location["Hauptlager Koeln"].id,
      supplier_id: suppliers[0].id,
      name: "Daemmung PIR 120 mm",
      unit: "m2",
      stock: 90,
      minimum_stock: 120,
      package_unit: "Paket",
      purchase_price: 14.8,
      sales_price: 24.5,
      markup_percent: 40,
      sales_unit: "m2",
      price_per_unit: 24.5,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      location_id: location["Hauptlager Koeln"].id,
      supplier_id: suppliers[0].id,
      name: "Voranstrich Bitumen",
      unit: "l",
      stock: 24,
      minimum_stock: 20,
      package_unit: "Kanister 10 l",
      purchase_price: 3.9,
      sales_price: 6.8,
      markup_percent: 43,
      sales_unit: "l",
      price_per_unit: 6.8,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      location_id: location["Hauptlager Koeln"].id,
      supplier_id: suppliers[0].id,
      name: "Firstrolle Alu rot",
      unit: "m",
      stock: 18,
      minimum_stock: 12,
      package_unit: "Rolle 5 m",
      purchase_price: 4.8,
      sales_price: 8.2,
      markup_percent: 41,
      sales_unit: "m",
      price_per_unit: 8.2,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      location_id: location["Hauptlager Koeln"].id,
      supplier_id: suppliers[0].id,
      name: "Traufblech Titanzink",
      unit: "m",
      stock: 24,
      minimum_stock: 30,
      package_unit: "Stab 2 m",
      purchase_price: 5.6,
      sales_price: 9.2,
      markup_percent: 39,
      sales_unit: "m",
      price_per_unit: 9.2,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      location_id: location["Hauptlager Koeln"].id,
      supplier_id: suppliers[0].id,
      name: "Dachrinne RG 333 Zink",
      unit: "m",
      stock: 18,
      minimum_stock: 30,
      package_unit: "Stab 3 m",
      purchase_price: 9.4,
      sales_price: 15.9,
      markup_percent: 41,
      sales_unit: "m",
      price_per_unit: 15.9,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      location_id: location["Hauptlager Koeln"].id,
      supplier_id: suppliers[0].id,
      name: "Rinnenhalter verzinkt RG 333",
      unit: "Stueck",
      stock: 38,
      minimum_stock: 60,
      package_unit: "Stueck",
      purchase_price: 2.2,
      sales_price: 4.1,
      markup_percent: 42,
      sales_unit: "Stueck",
      price_per_unit: 4.1,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      location_id: location["Hauptlager Koeln"].id,
      supplier_id: suppliers[0].id,
      name: "Fallrohr Zink DN100",
      unit: "m",
      stock: 10,
      minimum_stock: 18,
      package_unit: "Stab 3 m",
      purchase_price: 8.1,
      sales_price: 13.4,
      markup_percent: 40,
      sales_unit: "m",
      price_per_unit: 13.4,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      location_id: location["Sprinter K-DT 210"].id,
      supplier_id: suppliers[0].id,
      name: "Rohrschelle DN100",
      unit: "Stueck",
      stock: 16,
      minimum_stock: 20,
      package_unit: "Stueck",
      purchase_price: 1.6,
      sales_price: 3,
      markup_percent: 47,
      sales_unit: "Stueck",
      price_per_unit: 3,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      location_id: location["Container Schmidt"].id,
      supplier_id: suppliers[0].id,
      name: "Tonziegel naturrot",
      unit: "Stueck",
      stock: 1380,
      minimum_stock: 0,
      package_unit: "Palette",
      purchase_price: 0.94,
      sales_price: 1.55,
      markup_percent: 39,
      sales_unit: "Stueck",
      price_per_unit: 1.55,
      created_by: users.chef.id
    }
  ]);
  const inventoryByName = Object.fromEntries(inventory.map((row) => [row.name, row]));

  if (orderSchmidt && orderKranz && orderRheinblick) {
    await insertOptionalRows("job_material_requirements", [
      { company_id: company.id, order_id: orderSchmidt.id, dimension_id: dimensionByOrder[orderSchmidt.id]?.id ?? null, jobsite_id: jobSchmidt.id, inventory_item_id: inventoryByName["Unterspannbahn diffusionsoffen"].id, material_name: "Unterspannbahn diffusionsoffen", unit: "m2", base_quantity: 112, waste_percent: 20, waste_quantity: 22.4, total_quantity: 134.4, purchase_price: 1.85, sales_price: 3.1, purchase_total: 248.64, sales_total: 416.64, margin_total: 168, location_name: "Hauptlager Koeln", stock: 160, minimum_stock: 80, created_by: users.chef.id },
      { company_id: company.id, order_id: orderSchmidt.id, dimension_id: dimensionByOrder[orderSchmidt.id]?.id ?? null, jobsite_id: jobSchmidt.id, inventory_item_id: inventoryByName["Konterlatte 40/60 impr."].id, material_name: "Konterlatte 40/60 impr.", unit: "lfm", base_quantity: 260, waste_percent: 20, waste_quantity: 52, total_quantity: 312, purchase_price: 0.9, sales_price: 1.42, purchase_total: 280.8, sales_total: 443.04, margin_total: 162.24, location_name: "Hauptlager Koeln", stock: 210, minimum_stock: 250, created_by: users.chef.id },
      { company_id: company.id, order_id: orderSchmidt.id, dimension_id: dimensionByOrder[orderSchmidt.id]?.id ?? null, jobsite_id: jobSchmidt.id, inventory_item_id: inventoryByName["Dachlatte 30/50 impr."].id, material_name: "Dachlatte 30/50 impr.", unit: "lfm", base_quantity: 420, waste_percent: 20, waste_quantity: 84, total_quantity: 504, purchase_price: 0.72, sales_price: 1.15, purchase_total: 362.88, sales_total: 579.6, margin_total: 216.72, location_name: "Hauptlager Koeln", stock: 420, minimum_stock: 300, created_by: users.chef.id },
      { company_id: company.id, order_id: orderSchmidt.id, dimension_id: dimensionByOrder[orderSchmidt.id]?.id ?? null, jobsite_id: jobSchmidt.id, inventory_item_id: inventoryByName["Tonziegel naturrot"].id, material_name: "Tonziegel naturrot", unit: "Stueck", base_quantity: 1288, waste_percent: 20, waste_quantity: 257.6, total_quantity: 1545.6, purchase_price: 0.94, sales_price: 1.55, purchase_total: 1452.86, sales_total: 2395.68, margin_total: 942.82, location_name: "Container Schmidt", stock: 1380, minimum_stock: 0, created_by: users.chef.id },
      { company_id: company.id, order_id: orderSchmidt.id, dimension_id: dimensionByOrder[orderSchmidt.id]?.id ?? null, jobsite_id: jobSchmidt.id, inventory_item_id: inventoryByName["Firstrolle Alu rot"].id, material_name: "Firstrolle Alu rot", unit: "m", base_quantity: 11, waste_percent: 20, waste_quantity: 2.2, total_quantity: 13.2, purchase_price: 4.8, sales_price: 8.2, purchase_total: 63.36, sales_total: 108.24, margin_total: 44.88, location_name: "Hauptlager Koeln", stock: 18, minimum_stock: 12, created_by: users.chef.id },
      { company_id: company.id, order_id: orderSchmidt.id, dimension_id: dimensionByOrder[orderSchmidt.id]?.id ?? null, jobsite_id: jobSchmidt.id, inventory_item_id: inventoryByName["Traufblech Titanzink"].id, material_name: "Traufblech Titanzink", unit: "m", base_quantity: 18, waste_percent: 20, waste_quantity: 3.6, total_quantity: 21.6, purchase_price: 5.6, sales_price: 9.2, purchase_total: 120.96, sales_total: 198.72, margin_total: 77.76, location_name: "Hauptlager Koeln", stock: 24, minimum_stock: 30, created_by: users.chef.id },
      { company_id: company.id, order_id: orderKranz.id, dimension_id: dimensionByOrder[orderKranz.id]?.id ?? null, jobsite_id: jobKranz.id, inventory_item_id: inventoryByName["Dampfsperre Alu-Bitumen"].id, material_name: "Dampfsperre Alu-Bitumen", unit: "m2", base_quantity: 95, waste_percent: 20, waste_quantity: 19, total_quantity: 114, purchase_price: 4.3, sales_price: 7.2, purchase_total: 490.2, sales_total: 820.8, margin_total: 330.6, location_name: "Hauptlager Koeln", stock: 130, minimum_stock: 100, created_by: users.chef.id },
      { company_id: company.id, order_id: orderKranz.id, dimension_id: dimensionByOrder[orderKranz.id]?.id ?? null, jobsite_id: jobKranz.id, inventory_item_id: inventoryByName["Daemmung PIR 120 mm"].id, material_name: "Daemmung PIR 120 mm", unit: "m2", base_quantity: 95, waste_percent: 20, waste_quantity: 19, total_quantity: 114, purchase_price: 14.8, sales_price: 24.5, purchase_total: 1687.2, sales_total: 2793, margin_total: 1105.8, location_name: "Hauptlager Koeln", stock: 90, minimum_stock: 120, created_by: users.chef.id },
      { company_id: company.id, order_id: orderKranz.id, dimension_id: dimensionByOrder[orderKranz.id]?.id ?? null, jobsite_id: jobKranz.id, inventory_item_id: inventoryByName["Schweissbahn PYE PV200 S5 Oberlage"].id, material_name: "Schweissbahn PYE PV200 S5 Oberlage", unit: "m2", base_quantity: 95, waste_percent: 20, waste_quantity: 19, total_quantity: 114, purchase_price: 8.4, sales_price: 13.9, purchase_total: 957.6, sales_total: 1584.6, margin_total: 627, location_name: "Hauptlager Koeln", stock: 70, minimum_stock: 120, created_by: users.chef.id },
      { company_id: company.id, order_id: orderKranz.id, dimension_id: dimensionByOrder[orderKranz.id]?.id ?? null, jobsite_id: jobKranz.id, inventory_item_id: inventoryByName["Voranstrich Bitumen"].id, material_name: "Voranstrich Bitumen", unit: "l", base_quantity: 28.5, waste_percent: 20, waste_quantity: 5.7, total_quantity: 34.2, purchase_price: 3.9, sales_price: 6.8, purchase_total: 133.38, sales_total: 232.56, margin_total: 99.18, location_name: "Hauptlager Koeln", stock: 24, minimum_stock: 20, created_by: users.chef.id },
      { company_id: company.id, order_id: orderRheinblick.id, dimension_id: dimensionByOrder[orderRheinblick.id]?.id ?? null, jobsite_id: jobRheinblick.id, inventory_item_id: inventoryByName["Dachrinne RG 333 Zink"].id, material_name: "Dachrinne RG 333 Zink", unit: "m", base_quantity: 28, waste_percent: 20, waste_quantity: 5.6, total_quantity: 33.6, purchase_price: 9.4, sales_price: 15.9, purchase_total: 315.84, sales_total: 534.24, margin_total: 218.4, location_name: "Hauptlager Koeln", stock: 18, minimum_stock: 30, created_by: users.chef.id },
      { company_id: company.id, order_id: orderRheinblick.id, dimension_id: dimensionByOrder[orderRheinblick.id]?.id ?? null, jobsite_id: jobRheinblick.id, inventory_item_id: inventoryByName["Rinnenhalter verzinkt RG 333"].id, material_name: "Rinnenhalter verzinkt RG 333", unit: "Stueck", base_quantity: 47, waste_percent: 0, waste_quantity: 0, total_quantity: 47, purchase_price: 2.2, sales_price: 4.1, purchase_total: 103.4, sales_total: 192.7, margin_total: 89.3, location_name: "Hauptlager Koeln", stock: 38, minimum_stock: 60, created_by: users.chef.id },
      { company_id: company.id, order_id: orderRheinblick.id, dimension_id: dimensionByOrder[orderRheinblick.id]?.id ?? null, jobsite_id: jobRheinblick.id, inventory_item_id: inventoryByName["Fallrohr Zink DN100"].id, material_name: "Fallrohr Zink DN100", unit: "m", base_quantity: 14, waste_percent: 20, waste_quantity: 2.8, total_quantity: 16.8, purchase_price: 8.1, sales_price: 13.4, purchase_total: 136.08, sales_total: 225.12, margin_total: 89.04, location_name: "Hauptlager Koeln", stock: 10, minimum_stock: 18, created_by: users.chef.id }
    ]);

    const calculations = await insertOptionalRows(
      "job_material_calculations",
      [
        {
          company_id: company.id,
          jobsite_id: jobSchmidt.id,
          roof_type: "steildach",
          roof_form: "satteldach",
          material_type: "tonziegel",
          length_m: 10.8,
          width_m: 14.52,
          area_m2: 112,
          roof_pitch: 35,
          eaves_length_m: 18,
          ridge_length_m: 11,
          verge_length_m: 16,
          valley_length_m: 4,
          wall_connection_length_m: 3.5,
          penetrations_count: 3,
          roof_windows_count: 2,
          dormers_count: 1,
          chimneys_count: 1,
          waste_percent: 20,
          ai_enabled: false,
          review_notice: "Demo: Vorschlag aus Aufmass und Dachdecker-Regeln. Vor Bestellung fachlich pruefen.",
          notes: "Ziegel ca. 11,5 Stueck/m2, Lattung grob aus Dachflaeche geschaetzt.",
          created_by: users.chef.id
        },
        {
          company_id: company.id,
          jobsite_id: jobKranz.id,
          roof_type: "flachdach",
          roof_form: "flachdach_mit_attika",
          material_type: "bitumenbahn",
          length_m: 9.5,
          width_m: 10,
          area_m2: 95,
          roof_pitch: 2,
          wall_connection_length_m: 22,
          penetrations_count: 3,
          roof_windows_count: 0,
          dormers_count: 0,
          chimneys_count: 0,
          waste_percent: 20,
          ai_enabled: false,
          review_notice: "Demo: Flachdach-Materialliste ist ein Angebotsvorschlag und muss vor Ausfuehrung geprueft werden.",
          notes: "Dampfsperre, Daemmung und Oberlage jeweils mit 20 Prozent Zuschlag.",
          created_by: users.chef.id
        },
        {
          company_id: company.id,
          jobsite_id: jobRheinblick.id,
          roof_type: "entwaesserung",
          roof_form: "satteldach_rinne",
          material_type: "zink",
          length_m: 28,
          area_m2: 0,
          eaves_length_m: 28,
          penetrations_count: 2,
          roof_windows_count: 0,
          dormers_count: 0,
          chimneys_count: 0,
          waste_percent: 20,
          ai_enabled: false,
          review_notice: "Demo: Entwaesserungsbedarf mit 20 Prozent Zuschlag fuer Zuschnitt und Reserve.",
          notes: "Rinnenhalter nach 60 cm Abstand, Fallrohre 2 x 7 m.",
          created_by: users.chef.id
        }
      ],
      "id, jobsite_id"
    );
    const [calcSchmidt, calcKranz, calcRheinblick] = calculations;

    if (calcSchmidt && calcKranz && calcRheinblick) {
      await insertOptionalRows("job_material_calculation_items", [
        buildCalculationItem({ companyId: company.id, calculationId: calcSchmidt.id, jobsiteId: jobSchmidt.id, inventoryItem: inventoryByName["Tonziegel naturrot"], materialName: "Tonziegel naturrot", unit: "Stueck", baseQuantity: 1288, locationName: "Container Schmidt", aiReason: "112 m2 x ca. 11,5 Stueck/m2 plus 20 Prozent Reserve.", createdBy: users.chef.id }),
        buildCalculationItem({ companyId: company.id, calculationId: calcSchmidt.id, jobsiteId: jobSchmidt.id, inventoryItem: inventoryByName["Unterspannbahn diffusionsoffen"], materialName: "Unterspannbahn diffusionsoffen", unit: "m2", baseQuantity: 112, locationName: "Hauptlager Koeln", createdBy: users.chef.id }),
        buildCalculationItem({ companyId: company.id, calculationId: calcSchmidt.id, jobsiteId: jobSchmidt.id, inventoryItem: inventoryByName["Konterlatte 40/60 impr."], materialName: "Konterlatte 40/60 impr.", unit: "lfm", baseQuantity: 260, locationName: "Hauptlager Koeln", aiReason: "Grobe Schaetzung aus Dachflaeche und Sparrenabstand.", createdBy: users.chef.id }),
        buildCalculationItem({ companyId: company.id, calculationId: calcSchmidt.id, jobsiteId: jobSchmidt.id, inventoryItem: inventoryByName["Dachlatte 30/50 impr."], materialName: "Dachlatte 30/50 impr.", unit: "lfm", baseQuantity: 420, locationName: "Hauptlager Koeln", aiReason: "Grobe Schaetzung aus Dachflaeche und Lattenabstand.", createdBy: users.chef.id }),
        buildCalculationItem({ companyId: company.id, calculationId: calcSchmidt.id, jobsiteId: jobSchmidt.id, inventoryItem: inventoryByName["Firstrolle Alu rot"], materialName: "Firstrolle Alu rot", unit: "m", baseQuantity: 11, locationName: "Hauptlager Koeln", createdBy: users.chef.id }),
        buildCalculationItem({ companyId: company.id, calculationId: calcSchmidt.id, jobsiteId: jobSchmidt.id, inventoryItem: inventoryByName["Traufblech Titanzink"], materialName: "Traufblech Titanzink", unit: "m", baseQuantity: 18, locationName: "Hauptlager Koeln", createdBy: users.chef.id }),
        buildCalculationItem({ companyId: company.id, calculationId: calcKranz.id, jobsiteId: jobKranz.id, inventoryItem: inventoryByName["Dampfsperre Alu-Bitumen"], materialName: "Dampfsperre Alu-Bitumen", unit: "m2", baseQuantity: 95, locationName: "Hauptlager Koeln", createdBy: users.chef.id }),
        buildCalculationItem({ companyId: company.id, calculationId: calcKranz.id, jobsiteId: jobKranz.id, inventoryItem: inventoryByName["Daemmung PIR 120 mm"], materialName: "Daemmung PIR 120 mm", unit: "m2", baseQuantity: 95, locationName: "Hauptlager Koeln", createdBy: users.chef.id }),
        buildCalculationItem({ companyId: company.id, calculationId: calcKranz.id, jobsiteId: jobKranz.id, inventoryItem: inventoryByName["Schweissbahn PYE PV200 S5 Oberlage"], materialName: "Schweissbahn PYE PV200 S5 Oberlage", unit: "m2", baseQuantity: 95, locationName: "Hauptlager Koeln", createdBy: users.chef.id }),
        buildCalculationItem({ companyId: company.id, calculationId: calcKranz.id, jobsiteId: jobKranz.id, inventoryItem: inventoryByName["Voranstrich Bitumen"], materialName: "Voranstrich Bitumen", unit: "l", baseQuantity: 28.5, locationName: "Hauptlager Koeln", aiReason: "0,3 l/m2 fuer 95 m2 plus 20 Prozent Reserve.", createdBy: users.chef.id }),
        buildCalculationItem({ companyId: company.id, calculationId: calcRheinblick.id, jobsiteId: jobRheinblick.id, inventoryItem: inventoryByName["Dachrinne RG 333 Zink"], materialName: "Dachrinne RG 333 Zink", unit: "m", baseQuantity: 28, locationName: "Hauptlager Koeln", createdBy: users.chef.id }),
        buildCalculationItem({ companyId: company.id, calculationId: calcRheinblick.id, jobsiteId: jobRheinblick.id, inventoryItem: inventoryByName["Rinnenhalter verzinkt RG 333"], materialName: "Rinnenhalter verzinkt RG 333", unit: "Stueck", baseQuantity: 47, wastePercent: 0, locationName: "Hauptlager Koeln", aiReason: "28 m Traufe / 0,6 m Halterabstand aufgerundet.", createdBy: users.chef.id }),
        buildCalculationItem({ companyId: company.id, calculationId: calcRheinblick.id, jobsiteId: jobRheinblick.id, inventoryItem: inventoryByName["Fallrohr Zink DN100"], materialName: "Fallrohr Zink DN100", unit: "m", baseQuantity: 14, locationName: "Hauptlager Koeln", createdBy: users.chef.id }),
        buildCalculationItem({ companyId: company.id, calculationId: calcRheinblick.id, jobsiteId: jobRheinblick.id, inventoryItem: inventoryByName["Rohrschelle DN100"], materialName: "Rohrschelle DN100", unit: "Stueck", baseQuantity: 8, wastePercent: 0, locationName: "Sprinter K-DT 210", createdBy: users.chef.id })
      ]);
    }
  }

  const vehicles = await insertRows("vehicles", [
    { company_id: company.id, name: "Sprinter 210", license_plate: "K-DT 210", tuv_date: todayOffset(210), notes: "Leitertraeger, Gasflaschenhalter" },
    { company_id: company.id, name: "Pritsche 211", license_plate: "K-DT 211", tuv_date: todayOffset(95), notes: "Materialtransport, Anhängerkupplung" }
  ]);

  const resources = await insertOptionalRows("planning_resources", [
    {
      company_id: company.id,
      name: "Dachaufzug Boecker Junior",
      resource_kind: "maschine",
      status: "defekt",
      inspection_due_date: todayOffset(28),
      maintenance_interval_days: 180,
      last_maintenance_at: todayOffset(-120),
      next_maintenance_at: todayOffset(60),
      location_text: "Hauptlager Koeln",
      responsible_employee_id: users.v1.id,
      notes: "Kabel pruefen lassen. Bewusst defekt, damit die Demo einen Plantafel-Konflikt zeigt.",
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      name: "Gasbrenner-Set gross",
      resource_kind: "werkzeug",
      status: "verfuegbar",
      location_text: "Sprinter K-DT 211",
      responsible_employee_id: users.v2.id,
      vehicle_id: vehicles[1]?.id ?? null,
      notes: "Flachdach-Set mit Ersatzduesen und Druckminderer.",
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      name: "Leiterpaket und Geruestboecke",
      resource_kind: "geraet",
      status: "verfuegbar",
      inspection_due_date: todayOffset(45),
      location_text: "Hauptlager Koeln",
      responsible_employee_id: users.v1.id,
      notes: "Fuer kleine Reparaturen und Rinnenarbeiten.",
      created_by: users.chef.id
    }
  ]);
  const resourceByName = Object.fromEntries(resources.map((row) => [row.name, row]));

  await insertOptionalRows("planning_assignments", [
    {
      company_id: company.id,
      jobsite_id: jobSchmidt.id,
      title: "Schmidt: Unterspannbahn und Lattung",
      resource_type: "employee",
      employee_id: users.m1.id,
      start_date: todayOffset(1),
      end_date: todayOffset(1),
      status: "geplant",
      color: "#2E7D32",
      notes: "Hauptteam morgens direkt zur Hauptstrasse.",
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      jobsite_id: jobRheinblick.id,
      title: "Rheinblick: Rinnenaufmass parallel",
      resource_type: "employee",
      employee_id: users.m1.id,
      start_date: todayOffset(1),
      end_date: todayOffset(1),
      status: "geplant",
      color: "#F59E0B",
      notes: "Demo-Konflikt: Max ist am gleichen Tag doppelt verplant.",
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      jobsite_id: jobSchmidt.id,
      title: "Sprinter 210 fuer Schmidt laden",
      resource_type: "vehicle",
      vehicle_id: vehicles[0].id,
      start_date: todayOffset(1),
      end_date: todayOffset(1),
      status: "aktiv",
      color: "#2563EB",
      notes: "Mitbringliste vor Abfahrt abhaken.",
      created_by: users.chef.id
    },
    ...(resourceByName["Dachaufzug Boecker Junior"]
      ? [
          {
            company_id: company.id,
            jobsite_id: jobSchmidt.id,
            title: "Dachaufzug fuer Schmidt",
            resource_type: "equipment",
            planning_resource_id: resourceByName["Dachaufzug Boecker Junior"].id,
            start_date: todayOffset(1),
            end_date: todayOffset(1),
            status: "geplant",
            color: "#DC2626",
            notes: "Demo-Konflikt: Geraet ist defekt und trotzdem eingeplant.",
            created_by: users.chef.id
          }
        ]
      : []),
    ...(resourceByName["Gasbrenner-Set gross"]
      ? [
          {
            company_id: company.id,
            jobsite_id: jobKranz.id,
            title: "Brenner-Set fuer Flachdach Kranz",
            resource_type: "equipment",
            planning_resource_id: resourceByName["Gasbrenner-Set gross"].id,
            start_date: todayOffset(3),
            end_date: todayOffset(3),
            status: "geplant",
            color: "#1B5E20",
            notes: "Gasflaschen und Duese am Vortag pruefen.",
            created_by: users.chef.id
          }
        ]
      : [])
  ]);

  const timeEntries = [];
  for (const row of [
    { user: users.m1, job: jobSchmidt, date: todayOffset(-2), start: "07:00", end: "16:00", pause: 45, activity: "Geruestzugang geprueft, alte Lattung aufgenommen" },
    { user: users.m2, job: jobSchmidt, date: todayOffset(-2), start: "07:15", end: "16:00", pause: 45, activity: "Unterspannbahn vorbereitet, Dachflaechen gereinigt" },
    { user: users.v1, job: jobSchmidt, date: todayOffset(-1), start: "06:45", end: "15:45", pause: 60, activity: "Materialannahme, Einweisung Team, Ortgang geprueft" },
    { user: users.m4, job: jobKranz, date: todayOffset(-1), start: "08:00", end: "15:30", pause: 30, activity: "Aufmass Flachdach, Abläufe kontrolliert" },
    { user: users.m5, job: jobRheinblick, date: todayOffset(0), start: "07:30", end: "14:30", pause: 30, activity: "Dachrinne demontiert und Fallrohrlaengen aufgenommen" }
  ]) {
    timeEntries.push({
      company_id: company.id,
      employee_id: row.user.id,
      job_id: row.job.id,
      date: row.date,
      work_location: row.job.name,
      work_address: row.job.address,
      start_time: row.start,
      end_time: row.end,
      break_minutes: row.pause,
      ...minutes(row.start, row.end, row.pause),
      activity: row.activity,
      weather: "trocken",
      kilometers: 18,
      notes: null,
      status: "approved",
      approved_by: users.chef.id,
      approved_at: new Date().toISOString(),
      created_by: row.user.id
    });
  }
  const insertedTimeEntries = await insertOptionalRows("time_entries", timeEntries);

  await insertOptionalRows("reports", [
    {
      company_id: company.id,
      jobsite_id: jobSchmidt.id,
      report_date: todayOffset(-1),
      weather: "trocken, 21 Grad",
      weather_summary: "Trocken, 21 °C, leichter Wind - gute Bedingungen fuer Dacharbeiten.",
      weather_temperature_c: 21,
      weather_precipitation_mm: 0,
      weather_wind_kmh: 12,
      weather_source: "open-meteo-demo",
      weather_fetched_at: new Date().toISOString(),
      work_start: "06:45",
      work_end: "15:45",
      employee_ids: [users.v1.id, users.m1.id, users.m2.id],
      activities: "Material angenommen, Unterspannbahn begonnen, Ortgang und Traufe kontrolliert.",
      material_usage: "Unterspannbahn 75 m2, Dachlatten 110 lfm, Konterlatten 60 lfm.",
      machine_usage: "Dachaufzug, Sprinter K-DT 210.",
      issues: "Konterlattenbestand knapp, Nachbestellung erforderlich.",
      report_status: "approved",
      visible_to_customer: true,
      customer_summary:
        "Die Dachflaeche wurde vorbereitet. Unterspannbahn und erste Lattung sind begonnen, der Ortgang links wird gesondert geprueft. Fuer morgen ist zusaetzliches Material eingeplant.",
      customer_released_at: new Date().toISOString(),
      signature_name: "Niklas Berger",
      created_by: users.v1.id
    },
    {
      company_id: company.id,
      jobsite_id: jobRheinblick.id,
      report_date: todayOffset(0),
      weather: "bedeckt",
      work_start: "07:30",
      work_end: "14:30",
      employee_ids: [users.m5.id],
      activities: "Alte Rinne demontiert, Maße fuer neue Rinne und Fallrohre aufgenommen.",
      material_usage: "Rinnenhalter Muster, Schrauben.",
      issues: "Ein Ablaufstutzen stark korrodiert.",
      report_status: "reviewed",
      visible_to_customer: false,
      signature_name: "Jan Hoffmann",
      created_by: users.m5.id
    }
  ]);

  const portalTokens = await insertOptionalRows(
    "customer_portal_tokens",
    [
      {
        company_id: company.id,
        customer_id: schmidt.id,
        jobsite_id: jobSchmidt.id,
        token_hash: hashCustomerPortalToken(DEMO_CUSTOMER_PORTAL_TOKEN),
        label: "Demo: Kundenportal Schmidt",
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        created_by: users.chef.id
      }
    ],
    "id"
  );
  const portalToken = portalTokens[0] ?? null;

  await insertOptionalRows("customer_portal_events", [
    {
      company_id: company.id,
      customer_id: schmidt.id,
      jobsite_id: jobSchmidt.id,
      event_type: "status",
      title: "Baustelle gestartet",
      body: "Geruest steht, Material wurde geprueft und die Dachflaeche ist fuer die naechsten Arbeitsschritte vorbereitet.",
      visible_to_customer: true,
      event_date: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      customer_id: schmidt.id,
      jobsite_id: jobSchmidt.id,
      event_type: "appointment",
      title: "Naechster Termin: Lattung und Ortgang",
      body: "Das Team ist morgen ab ca. 7:00 Uhr vor Ort. Bitte Hofzufahrt freihalten.",
      visible_to_customer: true,
      event_date: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
      created_by: users.v1.id
    },
    {
      company_id: company.id,
      customer_id: schmidt.id,
      jobsite_id: jobSchmidt.id,
      event_type: "photo",
      title: "Fotodokumentation vorbereitet",
      body: "Beispiel-Fotos werden im echten Betrieb einzeln freigegeben. Interne Fotos bleiben verborgen.",
      visible_to_customer: true,
      event_date: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
      created_by: users.v1.id
    },
    {
      company_id: company.id,
      customer_id: schmidt.id,
      jobsite_id: jobSchmidt.id,
      event_type: "document",
      title: "Dokumentenbereich bereit",
      body: "Angebote, Arbeitsauftraege und Abnahmen koennen hier freigegeben und digital bestaetigt werden.",
      visible_to_customer: true,
      event_date: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      customer_id: schmidt.id,
      jobsite_id: jobSchmidt.id,
      event_type: "update",
      title: "Wetterhinweis dokumentiert",
      body: "Trocken, leichter Wind - gute Bedingungen. Falls Regen aufzieht, werden Material und Folien gesichert.",
      visible_to_customer: true,
      event_date: new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString(),
      created_by: users.v1.id
    }
  ]);

  if (portalToken) {
    await insertOptionalRows("customer_portal_messages", [
      {
        company_id: company.id,
        customer_id: schmidt.id,
        jobsite_id: jobSchmidt.id,
        portal_token_id: portalToken.id,
        sender_name: "Anna Schmidt",
        sender_email: "anna.schmidt@example.com",
        message: "Koennen die Dachfenster waehrend der Arbeiten abgedeckt bleiben? Wir sind morgen nicht durchgehend zu Hause.",
        status: "open"
      }
    ]);
  }

  const demoWorkOrderSnapshot = {
    title: "Arbeitsauftrag: Steildachsanierung Schmidt",
    scope_of_work:
      "Unterspannbahn verlegen, Konterlattung und Dachlattung herstellen, Ortgang links pruefen und die naechsten Materialschritte dokumentieren.",
    version: 1,
    customer_id: schmidt.id,
    jobsite_id: jobSchmidt.id
  };
  await insertOptionalRows("work_orders", [
    {
      company_id: company.id,
      customer_id: schmidt.id,
      jobsite_id: jobSchmidt.id,
      order_id: orderSchmidt?.id ?? null,
      title: demoWorkOrderSnapshot.title,
      description: "Demo-Arbeitsauftrag fuer die digitale Kundenfreigabe.",
      scope_of_work: demoWorkOrderSnapshot.scope_of_work,
      price_note: "Preisdetails stehen im Angebot. Interne EK-/Marge-Daten sind nicht Teil des Kundenportals.",
      status: "sent",
      version: 1,
      content_hash: contentHash(demoWorkOrderSnapshot),
      sent_at: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
      created_by: users.chef.id
    }
  ]);

  await insertOptionalRows("tasks", [
    {
      company_id: company.id,
      jobsite_id: jobSchmidt.id,
      title: "Konterlatten nachbestellen",
      description: "Mindestens 150 lfm fuer Schmidt reservieren.",
      assigned_to: users.chef.id,
      due_date: todayOffset(0),
      status: "offen",
      created_by: users.v1.id
    },
    {
      company_id: company.id,
      jobsite_id: jobKranz.id,
      title: "Brenner und Gas pruefen",
      description: "Vor Flachdachtermin Gasbrennerzubehoer kontrollieren.",
      assigned_to: users.v2.id,
      due_date: todayOffset(2),
      status: "in_arbeit",
      created_by: users.chef.id
    }
  ]);

  await insertOptionalRows("material_usage_reports", [
    {
      company_id: company.id,
      inventory_item_id: inventoryByName["Unterspannbahn diffusionsoffen"].id,
      jobsite_id: jobSchmidt.id,
      quantity: 18,
      unit: "m2",
      booking_type: "consume",
      status: "reported",
      reported_by: users.m1.id,
      notes: "Heute auf Nordseite verbraucht, wartet auf Bestaetigung durch Vorarbeiter."
    },
    {
      company_id: company.id,
      inventory_item_id: inventoryByName["Rinnenhalter verzinkt RG 333"].id,
      jobsite_id: jobRheinblick.id,
      quantity: 4,
      unit: "Stueck",
      booking_type: "break",
      status: "reported",
      reported_by: users.m5.id,
      notes: "Vier alte Halter beim Ausbau gebrochen, Ersatz benoetigt."
    }
  ]);

  await insertOptionalRows("material_movements", [
    {
      company_id: company.id,
      inventory_item_id: inventoryByName["Tonziegel naturrot"].id,
      from_location_id: location["Container Schmidt"].id,
      jobsite_id: jobSchmidt.id,
      quantity: 80,
      unit: "Stueck",
      movement_type: "consume",
      created_by: users.v1.id,
      notes: "Demo-Bewegung: erste Palette auf der Nordseite verarbeitet."
    }
  ]);

  const bringLists = await insertOptionalRows("bring_lists", [
    {
      company_id: company.id,
      job_id: jobSchmidt.id,
      date: todayOffset(1),
      title: "Morgen: Schmidt Dachflaeche vorbereiten",
      notes: "Vom Hauptlager und Container Schmidt laden. Fehlende Konterlatten und Ziegelmenge melden.",
      status: "ready",
      created_by: users.chef.id,
      assigned_to: users.v1.id,
      vehicle_id: vehicles[0].id
    },
    {
      company_id: company.id,
      job_id: jobKranz.id,
      date: todayOffset(2),
      title: "Flachdach Kranz packen",
      notes: "Brenner-Set, Dampfsperre, Daemmung und Oberlage pruefen. Daemmung und Oberlage sind knapp.",
      status: "draft",
      created_by: users.chef.id,
      assigned_to: users.v2.id,
      vehicle_id: vehicles[1].id
    },
    {
      company_id: company.id,
      job_id: jobRheinblick.id,
      date: todayOffset(1),
      title: "Rinnenanlage Rosenweg",
      notes: "Rinne, Halter, Fallrohre und Rohrschellen laden. Bestand reicht nicht vollstaendig.",
      status: "ready",
      created_by: users.chef.id,
      assigned_to: users.v1.id,
      vehicle_id: vehicles[1].id
    }
  ]);
  const bringList = bringLists[0] ?? null;
  const bringListKranz = bringLists[1] ?? null;
  const bringListRheinblick = bringLists[2] ?? null;

  if (bringList) {
    await insertOptionalRows("bring_list_items", [
      {
        bring_list_id: bringList.id,
        inventory_item_id: inventoryByName["Unterspannbahn diffusionsoffen"].id,
        custom_item_name: "Unterspannbahn diffusionsoffen",
        item_type: "material",
        quantity: 134.4,
        unit: "m2",
        storage_location: "Hauptlager Koeln",
        vehicle_id: vehicles[0].id,
        missing_reported: false
      },
      {
        bring_list_id: bringList.id,
        inventory_item_id: inventoryByName["Konterlatte 40/60 impr."].id,
        custom_item_name: "Konterlatte 40/60 impr.",
        item_type: "material",
        quantity: 312,
        unit: "lfm",
        storage_location: "Hauptlager Koeln",
        vehicle_id: vehicles[0].id,
        missing_reported: true,
        notes: "Bestand reicht voraussichtlich nicht."
      },
      {
        bring_list_id: bringList.id,
        inventory_item_id: inventoryByName["Dachlatte 30/50 impr."].id,
        custom_item_name: "Dachlatte 30/50 impr.",
        item_type: "material",
        quantity: 504,
        unit: "lfm",
        storage_location: "Hauptlager Koeln",
        vehicle_id: vehicles[0].id,
        missing_reported: true,
        notes: "84 lfm fehlen gegen kalkulierten Bedarf."
      },
      {
        bring_list_id: bringList.id,
        inventory_item_id: inventoryByName["Tonziegel naturrot"].id,
        custom_item_name: "Tonziegel naturrot",
        item_type: "material",
        quantity: 1546,
        unit: "Stueck",
        storage_location: "Container Schmidt",
        vehicle_id: vehicles[0].id,
        missing_reported: true,
        notes: "Containerbestand reicht nicht fuer komplette Dachflaeche."
      },
      {
        bring_list_id: bringList.id,
        inventory_item_id: inventoryByName["Firstrolle Alu rot"].id,
        custom_item_name: "Firstrolle Alu rot",
        item_type: "material",
        quantity: 13.2,
        unit: "m",
        storage_location: "Hauptlager Koeln",
        vehicle_id: vehicles[0].id,
        missing_reported: false
      },
      {
        bring_list_id: bringList.id,
        inventory_item_id: inventoryByName["Traufblech Titanzink"].id,
        custom_item_name: "Traufblech Titanzink",
        item_type: "material",
        quantity: 21.6,
        unit: "m",
        storage_location: "Hauptlager Koeln",
        vehicle_id: vehicles[0].id,
        missing_reported: false
      },
      {
        bring_list_id: bringList.id,
        custom_item_name: "PSA-Set und Absturzsicherung",
        item_type: "safety",
        quantity: 1,
        unit: "Set",
        storage_location: "Sprinter K-DT 210",
        vehicle_id: vehicles[0].id,
        missing_reported: false
      }
    ]);
  }

  if (bringListKranz) {
    await insertOptionalRows("bring_list_items", [
      { bring_list_id: bringListKranz.id, inventory_item_id: inventoryByName["Dampfsperre Alu-Bitumen"].id, custom_item_name: "Dampfsperre Alu-Bitumen", item_type: "material", quantity: 114, unit: "m2", storage_location: "Hauptlager Koeln", vehicle_id: vehicles[1].id, missing_reported: false },
      { bring_list_id: bringListKranz.id, inventory_item_id: inventoryByName["Daemmung PIR 120 mm"].id, custom_item_name: "Daemmung PIR 120 mm", item_type: "material", quantity: 114, unit: "m2", storage_location: "Hauptlager Koeln", vehicle_id: vehicles[1].id, missing_reported: true, notes: "24 m2 fehlen." },
      { bring_list_id: bringListKranz.id, inventory_item_id: inventoryByName["Schweissbahn PYE PV200 S5 Oberlage"].id, custom_item_name: "Schweissbahn PYE PV200 S5 Oberlage", item_type: "material", quantity: 114, unit: "m2", storage_location: "Hauptlager Koeln", vehicle_id: vehicles[1].id, missing_reported: true, notes: "44 m2 fehlen." },
      { bring_list_id: bringListKranz.id, custom_item_name: "Gasbrenner-Set gross", item_type: "tool", quantity: 1, unit: "Set", storage_location: "Pritsche K-DT 211", vehicle_id: vehicles[1].id, missing_reported: false }
    ]);
  }

  if (bringListRheinblick) {
    await insertOptionalRows("bring_list_items", [
      { bring_list_id: bringListRheinblick.id, inventory_item_id: inventoryByName["Dachrinne RG 333 Zink"].id, custom_item_name: "Dachrinne RG 333 Zink", item_type: "material", quantity: 33.6, unit: "m", storage_location: "Hauptlager Koeln", vehicle_id: vehicles[1].id, missing_reported: true, notes: "15,6 m fehlen." },
      { bring_list_id: bringListRheinblick.id, inventory_item_id: inventoryByName["Rinnenhalter verzinkt RG 333"].id, custom_item_name: "Rinnenhalter verzinkt RG 333", item_type: "material", quantity: 47, unit: "Stueck", storage_location: "Hauptlager Koeln", vehicle_id: vehicles[1].id, missing_reported: true, notes: "9 Stueck fehlen." },
      { bring_list_id: bringListRheinblick.id, inventory_item_id: inventoryByName["Fallrohr Zink DN100"].id, custom_item_name: "Fallrohr Zink DN100", item_type: "material", quantity: 16.8, unit: "m", storage_location: "Hauptlager Koeln", vehicle_id: vehicles[1].id, missing_reported: true, notes: "6,8 m fehlen." }
    ]);
  }

  await insertOptionalRows("material_alerts", [
    {
      company_id: company.id,
      inventory_item_id: inventoryByName["Konterlatte 40/60 impr."].id,
      job_id: jobSchmidt.id,
      bring_list_id: bringList?.id ?? null,
      alert_type: "low_stock",
      severity: "critical",
      message: "Konterlatten reichen fuer Baustelle Schmidt voraussichtlich nicht aus.",
      required_quantity: 312,
      available_quantity: 210,
      missing_quantity: 102,
      unit: "lfm",
      status: "open",
      created_by_system: true,
      assigned_to_admin: users.chef.id
    },
    {
      company_id: company.id,
      inventory_item_id: inventoryByName["Daemmung PIR 120 mm"].id,
      job_id: jobKranz.id,
      bring_list_id: bringListKranz?.id ?? null,
      alert_type: "low_stock",
      severity: "warning",
      message: "Daemmung fuer Flachdach Kranz ist zu knapp.",
      required_quantity: 114,
      available_quantity: 90,
      missing_quantity: 24,
      unit: "m2",
      status: "open",
      created_by_system: true,
      assigned_to_admin: users.chef.id
    },
    {
      company_id: company.id,
      inventory_item_id: inventoryByName["Dachrinne RG 333 Zink"].id,
      job_id: jobRheinblick.id,
      bring_list_id: bringListRheinblick?.id ?? null,
      alert_type: "low_stock",
      severity: "critical",
      message: "Dachrinne fuer Rosenweg reicht nicht aus.",
      required_quantity: 33.6,
      available_quantity: 18,
      missing_quantity: 15.6,
      unit: "m",
      status: "open",
      created_by_system: true,
      assigned_to_admin: users.chef.id
    },
    {
      company_id: company.id,
      inventory_item_id: inventoryByName["Spenglerschrauben 4,5x35 Edelstahl"].id,
      alert_type: "below_minimum_after_reservation",
      severity: "warning",
      message: "Spenglerschrauben liegen unter Mindestbestand.",
      required_quantity: 500,
      available_quantity: 280,
      missing_quantity: 220,
      unit: "Stueck",
      status: "open",
      created_by_system: true,
      assigned_to_admin: users.chef.id
    }
  ]);

  await insertOptionalRows("purchase_suggestions", [
    {
      company_id: company.id,
      inventory_item_id: inventoryByName["Konterlatte 40/60 impr."].id,
      job_id: jobSchmidt.id,
      bring_list_id: bringList?.id ?? null,
      quantity_needed: 160,
      unit: "lfm",
      reason: "Bestand unter Mindestbestand und Baustelle Schmidt benoetigt 312 lfm.",
      status: "open"
    },
    {
      company_id: company.id,
      inventory_item_id: inventoryByName["Daemmung PIR 120 mm"].id,
      job_id: jobKranz.id,
      bring_list_id: bringListKranz?.id ?? null,
      quantity_needed: 40,
      unit: "m2",
      reason: "Flachdach Kranz braucht 114 m2 Daemmung, Lager hat 90 m2.",
      status: "open"
    },
    {
      company_id: company.id,
      inventory_item_id: inventoryByName["Schweissbahn PYE PV200 S5 Oberlage"].id,
      job_id: jobKranz.id,
      quantity_needed: 60,
      unit: "m2",
      reason: "Flachdach Kranz braucht kalkuliert 95 m2 plus Verschnitt.",
      status: "open"
    },
    {
      company_id: company.id,
      inventory_item_id: inventoryByName["Dachrinne RG 333 Zink"].id,
      job_id: jobRheinblick.id,
      bring_list_id: bringListRheinblick?.id ?? null,
      quantity_needed: 24,
      unit: "m",
      reason: "Rosenweg braucht 33,6 m Dachrinne, Lager hat 18 m.",
      status: "open"
    }
  ]);

  if (bringList) {
    await insertOptionalRows("material_reservations", [
      {
        company_id: company.id,
        job_id: jobSchmidt.id,
        bring_list_id: bringList.id,
        inventory_item_id: inventoryByName["Unterspannbahn diffusionsoffen"].id,
        quantity_required: 134.4,
        quantity_reserved: 134.4,
        unit: "m2",
        status: "reserved",
        reserved_by: users.chef.id,
        reserved_at: new Date().toISOString()
      }
    ]);
  }

  const workOrders = await insertOptionalRows("work_orders", [
    {
      company_id: company.id,
      customer_id: schmidt.id,
      jobsite_id: jobSchmidt.id,
      order_id: demoOrders[0]?.id ?? null,
      title: "Arbeitsauftrag Steildachsanierung Schmidt",
      description: "Freigabe fuer die naechste Bauphase.",
      scope_of_work:
        "Unterspannbahn verlegen, Konterlattung und Dachlattung montieren, Ortgang links pruefen und Fotodokumentation fuer den Kunden bereitstellen.",
      price_note: "Leistung gemaess Angebot. Interne EK/VK-Preise sind im Kundenportal nicht sichtbar.",
      status: "sent",
      version: 1,
      content_hash: "demo-work-order-schmidt-v1",
      sent_at: new Date().toISOString(),
      created_by: users.chef.id
    }
  ]);

  if (workOrders[0]) {
    await insertOptionalRows("work_order_versions", [
      {
        company_id: company.id,
        work_order_id: workOrders[0].id,
        version: 1,
        snapshot: {
          title: workOrders[0].title,
          description: workOrders[0].description,
          scope_of_work: workOrders[0].scope_of_work,
          price_note: workOrders[0].price_note,
          status: "sent"
        },
        content_hash: "demo-work-order-schmidt-v1",
        created_by: users.chef.id
      }
    ]);
  }

  const { month, year } = currentMonth();
  const monthEntries = insertedTimeEntries.filter((entry) => entry.employee_id === users.m1.id);
  if (monthEntries.length) {
    const report = await insertOptionalRows(
      "time_reports",
      [
        {
          company_id: company.id,
          employee_id: users.m1.id,
          month,
          year,
          date_from: `${year}-${String(month).padStart(2, "0")}-01`,
          date_to: `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`,
          status: "generated",
          generated_by: users.chef.id
        }
      ],
      "id"
    );
    if (report[0]) {
      await insertOptionalRows(
        "time_report_entries",
        monthEntries.map((entry) => ({ time_report_id: report[0].id, time_entry_id: entry.id }))
      );
    }
  }

  console.log("Demo-Firma wurde erstellt/aktualisiert.");
  console.log(`Firma: ${COMPANY_NAME}`);
  console.log(`Chef-Login: chef@${EMAIL_DOMAIN}`);
  console.log(`Passwort: ${DEMO_PASSWORD}`);
  console.log("Weitere Logins: niklas, tobias, max, lena, emre, sophie, jan @mueller-dachtechnik.example");
  if (downgradedRoles.size) {
    console.warn(
      "Hinweis: Die Live-Datenbank kennt die Rolle 'vorarbeiter' noch nicht. Fuehre supabase/migrations/20260615_roles_security_hardening.sql aus und starte npm run seed:demo erneut."
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
