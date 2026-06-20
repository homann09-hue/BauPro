import { getOptionalAppContext } from "@/lib/auth";
import { resourceDocumentSelect } from "@/lib/data/selects";
import { downloadHeaders } from "@/lib/security/downloads";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ResourceDocument } from "@/types/app";

function inlineHeaders(headers: Record<string, string>, filename: string) {
  return {
    ...headers,
    "Content-Disposition": `inline; filename="${filename}"`
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const context = await getOptionalAppContext();
  if (!context) return new Response("Nicht angemeldet", { status: 401 });

  const { documentId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: documentData } = await supabase
    .from("resource_documents")
    .select(resourceDocumentSelect)
    .eq("company_id", context.companyId)
    .eq("id", documentId)
    .is("archived_at", null)
    .maybeSingle();

  if (!documentData) return new Response("Datei wurde nicht gefunden.", { status: 404 });

  const document = documentData as ResourceDocument;
  const { data, error } = await supabase.storage.from("resource-documents").download(document.storage_path);
  if (error || !data) return new Response("Datei konnte nicht geladen werden.", { status: 404 });

  const contentType = document.content_type ?? "application/octet-stream";
  const headers = downloadHeaders(contentType, document.file_name);
  const url = new URL(request.url);
  const finalHeaders = url.searchParams.get("download") === "1" ? headers : inlineHeaders(headers, document.file_name);

  return new Response(new Uint8Array(await data.arrayBuffer()), {
    headers: finalHeaders
  });
}
