import { buildBringListPdf, bringListFilename } from "@/lib/bring-list-export";
import { getOptionalAppContext } from "@/lib/auth";
import { bringListDetailSelect, bringListItemWithInventorySelect } from "@/lib/data/selects";
import { downloadHeaders } from "@/lib/security/downloads";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BringList, BringListItem } from "@/types/app";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getOptionalAppContext();
  if (!context) return new Response("Nicht angemeldet", { status: 401 });

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
}
