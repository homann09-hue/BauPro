"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type LowStockResponse = {
  label?: string;
  error?: string;
};

export function InventoryLowStockLink({ onlyLowStock, scanLimit }: { onlyLowStock: boolean; scanLimit: number }) {
  const [label, setLabel] = useState<string>("...");

  useEffect(() => {
    const controller = new AbortController();

    void fetch(`/api/materials/inventory/low-stock-count?limit=${scanLimit}`, {
      headers: { accept: "application/json" },
      signal: controller.signal
    })
      .then(async (response) => {
        const payload = (await response.json()) as LowStockResponse;
        if (!response.ok || payload.error) return;
        setLabel(payload.label ?? "0");
      })
      .catch(() => {
        setLabel("?");
      });

    return () => controller.abort();
  }, [scanLimit]);

  return (
    <Link
      href={onlyLowStock ? "/materials/inventory" : "/materials/inventory?low=1"}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-black shadow-sm",
        onlyLowStock ? "bg-ink text-white" : "border border-red-200 bg-red-50 text-red-700"
      )}
    >
      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      {label} knapp
    </Link>
  );
}
