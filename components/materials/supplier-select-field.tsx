"use client";

import { useCallback, useState } from "react";

type SupplierOption = {
  id: string;
  name: string;
};

type SupplierResponse = {
  suppliers?: SupplierOption[];
  error?: string;
};

export function SupplierSelectField({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const loadSuppliers = useCallback(() => {
    if (status !== "idle") return;
    setStatus("loading");

    void fetch("/api/materials/inventory/suppliers", {
      headers: { accept: "application/json" }
    })
      .then(async (response) => {
        const payload = (await response.json()) as SupplierResponse;
        if (!response.ok || payload.error) {
          setStatus("error");
          return;
        }

        setSuppliers(payload.suppliers ?? []);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [status]);

  return (
    <select
      className="field-input"
      name={name}
      defaultValue={defaultValue}
      onFocus={loadSuppliers}
      onPointerDown={loadSuppliers}
    >
      <option value="">Kein Lieferant</option>
      {defaultValue && status !== "ready" ? <option value={defaultValue}>Aktueller Lieferant</option> : null}
      {status === "loading" ? <option value="">Lieferanten werden geladen...</option> : null}
      {status === "error" ? <option value="">Lieferanten konnten nicht geladen werden</option> : null}
      {suppliers.map((supplier) => (
        <option key={supplier.id} value={supplier.id}>
          {supplier.name}
        </option>
      ))}
    </select>
  );
}
