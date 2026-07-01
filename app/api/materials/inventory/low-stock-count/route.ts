import { NextResponse, type NextRequest } from "next/server";
import { getOptionalAppContext } from "@/lib/auth";
import { formatQuantity, isLowStock } from "@/lib/inventory";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InventoryItem, PublicInventoryItem } from "@/types/app";

type StockItem = Pick<InventoryItem | PublicInventoryItem, "id" | "name" | "unit" | "stock" | "minimum_stock" | "location_id">;

function scanLimitFromRequest(request: NextRequest) {
  const requested = Number(request.nextUrl.searchParams.get("limit") ?? 300);
  if (!Number.isFinite(requested)) return 300;
  return Math.min(500, Math.max(50, Math.trunc(requested)));
}

export async function GET(request: NextRequest) {
  const context = await getOptionalAppContext();

  if (!context) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const scanLimit = scanLimitFromRequest(request);
  const result = await (context.canManage ? supabase.from("inventory_items") : supabase.from("inventory_items_public"))
    .select("id, name, unit, stock, minimum_stock, location_id")
    .eq("company_id", context.companyId)
    .limit(scanLimit);

  const queryError = safeQueryErrorMessage(result.error);

  if (queryError) {
    return NextResponse.json({ error: queryError }, { status: 500 });
  }

  const stockItems = (result.data ?? []) as StockItem[];
  const lowStockCount = stockItems.filter(isLowStock).length;

  return NextResponse.json(
    {
      count: lowStockCount,
      label: stockItems.length >= scanLimit ? `${formatQuantity(lowStockCount)}+` : formatQuantity(lowStockCount)
    },
    {
      headers: {
        "Cache-Control": "private, max-age=30"
      }
    }
  );
}
