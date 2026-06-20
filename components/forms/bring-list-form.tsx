"use client";

import { useMemo, useState } from "react";
import { Check, ListPlus, Plus, Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { VoiceInputField } from "@/components/voice/VoiceInputField";
import { VoiceTextarea } from "@/components/voice/VoiceTextarea";
import { includesGermanSearch } from "@/lib/text/german";
import { parseBringListDraft } from "@/lib/voice/parser";
import type { BringListItemType, Jobsite, Profile, Vehicle } from "@/types/app";

type BringListRow = {
  name: string;
  quantity: string;
  unit: string;
  itemType: BringListItemType;
};

const emptyRow: BringListRow = {
  name: "",
  quantity: "",
  unit: "Stück",
  itemType: "material"
};

function tomorrowIsoDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function labelForJobsite(jobsite: Jobsite) {
  return `${jobsite.name} - ${jobsite.customer}`;
}

function matchJobsite(jobsites: Jobsite[], targetName: string | null) {
  if (!targetName) return "";
  const normalized = targetName.toLowerCase();
  return (
    jobsites.find(
      (jobsite) =>
        includesGermanSearch(jobsite.name, normalized) ||
        includesGermanSearch(jobsite.customer, normalized) ||
        includesGermanSearch(normalized, jobsite.name) ||
        includesGermanSearch(normalized, jobsite.customer)
    )?.id ?? ""
  );
}

export function BringListForm({
  action,
  jobsites,
  employees,
  vehicles,
  canManage,
  selectedJobId,
  defaultDate = tomorrowIsoDate()
}: {
  action: (formData: FormData) => Promise<void>;
  jobsites: Jobsite[];
  employees: Profile[];
  vehicles: Vehicle[];
  canManage: boolean;
  selectedJobId?: string;
  defaultDate?: string;
}) {
  const [voiceText, setVoiceText] = useState("");
  const [jobId, setJobId] = useState(selectedJobId ?? "");
  const [date, setDate] = useState(defaultDate);
  const [title, setTitle] = useState("Mitbringliste morgen");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<BringListRow[]>([
    { ...emptyRow, name: "", quantity: "", unit: "Stück" },
    { ...emptyRow },
    { ...emptyRow },
    { ...emptyRow }
  ]);
  const parsed = useMemo(() => parseBringListDraft(voiceText), [voiceText]);
  const hasParsedItems = parsed.items.length > 0 || parsed.targetName || parsed.date;

  function applyVoiceDraft() {
    const matchedJobId = matchJobsite(jobsites, parsed.targetName);
    if (matchedJobId) setJobId(matchedJobId);
    if (parsed.date) setDate(parsed.date);
    if (parsed.targetName) setTitle(`Mitbringliste ${parsed.targetName}`);
    if (parsed.notes) setNotes(parsed.notes);
    if (parsed.items.length > 0) {
      setRows(
        parsed.items.map((item) => ({
          name: item.name,
          quantity: String(item.quantity).replace(".", ","),
          unit: item.unit,
          itemType: item.itemType
        }))
      );
    }
  }

  function updateRow(index: number, patch: Partial<BringListRow>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="return_to" value="/bring-lists/new" />

      <section className="surface-strong construction-rail p-4 sm:p-5">
        <div className="mb-4">
          <p className="section-kicker">Sprache zuerst</p>
          <h2 className="section-title">Was brauchen wir morgen?</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Diktieren, Vorschlag prüfen, Positionen anpassen und speichern. Preise werden hier nicht angezeigt.
          </p>
        </div>

        <VoiceTextarea
          name="voice_draft"
          label="Diktat oder Text"
          value={voiceText}
          onValueChange={setVoiceText}
          rows={4}
          placeholder="Für morgen bei Baustelle Mueller brauchen wir 20 Latten, 3 Rollen Unterspannbahn, Schrauben und den großen Brenner."
        />

        {hasParsedItems ? (
          <div className="mt-3 rounded-lg border border-primary/20 bg-mint p-3">
            <p className="meta-label">Vorschlag erkannt</p>
            <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
              <Info label="Baustelle" value={parsed.targetName ?? "Bitte auswählen"} />
              <Info label="Datum" value={parsed.date ?? "Morgen"} />
              <Info label="Positionen" value={String(parsed.items.length)} />
            </div>
            {parsed.items.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {parsed.items.slice(0, 6).map((item, index) => (
                  <span key={`${item.name}-${index}`} className="rounded-md bg-white px-3 py-1.5 text-xs font-bold text-ink">
                    {item.quantity} {item.unit} {item.name}
                  </span>
                ))}
              </div>
            ) : null}
            <button type="button" className="btn-primary mt-3 w-full sm:w-auto" onClick={applyVoiceDraft}>
              <Check className="h-4 w-4" aria-hidden="true" />
              Vorschlag übernehmen
            </button>
          </div>
        ) : null}
      </section>

      <section className="surface p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="field-label">Baustelle</span>
            <select className="field-input min-h-14 text-base" name="job_id" value={jobId} onChange={(event) => setJobId(event.target.value)} required>
              <option value="">Baustelle auswählen</option>
              {jobsites.map((jobsite) => (
                <option key={jobsite.id} value={jobsite.id}>
                  {labelForJobsite(jobsite)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Datum</span>
            <input className="field-input min-h-14 text-base" name="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <VoiceInputField label="Titel" name="title" value={title} onValueChange={setTitle} placeholder="Mitbringliste morgen" />
          {canManage ? (
            <label>
              <span className="field-label">Mitarbeiter optional</span>
              <select className="field-input min-h-14 text-base" name="assigned_to" defaultValue="">
                <option value="">Nicht zuweisen</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name || employee.email}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {canManage ? (
            <label>
              <span className="field-label">Fahrzeug optional</span>
              <select className="field-input min-h-14 text-base" name="vehicle_id" defaultValue="">
                <option value="">Kein Fahrzeug</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name} - {vehicle.license_plate}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="mt-4">
          <VoiceTextarea label="Notizen" name="notes" value={notes} onValueChange={setNotes} rows={3} />
        </div>
      </section>

      <section className="surface p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-kicker">Bestätigung</p>
            <h2 className="section-title">Material und Werkzeug</h2>
          </div>
          <button type="button" className="btn-secondary" onClick={() => setRows((current) => [...current, { ...emptyRow }])}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Position
          </button>
        </div>

        <div className="grid gap-3">
          {rows.map((row, index) => (
            <div key={index} className="rounded-lg border border-line bg-white p-3 shadow-sm">
              <div className="grid gap-2 md:grid-cols-[1fr_110px_120px_140px_auto]">
                <input
                  className="field-input min-h-14 text-base"
                  name="item_name"
                  placeholder={index === 0 ? "z. B. Dachlatten" : "Position"}
                  value={row.name}
                  onChange={(event) => updateRow(index, { name: event.target.value })}
                />
                <input
                  className="field-input min-h-14 text-base"
                  name="item_quantity"
                  inputMode="decimal"
                  placeholder="Menge"
                  value={row.quantity}
                  onChange={(event) => updateRow(index, { quantity: event.target.value })}
                />
                <input
                  className="field-input min-h-14 text-base"
                  name="item_unit"
                  placeholder="Einheit"
                  value={row.unit}
                  onChange={(event) => updateRow(index, { unit: event.target.value })}
                />
                <select
                  className="field-input min-h-14 text-base"
                  name="item_type"
                  value={row.itemType}
                  onChange={(event) => updateRow(index, { itemType: event.target.value as BringListItemType })}
                >
                  <option value="material">Material</option>
                  <option value="tool">Werkzeug</option>
                  <option value="document">Dokument</option>
                  <option value="safety">PSA</option>
                  <option value="other">Sonstiges</option>
                </select>
                <button
                  type="button"
                  className="inline-flex min-h-12 items-center justify-center rounded-md border border-red-200 bg-red-50 px-3 text-danger"
                  onClick={() => removeRow(index)}
                  aria-label="Position entfernen"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <SubmitButton className="w-full sm:w-auto">
            <ListPlus className="h-4 w-4" aria-hidden="true" />
            Mitbringliste speichern
          </SubmitButton>
        </div>
      </section>
    </form>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white p-3">
      <p className="meta-label">{label}</p>
      <p className="mt-1 font-black text-ink">{value}</p>
    </div>
  );
}
