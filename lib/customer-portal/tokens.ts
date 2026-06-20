import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  CommercialDocument,
  Customer,
  CustomerDocument,
  CustomerPortalEvent,
  CustomerPortalMessage,
  CustomerPortalToken,
  Defect,
  Jobsite,
  JobsiteDocument,
  Order,
  Report,
  ReportPhoto,
  WorkOrder
} from "@/types/app";

export const CUSTOMER_PORTAL_TOKEN_BYTES = 32;
export const CUSTOMER_PORTAL_TOKEN_DAYS = 45;

export type PortalPhoto = ReportPhoto & { signedUrl?: string };
export type PortalDocument = CustomerDocument & { signedUrl?: string };
export type PortalJobsiteDocument = Pick<
  JobsiteDocument,
  "id" | "company_id" | "jobsite_id" | "category" | "title" | "storage_path" | "file_name" | "content_type" | "visible_to_customer" | "created_at"
> & { signedUrl?: string };
export type PortalTokenData = Omit<CustomerPortalToken, "token_hash">;
export type PortalReport = Pick<
  Report,
  | "id"
  | "company_id"
  | "jobsite_id"
  | "report_date"
  | "weather_summary"
  | "weather_temperature_c"
  | "weather_precipitation_mm"
  | "weather_wind_kmh"
  | "weather_source"
  | "weather_fetched_at"
  | "activities"
  | "material_usage"
  | "machine_usage"
  | "report_status"
  | "customer_summary"
  | "customer_released_at"
  | "created_at"
>;
export type PortalOrder = Pick<
  Order,
  "id" | "company_id" | "customer_id" | "jobsite_id" | "order_number" | "title" | "order_type" | "status" | "jobsite_address" | "start_date" | "end_date" | "description" | "created_at"
>;
export type PortalCommercialDocument = Pick<
  CommercialDocument,
  | "id"
  | "company_id"
  | "order_id"
  | "customer_id"
  | "jobsite_id"
  | "document_type"
  | "document_number"
  | "status"
  | "subject"
  | "issue_date"
  | "due_date"
  | "valid_until"
  | "total_gross"
  | "sent_at"
  | "accepted_at"
  | "paid_at"
  | "created_at"
>;
export type PortalWorkOrder = Pick<
  WorkOrder,
  | "id"
  | "company_id"
  | "customer_id"
  | "jobsite_id"
  | "order_id"
  | "title"
  | "description"
  | "scope_of_work"
  | "price_note"
  | "status"
  | "version"
  | "content_hash"
  | "sent_at"
  | "viewed_at"
  | "signed_at"
  | "rejected_at"
  | "signer_name"
  | "signature_data_url"
  | "signature_role"
  | "rejection_reason"
  | "created_by"
  | "created_at"
  | "updated_at"
>;
export type PortalDefect = Pick<
  Defect,
  | "id"
  | "company_id"
  | "jobsite_id"
  | "title"
  | "description"
  | "priority"
  | "status"
  | "due_date"
  | "visible_to_customer"
  | "customer_released_at"
  | "created_at"
>;

export type CustomerPortalData = {
  token: PortalTokenData;
  company: { id: string; name: string; phone: string | null; contact_email: string | null; address: string | null };
  customer: Pick<Customer, "id" | "company" | "first_name" | "last_name" | "contact_person" | "email" | "phone">;
  jobsite: Pick<Jobsite, "id" | "name" | "address" | "status" | "start_date"> | null;
  progressPercent: number;
  events: CustomerPortalEvent[];
  appointments: CustomerPortalEvent[];
  weatherDelays: Array<{ id: string; title: string; body: string | null; date: string }>;
  reports: PortalReport[];
  photos: PortalPhoto[];
  documents: PortalDocument[];
  jobsiteDocuments: PortalJobsiteDocument[];
  orders: PortalOrder[];
  commercialDocuments: PortalCommercialDocument[];
  messages: CustomerPortalMessage[];
  workOrders: PortalWorkOrder[];
  defects: PortalDefect[];
};

export function createCustomerPortalToken() {
  return crypto.randomBytes(CUSTOMER_PORTAL_TOKEN_BYTES).toString("base64url");
}

export function hashCustomerPortalToken(token: string) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function customerPortalPath(token: string) {
  return `/portal/${encodeURIComponent(token)}`;
}

export function customerPortalUrl(origin: string, token: string) {
  const cleanOrigin = origin.replace(/\/$/, "");
  return `${cleanOrigin}${customerPortalPath(token)}`;
}

export function customerPortalExpiresAt(days = CUSTOMER_PORTAL_TOKEN_DAYS) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt.toISOString();
}

function isActiveToken(token: Pick<CustomerPortalToken, "expires_at" | "revoked_at">) {
  return !token.revoked_at && new Date(token.expires_at).getTime() > Date.now();
}

async function signedReportPhoto(photo: ReportPhoto): Promise<PortalPhoto> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.storage.from("report-photos").createSignedUrl(photo.storage_path, 60 * 15);
  return { ...photo, signedUrl: data?.signedUrl };
}

async function signedCustomerDocument(document: CustomerDocument): Promise<PortalDocument> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.storage.from("customer-documents").createSignedUrl(document.storage_path, 60 * 15);
  return { ...document, signedUrl: data?.signedUrl };
}

async function signedJobsiteDocument(document: PortalJobsiteDocument): Promise<PortalJobsiteDocument> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.storage.from("jobsite-documents").createSignedUrl(document.storage_path, 60 * 15);
  return { ...document, signedUrl: data?.signedUrl };
}

function rowsOrEmpty<T>(result: { data: unknown; error: { message?: string } | null }, label: string): T[] {
  if (result.error) {
    console.warn(`customer-portal-${label}-load-failed`, result.error.message ?? "unknown");
    return [];
  }

  return (result.data ?? []) as T[];
}

function calculateProgress({
  jobsite,
  reports,
  photos,
  workOrders
}: {
  jobsite: Pick<Jobsite, "status"> | null;
  reports: PortalReport[];
  photos: PortalPhoto[];
  workOrders: PortalWorkOrder[];
}) {
  if (jobsite?.status === "abgeschlossen") return 100;
  if (jobsite?.status === "geplant") return reports.length || photos.length ? 25 : 10;

  const signedOrders = workOrders.filter((order) => order.status === "signed").length;
  const base = jobsite?.status === "aktiv" ? 45 : 25;
  const reportScore = Math.min(reports.length * 8, 25);
  const photoScore = Math.min(photos.length * 2, 10);
  const signatureScore = Math.min(signedOrders * 10, 20);

  return Math.min(95, base + reportScore + photoScore + signatureScore);
}

function deriveWeatherDelays(events: CustomerPortalEvent[], reports: PortalReport[]) {
  const eventDelays = events
    .filter((event) => {
      const text = `${event.title} ${event.body ?? ""}`.toLowerCase();
      return text.includes("wetter") || text.includes("regen") || text.includes("wind") || text.includes("verzoeger");
    })
    .map((event) => ({ id: event.id, title: event.title, body: event.body, date: event.event_date }));

  const reportDelays = reports
    .filter((report) => Number(report.weather_precipitation_mm ?? 0) > 0.5 || Number(report.weather_wind_kmh ?? 0) >= 35)
    .map((report) => ({
      id: `report-${report.id}`,
      title: "Wetterbedingter Hinweis",
      body: report.weather_summary ?? "Wetter wurde im freigegebenen Tagesbericht dokumentiert.",
      date: report.report_date
    }));

  return [...eventDelays, ...reportDelays].slice(0, 6);
}

export async function loadCustomerPortalData(token: string): Promise<CustomerPortalData | null> {
  if (!token || token.length < 24) return null;

  const supabase = createSupabaseAdminClient();
  const tokenHash = hashCustomerPortalToken(token);

  const { data: tokenRow, error: tokenError } = await supabase
    .from("customer_portal_tokens")
    .select("id, company_id, customer_id, jobsite_id, label, expires_at, revoked_at, created_by, created_at, last_used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenError || !tokenRow || !isActiveToken(tokenRow as PortalTokenData)) return null;

  const portalToken = tokenRow as unknown as PortalTokenData;
  await supabase
    .from("customer_portal_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", portalToken.id);

  let eventsQuery = supabase
    .from("customer_portal_events")
    .select("id, company_id, customer_id, jobsite_id, event_type, title, body, visible_to_customer, event_date, created_by, created_at")
    .eq("company_id", portalToken.company_id)
    .eq("customer_id", portalToken.customer_id)
    .eq("visible_to_customer", true)
    .order("event_date", { ascending: false })
    .limit(20);
  let documentsQuery = supabase
    .from("customer_documents")
    .select("id, company_id, customer_id, jobsite_id, title, storage_path, file_name, content_type, visible_to_customer, uploaded_by, created_at")
    .eq("company_id", portalToken.company_id)
    .eq("customer_id", portalToken.customer_id)
    .eq("visible_to_customer", true)
    .order("created_at", { ascending: false })
    .limit(30);
  let workOrdersQuery = supabase
    .from("work_orders")
    .select(
      "id, company_id, customer_id, jobsite_id, order_id, title, description, scope_of_work, price_note, status, version, content_hash, sent_at, viewed_at, signed_at, rejected_at, signer_name, signature_data_url, signature_role, rejection_reason, created_by, created_at, updated_at"
    )
    .eq("company_id", portalToken.company_id)
    .eq("customer_id", portalToken.customer_id)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(20);
  let ordersQuery = supabase
    .from("orders")
    .select("id, company_id, customer_id, jobsite_id, order_number, title, order_type, status, jobsite_address, start_date, end_date, description, created_at")
    .eq("company_id", portalToken.company_id)
    .eq("customer_id", portalToken.customer_id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  let commercialDocumentsQuery = supabase
    .from("commercial_documents")
    .select("id, company_id, order_id, customer_id, jobsite_id, document_type, document_number, status, subject, issue_date, due_date, valid_until, total_gross, sent_at, accepted_at, paid_at, created_at")
    .eq("company_id", portalToken.company_id)
    .eq("customer_id", portalToken.customer_id)
    .in("status", ["sent", "accepted", "paid"])
    .is("archived_at", null)
    .order("issue_date", { ascending: false })
    .limit(20);
  let messagesQuery = supabase
    .from("customer_portal_messages")
    .select("id, company_id, customer_id, jobsite_id, portal_token_id, sender_name, sender_email, message, status, answered_at, answered_by, created_at")
    .eq("company_id", portalToken.company_id)
    .eq("customer_id", portalToken.customer_id)
    .order("created_at", { ascending: false })
    .limit(20);
  let defectsQuery = supabase
    .from("defects")
    .select("id, company_id, jobsite_id, title, description, priority, status, due_date, visible_to_customer, customer_released_at, created_at")
    .eq("company_id", portalToken.company_id)
    .eq("visible_to_customer", true)
    .not("customer_released_at", "is", null)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (portalToken.jobsite_id) {
    eventsQuery = eventsQuery.eq("jobsite_id", portalToken.jobsite_id);
    documentsQuery = documentsQuery.eq("jobsite_id", portalToken.jobsite_id);
    workOrdersQuery = workOrdersQuery.eq("jobsite_id", portalToken.jobsite_id);
    ordersQuery = ordersQuery.eq("jobsite_id", portalToken.jobsite_id);
    commercialDocumentsQuery = commercialDocumentsQuery.eq("jobsite_id", portalToken.jobsite_id);
    messagesQuery = messagesQuery.eq("jobsite_id", portalToken.jobsite_id);
    defectsQuery = defectsQuery.eq("jobsite_id", portalToken.jobsite_id);
  } else {
    defectsQuery = defectsQuery.eq("jobsite_id", "00000000-0000-0000-0000-000000000000");
  }

  const [companyResult, customerResult, jobsiteResult, eventsResult, reportsResult, photosResult, documentsResult, jobsiteDocumentsResult, ordersResult, commercialDocumentsResult, messagesResult, workOrdersResult, defectsResult] =
    await Promise.all([
      supabase
        .from("companies")
        .select("id, name, phone, contact_email, address")
        .eq("id", portalToken.company_id)
        .single(),
      supabase
        .from("customers")
        .select("id, company, first_name, last_name, contact_person, email, phone")
        .eq("id", portalToken.customer_id)
        .eq("company_id", portalToken.company_id)
        .single(),
      portalToken.jobsite_id
        ? supabase
            .from("jobsites")
            .select("id, name, address, status, start_date")
            .eq("id", portalToken.jobsite_id)
            .eq("company_id", portalToken.company_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      eventsQuery,
      portalToken.jobsite_id
        ? supabase
            .from("reports")
            .select(
              "id, company_id, jobsite_id, report_date, weather_summary, weather_temperature_c, weather_precipitation_mm, weather_wind_kmh, weather_source, weather_fetched_at, activities, material_usage, machine_usage, report_status, customer_summary, customer_released_at, created_at"
            )
            .eq("company_id", portalToken.company_id)
            .eq("jobsite_id", portalToken.jobsite_id)
            .eq("visible_to_customer", true)
            .eq("report_status", "approved")
            .is("archived_at", null)
            .order("report_date", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [], error: null }),
      portalToken.jobsite_id
        ? supabase
            .from("report_photos")
            .select("id, company_id, report_id, jobsite_id, storage_path, file_name, content_type, visible_to_customer, customer_caption, thumbnail_path, approved_by, approved_at, created_at")
            .eq("company_id", portalToken.company_id)
            .eq("jobsite_id", portalToken.jobsite_id)
            .eq("visible_to_customer", true)
            .is("archived_at", null)
            .order("created_at", { ascending: false })
            .limit(60)
        : Promise.resolve({ data: [], error: null }),
      documentsQuery,
      portalToken.jobsite_id
        ? supabase
            .from("jobsite_documents")
            .select("id, company_id, jobsite_id, category, title, storage_path, file_name, content_type, visible_to_customer, created_at")
            .eq("company_id", portalToken.company_id)
            .eq("jobsite_id", portalToken.jobsite_id)
            .eq("visible_to_customer", true)
            .is("archived_at", null)
            .order("created_at", { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [], error: null }),
      ordersQuery,
      commercialDocumentsQuery,
      messagesQuery,
      workOrdersQuery,
      defectsQuery
    ]);

  if (companyResult.error || customerResult.error || !companyResult.data || !customerResult.data) return null;

  const events = rowsOrEmpty<CustomerPortalEvent>(eventsResult, "events");
  const reports = rowsOrEmpty<PortalReport>(reportsResult, "reports");
  const photos = await Promise.all(rowsOrEmpty<ReportPhoto>(photosResult, "photos").map(signedReportPhoto));
  const documents = await Promise.all(rowsOrEmpty<CustomerDocument>(documentsResult, "documents").map(signedCustomerDocument));
  const jobsiteDocuments = await Promise.all(rowsOrEmpty<PortalJobsiteDocument>(jobsiteDocumentsResult, "jobsite-documents").map(signedJobsiteDocument));
  const orders = rowsOrEmpty<PortalOrder>(ordersResult, "orders");
  const commercialDocuments = rowsOrEmpty<PortalCommercialDocument>(commercialDocumentsResult, "commercial-documents");
  const messages = rowsOrEmpty<CustomerPortalMessage>(messagesResult, "messages");
  const workOrders = rowsOrEmpty<PortalWorkOrder>(workOrdersResult, "work-orders");
  const defects = rowsOrEmpty<PortalDefect>(defectsResult, "defects");

  const pendingViewedUpdates = workOrders
    .filter((workOrder) => workOrder.status === "sent")
    .map((workOrder) =>
      supabase
        .from("work_orders")
        .update({ status: "viewed", viewed_at: new Date().toISOString() })
        .eq("id", workOrder.id)
        .eq("status", "sent")
    );
  await Promise.allSettled(pendingViewedUpdates);

  return {
    token: portalToken,
    company: companyResult.data,
    customer: customerResult.data,
    jobsite: jobsiteResult.data ?? null,
    progressPercent: calculateProgress({ jobsite: jobsiteResult.data ?? null, reports, photos, workOrders }),
    events,
    appointments: events.filter((event) => event.event_type === "appointment"),
    weatherDelays: deriveWeatherDelays(events, reports),
    reports,
    photos,
    documents,
    jobsiteDocuments,
    orders,
    commercialDocuments,
    messages,
    defects,
    workOrders: workOrders.map((workOrder) =>
      workOrder.status === "sent"
        ? { ...workOrder, status: "viewed", viewed_at: workOrder.viewed_at ?? new Date().toISOString() }
        : workOrder
    )
  };
}

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = normalizeForHash((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }

  return value;
}

export function stableJson(value: unknown) {
  return JSON.stringify(normalizeForHash(value));
}

export function contentHash(value: unknown) {
  return crypto.createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

export function publicWorkOrderSnapshot(workOrder: WorkOrder, overrides: Partial<WorkOrder> = {}) {
  const snapshot = {
    id: workOrder.id,
    title: overrides.title ?? workOrder.title,
    description: overrides.description ?? workOrder.description,
    scope_of_work: overrides.scope_of_work ?? workOrder.scope_of_work,
    price_note: overrides.price_note ?? workOrder.price_note,
    status: overrides.status ?? workOrder.status,
    version: overrides.version ?? workOrder.version,
    signer_name: overrides.signer_name ?? workOrder.signer_name,
    signature_role: overrides.signature_role ?? workOrder.signature_role,
    signature_data_hash: contentHash(overrides.signature_data_url ?? workOrder.signature_data_url ?? ""),
    signed_at: overrides.signed_at ?? workOrder.signed_at,
    rejected_at: overrides.rejected_at ?? workOrder.rejected_at,
    rejection_reason: overrides.rejection_reason ?? workOrder.rejection_reason
  };

  return snapshot;
}
