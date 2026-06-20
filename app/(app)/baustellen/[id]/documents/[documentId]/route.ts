import { getOptionalAppContext } from "@/lib/auth";
import { jobsiteDocumentSelect } from "@/lib/data/selects";
import { downloadHeaders } from "@/lib/security/downloads";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Jobsite, JobsiteDocument } from "@/types/app";

type JobsiteAccess = Pick<Jobsite, "id" | "assigned_employee_ids">;

function inlineHeaders(headers: Record<string, string>, filename: string) {
  return {
    ...headers,
    "Content-Disposition": `inline; filename="${filename}"`
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const context = await getOptionalAppContext();
  if (!context) return new Response("Nicht angemeldet", { status: 401 });

  const { id, documentId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: jobsiteData } = await supabase
    .from("jobsites")
    .select("id, assigned_employee_ids")
    .eq("company_id", context.companyId)
    .eq("id", id)
    .maybeSingle();

  if (!jobsiteData) return new Response("Baustelle wurde nicht gefunden.", { status: 404 });

  const jobsite = jobsiteData as JobsiteAccess;
  if (!context.canManage && !jobsite.assigned_employee_ids.includes(context.userId)) {
    return new Response("Keine Berechtigung.", { status: 403 });
  }

  const { data: documentData } = await supabase
    .from("jobsite_documents")
    .select(jobsiteDocumentSelect)
    .eq("company_id", context.companyId)
    .eq("jobsite_id", id)
    .eq("id", documentId)
    .is("archived_at", null)
    .maybeSingle();

  if (!documentData) return new Response("Dokument wurde nicht gefunden.", { status: 404 });

  const document = documentData as JobsiteDocument;
  const { data, error } = await supabase.storage.from("jobsite-documents").download(document.storage_path);
  if (error || !data) return new Response("Dokument konnte nicht geladen werden.", { status: 404 });

  const contentType = document.content_type ?? "application/octet-stream";
  const headers = downloadHeaders(contentType, document.file_name);
  const url = new URL(request.url);
  const finalHeaders = url.searchParams.get("download") === "1" ? headers : inlineHeaders(headers, document.file_name);

  return new Response(new Uint8Array(await data.arrayBuffer()), {
    headers: finalHeaders
  });
}
