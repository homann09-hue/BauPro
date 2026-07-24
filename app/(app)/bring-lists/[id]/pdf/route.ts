import { buildBringListPdf, bringListFilename } from "@/lib/bring-list-export";
import { getOptionalAppContext } from "@/lib/auth";
import { bringListDetailSelect, bringListItemWithInventorySelect } from "@/lib/data/selects";
import { downloadHeaders } from "@/lib/security/downloads";
import { safeErrorMessage, safeErrorStatus } from "@/lib/security/errors";
import { getClientIp } from "@/lib/security/origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BringList, BringListItem } from "@/types/app";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getOptionalAppContext();
  if (!context) return new Response("Nicht angemeldet", { status: 401 });

  try {
    await checkRateLimit(`bring-list-pdf:${context.companyId}:${context.userId}:${getClientIp(request.headers)}`, 40, 60_000);

    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const [listResult, itemsResult] = await Promise.all([
      supabase.from("bring_lists").select(bringListDetailSelect).eq("company_id", context.companyId).eq("id", id).maybeSingle(),
      supabase.from("bring_list_items").select(bringListItemWithInventorySelect).eq("bring_list_id", id).order("created_at")
    ]);

    if (listResult.error || !listResult.data) return new Response("Mitbringliste wurde nicht gefunden.", { status: 404 });

    const list = listResult.data as unknown as BringList;
    const items = (itemsResult.data ?? []) as unknown as BringListItem[];
    const pdf = buildBringListPdf({ companyName: context.companyName, list, items });

    return new Response(new Uint8Array(pdf), {
      headers: downloadHeaders("application/pdf", bringListFilename(list))
    });
  } catch (error) {
    return new Response(safeErrorMessage(error, "PDF konnte nicht erzeugt werden."), { status: safeErrorStatus(error) });
  }
}
