"use client";

import { useMemo, useState } from "react";
import { BrainCircuit, Calculator } from "lucide-react";
import { createMaterialCalculationAction } from "@/lib/actions/material-calculation-actions";
import { materialTypeLabels, roofFormLabels, roofTypeLabels } from "@/lib/material-calculations";
import { SubmitButton } from "@/components/submit-button";
import type { RoofType } from "@/types/app";

const roofTypes: RoofType[] = ["steildach", "flachdach", "reparatur", "entwaesserung", "blech"];
const roofForms = ["satteldach", "walmdach", "pultdach", "flachdach", "mansarddach", "sonstiges"];
const materialTypes = ["tonziegel", "betondachstein", "schiefer", "bitumen", "metall", "gruen", "sonstiges"];

function decimalValue(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function MaterialCalculationForm({
  jobsiteId,
  defaultWastePercent
}: {
  jobsiteId: string;
  defaultWastePercent: number;
}) {
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [area, setArea] = useState("");

  const calculatedArea = useMemo(() => {
    const lengthValue = decimalValue(length);
    const widthValue = decimalValue(width);

    if (!lengthValue || !widthValue) return "";
    return String(Math.round(lengthValue * widthValue * 100) / 100).replace(".", ",");
  }, [length, width]);

  function updateLength(value: string) {
    setLength(value);
    const widthValue = decimalValue(width);
    const lengthValue = decimalValue(value);
    if (lengthValue && widthValue) {
      setArea(String(Math.round(lengthValue * widthValue * 100) / 100).replace(".", ","));
    }
  }

  function updateWidth(value: string) {
    setWidth(value);
    const widthValue = decimalValue(value);
    const lengthValue = decimalValue(length);
    if (lengthValue && widthValue) {
      setArea(String(Math.round(lengthValue * widthValue * 100) / 100).replace(".", ","));
    }
  }

  return (
    <form action={createMaterialCalculationAction} className="surface p-4 sm:p-5">
      <input type="hidden" name="jobsite_id" value={jobsiteId} />

      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-mint text-moss">
          <Calculator className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="section-title">Material berechnen</h2>
          <p className="text-sm text-slate-500">Dachdecker-Vorschlag mit Regeln, optionaler KI-Prüfung und Lagerabgleich.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          <span className="field-label">Dachart</span>
          <select className="field-input" name="roof_type" defaultValue="steildach">
            {roofTypes.map((type) => (
              <option key={type} value={type}>
                {roofTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Dachform</span>
          <select className="field-input" name="roof_form" defaultValue="satteldach">
            {roofForms.map((form) => (
              <option key={form} value={form}>
                {roofFormLabels[form]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Materialtyp</span>
          <select className="field-input" name="material_type" defaultValue="tonziegel">
            {materialTypes.map((type) => (
              <option key={type} value={type}>
                {materialTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Länge m</span>
          <input
            className="field-input"
            name="length_m"
            inputMode="decimal"
            value={length}
            onChange={(event) => updateLength(event.target.value)}
            placeholder="z. B. 10"
          />
        </label>
        <label>
          <span className="field-label">Breite m</span>
          <input
            className="field-input"
            name="width_m"
            inputMode="decimal"
            value={width}
            onChange={(event) => updateWidth(event.target.value)}
            placeholder="z. B. 8"
          />
        </label>
        <label>
          <span className="field-label">Fläche m²</span>
          <input
            className="field-input"
            name="area_m2"
            inputMode="decimal"
            value={area || calculatedArea}
            onChange={(event) => setArea(event.target.value)}
            placeholder="automatisch"
          />
        </label>
        <label>
          <span className="field-label">Dachneigung °</span>
          <input className="field-input" name="roof_pitch" inputMode="decimal" placeholder="optional" />
        </label>
        <label>
          <span className="field-label">Trauflänge m</span>
          <input className="field-input" name="eaves_length_m" inputMode="decimal" placeholder="optional" />
        </label>
        <label>
          <span className="field-label">Firstlänge m</span>
          <input className="field-input" name="ridge_length_m" inputMode="decimal" placeholder="optional" />
        </label>
        <label>
          <span className="field-label">Ortganglänge m</span>
          <input className="field-input" name="verge_length_m" inputMode="decimal" placeholder="optional" />
        </label>
        <label>
          <span className="field-label">Kehllänge m</span>
          <input className="field-input" name="valley_length_m" inputMode="decimal" placeholder="optional" />
        </label>
        <label>
          <span className="field-label">Wandanschluss/Fallrohr m</span>
          <input className="field-input" name="wall_connection_length_m" inputMode="decimal" placeholder="optional" />
        </label>
        <label>
          <span className="field-label">Durchdringungen</span>
          <input className="field-input" name="penetrations_count" inputMode="numeric" placeholder="0" />
        </label>
        <label>
          <span className="field-label">Dachfenster</span>
          <input className="field-input" name="roof_windows_count" inputMode="numeric" placeholder="0" />
        </label>
        <label>
          <span className="field-label">Gauben</span>
          <input className="field-input" name="dormers_count" inputMode="numeric" placeholder="0" />
        </label>
        <label>
          <span className="field-label">Schornsteine</span>
          <input className="field-input" name="chimneys_count" inputMode="numeric" placeholder="0" />
        </label>
        <label>
          <span className="field-label">Verschnitt %</span>
          <input
            className="field-input"
            name="waste_percent"
            inputMode="decimal"
            defaultValue={String(defaultWastePercent).replace(".", ",")}
          />
        </label>
        <label className="sm:col-span-2 lg:col-span-3">
          <span className="field-label">Notizen</span>
          <input className="field-input" name="notes" placeholder="z. B. grobe Vorkalkulation, Bestand prüfen" />
        </label>
      </div>

      <label className="mt-4 flex items-start gap-3 rounded-lg border border-line bg-fog p-3 text-sm font-semibold text-ink">
        <input type="checkbox" name="use_ai" defaultChecked className="mt-1 h-4 w-4 rounded border-line text-moss" />
        <span>
          <span className="flex items-center gap-2 font-black">
            <BrainCircuit className="h-4 w-4 text-moss" aria-hidden="true" />
            KI-Vorschlag für typische Zusatzpositionen
          </span>
          <span className="mt-1 block text-slate-600">
            Die KI ergänzt nur prüfpflichtige Vorschläge. Mengen und Materialliste müssen fachlich kontrolliert werden.
          </span>
        </span>
      </label>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary opacity-70" disabled title="Nach dem Speichern kann direkt erneut berechnet werden.">
          Weitere Berechnung vorbereitet
        </button>
        <SubmitButton>
          <Calculator className="h-4 w-4" aria-hidden="true" />
          Aus Maßen berechnen
        </SubmitButton>
      </div>
    </form>
  );
}
