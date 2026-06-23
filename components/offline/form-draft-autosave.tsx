"use client";

import { useEffect, useState } from "react";
import { CloudOff, RotateCcw, Save } from "lucide-react";

const DRAFT_VERSION = 1;
const SAVE_DELAY_MS = 350;

type DraftValue = string | string[];
type DraftPayload = {
  version: number;
  updatedAt: string;
  values: Record<string, DraftValue>;
};

type RestorableField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function fieldsFor(form: HTMLFormElement) {
  return Array.from(form.querySelectorAll<RestorableField>("input[name], select[name], textarea[name]"));
}

function shouldSkipField(field: RestorableField) {
  if (field.disabled) return true;
  if (field instanceof HTMLInputElement) {
    return ["file", "password", "hidden", "submit", "button", "reset"].includes(field.type);
  }

  return false;
}

function readDraft(storageKey: string) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftPayload;
    return parsed.version === DRAFT_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function writeDraft(storageKey: string, payload: DraftPayload) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // Wenn der lokale Speicher voll oder gesperrt ist, bleibt das Formular normal nutzbar.
  }
}

function removeDraft(storageKey: string) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Lokales Loeschen ist Komfort, kein sicherheitskritischer Pfad.
  }
}

function dispatchFormEvents(field: RestorableField) {
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function collectValues(form: HTMLFormElement) {
  const values: Record<string, DraftValue> = {};

  for (const field of fieldsFor(form)) {
    if (shouldSkipField(field)) continue;

    if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) {
      const current = values[field.name];
      const checkedValues = Array.isArray(current) ? current : [];
      if (field.checked) checkedValues.push(field.value);
      values[field.name] = checkedValues;
      continue;
    }

    if (field instanceof HTMLSelectElement && field.multiple) {
      values[field.name] = Array.from(field.selectedOptions).map((option) => option.value);
      continue;
    }

    values[field.name] = field.value;
  }

  return values;
}

function restoreValues(form: HTMLFormElement, values: Record<string, DraftValue>) {
  for (const field of fieldsFor(form)) {
    if (shouldSkipField(field)) continue;
    const draftValue = values[field.name];
    if (draftValue === undefined) continue;

    if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) {
      field.checked = Array.isArray(draftValue) ? draftValue.includes(field.value) : draftValue === field.value;
      dispatchFormEvents(field);
      continue;
    }

    if (field instanceof HTMLSelectElement && field.multiple && Array.isArray(draftValue)) {
      for (const option of Array.from(field.options)) {
        option.selected = draftValue.includes(option.value);
      }
      dispatchFormEvents(field);
      continue;
    }

    if (typeof draftValue === "string") {
      field.value = draftValue;
      dispatchFormEvents(field);
    }
  }
}

function formatSavedAt(isoDate: string) {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(isoDate));
  } catch {
    return "";
  }
}

export function FormDraftAutosave({
  formId,
  storageKey,
  description = "Eingaben werden lokal auf diesem Gerät gesichert. Bei schlechtem Empfang geht dein Entwurf nicht sofort verloren."
}: {
  formId: string;
  storageKey: string;
  description?: string;
}) {
  const [restored, setRestored] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const formElement = document.getElementById(formId);
    if (!(formElement instanceof HTMLFormElement)) return undefined;
    const form = formElement;

    const draft = readDraft(storageKey);
    if (draft) {
      restoreValues(form, draft.values);
      window.setTimeout(() => {
        setRestored(true);
        setSavedAt(draft.updatedAt);
      }, 0);
    }

    let timer: number | undefined;

    function saveSoon() {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const payload: DraftPayload = {
          version: DRAFT_VERSION,
          updatedAt: new Date().toISOString(),
          values: collectValues(form)
        };
        writeDraft(storageKey, payload);
        setSavedAt(payload.updatedAt);
      }, SAVE_DELAY_MS);
    }

    function clearAfterSuccessfulOnlineSubmit() {
      if (navigator.onLine) removeDraft(storageKey);
    }

    form.addEventListener("input", saveSoon, { passive: true });
    form.addEventListener("change", saveSoon, { passive: true });
    form.addEventListener("submit", clearAfterSuccessfulOnlineSubmit);

    return () => {
      window.clearTimeout(timer);
      form.removeEventListener("input", saveSoon);
      form.removeEventListener("change", saveSoon);
      form.removeEventListener("submit", clearAfterSuccessfulOnlineSubmit);
    };
  }, [formId, storageKey]);

  function discardDraft() {
    removeDraft(storageKey);
    setRestored(false);
    setSavedAt(null);
  }

  return (
    <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-ink">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-warning/30 bg-warning/15 text-warning">
          {savedAt ? <Save className="h-5 w-5" aria-hidden="true" /> : <CloudOff className="h-5 w-5" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-black">
            {restored ? "Entwurf wiederhergestellt" : savedAt ? `Lokal gesichert ${formatSavedAt(savedAt)}` : "Offline bereit"}
          </p>
          <p className="mt-1 leading-6 text-ash">{description}</p>
          {savedAt ? (
            <button
              type="button"
              className="mt-2 inline-flex min-h-10 items-center gap-2 border border-line px-3 text-xs font-black text-ink transition hover:border-primary/50 hover:bg-surface"
              onClick={discardDraft}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Lokalen Entwurf verwerfen
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
