import { SubmitButton } from "@/components/submit-button";
import type { Material } from "@/types/app";

export function MaterialForm({
  action,
  material,
  submitLabel
}: {
  action: (formData: FormData) => Promise<void>;
  material?: Material;
  submitLabel: string;
}) {
  return (
    <form action={action} className="surface p-4 sm:p-5">
      {material ? <input type="hidden" name="id" value={material.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="name">
            Materialname
          </label>
          <input className="field-input" id="name" name="name" defaultValue={material?.name} required />
        </div>
        <div>
          <label className="field-label" htmlFor="category">
            Kategorie
          </label>
          <input className="field-input" id="category" name="category" defaultValue={material?.category ?? ""} />
        </div>
        <div>
          <label className="field-label" htmlFor="unit">
            Einheit
          </label>
          <input className="field-input" id="unit" name="unit" defaultValue={material?.unit ?? "Stk."} required />
        </div>
        <div>
          <label className="field-label" htmlFor="location">
            Lagerort
          </label>
          <select className="field-input" id="location" name="location" defaultValue={material?.location ?? "Lager"}>
            <option value="Lager">Lager</option>
            <option value="Fahrzeug">Fahrzeug</option>
            <option value="Baustelle">Baustelle</option>
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="stock">
            Bestand
          </label>
          <input
            className="field-input"
            id="stock"
            name="stock"
            type="number"
            step="0.01"
            defaultValue={material?.stock ?? 0}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="minimum_stock">
            Mindestbestand
          </label>
          <input
            className="field-input"
            id="minimum_stock"
            name="minimum_stock"
            type="number"
            step="0.01"
            defaultValue={material?.minimum_stock ?? 0}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="purchase_price">
            EK-Preis optional
          </label>
          <input
            className="field-input"
            id="purchase_price"
            name="purchase_price"
            type="number"
            step="0.01"
            defaultValue={material?.purchase_price ?? ""}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="sales_price">
            VK-Preis optional
          </label>
          <input
            className="field-input"
            id="sales_price"
            name="sales_price"
            type="number"
            step="0.01"
            defaultValue={material?.sales_price ?? ""}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
