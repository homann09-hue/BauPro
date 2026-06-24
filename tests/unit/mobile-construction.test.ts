import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VoiceInputField } from "@/components/voice/VoiceInputField";
import { parseBringListDraft } from "@/lib/voice/parser";
import { supportsSpeechRecognition } from "@/lib/voice/speech";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("mobile construction workflows", () => {
  it("renders voice input safely without browser SpeechRecognition", () => {
    expect(supportsSpeechRecognition()).toBe(false);
    const html = renderToString(
      React.createElement(VoiceInputField, {
        name: "activity",
        label: "Tätigkeit",
        defaultValue: "",
        placeholder: "Diktieren oder tippen"
      })
    );

    expect(html).toContain("Tätigkeit");
    expect(html).toContain("Diktieren oder tippen");
  });

  it("parses spoken bring-list text without price fields", () => {
    const draft = parseBringListDraft(
      "Für morgen bei Baustelle Müller brauchen wir 20 Latten, 3 Rollen Unterspannbahn, Schrauben und den großen Brenner. EK 20 Euro nicht anzeigen."
    );

    expect(draft.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(draft.targetName).toContain("Müller");
    expect(draft.items.some((item) => item.name.toLowerCase().includes("latten"))).toBe(true);
    expect(draft.items.some((item) => item.itemType === "tool" && item.name.toLowerCase().includes("brenner"))).toBe(true);
    expect(JSON.stringify(draft.items)).not.toMatch(/purchase_price|sales_price|price_net|price_gross|margin|markup/i);
  });

  it("keeps employee time entries scoped to the authenticated user server-side", () => {
    const actions = source("lib/actions/time-tracking-actions.ts");
    expect(actions).toContain('const employeeId = canManage ? requiredString(formData, "employee_id") : currentEmployeeId ?? userId;');
    expect(actions).toContain('const status = statusValue(formData.get("status"), canManage);');
  });

  it("exposes the five important construction actions directly in mobile navigation", () => {
    const shell = source("components/app-shell.tsx");

    for (const item of [
      '{ href: "/dashboard", label: "Heute", icon: "dashboard" }',
      '{ href: "/baustellen", label: "Baustellen", icon: "baustellen" }',
      '{ href: "/time-tracking", label: "Zeiten", icon: "zeiten" }',
      '{ href: "/material-melden", label: "Material", icon: "materialMelden" }',
      '{ href: "/berichte", label: "Berichte", icon: "berichte" }'
    ]) {
      expect(shell).toContain(item);
    }

    expect(shell).toContain('{ href: "/materials/inventory", label: "Lager", icon: "lager" }');
    expect(shell).toContain('{ href: "/settings", label: "Setup", icon: Settings }');
  });

  it("turns the Heute card into a mobile construction mode", () => {
    const ui = source("components/construction-ui.tsx");
    const maps = source("lib/maps/google-maps.ts");

    expect(ui).toContain("Baustellenmodus");
    expect(ui).toContain("In Google Maps öffnen");
    expect(maps).toContain("https://www.google.com/maps/search/");
    expect(ui).toContain("Material fehlt");
    expect(ui).toContain("Foto hochladen");
  });

  it("locally saves important mobile form drafts without storing files or passwords", () => {
    const draftAutosave = source("components/offline/form-draft-autosave.tsx");
    const timeForm = source("components/forms/time-entry-form.tsx");
    const reportForm = source("components/forms/report-form.tsx");
    const materialPage = source("app/(app)/material-melden/page.tsx");

    expect(draftAutosave).toContain('"file", "password", "hidden"');
    expect(draftAutosave).toContain("localStorage.setItem");
    expect(timeForm).toContain("baupro:time-entry");
    expect(reportForm).toContain("baupro:report");
    expect(materialPage).toContain("baupro:material-report");
  });

  it("keeps bring-list voice flow free of price fields and still runs stock alerts", () => {
    const form = source("components/forms/bring-list-form.tsx");
    const actions = source("lib/actions/bring-list-actions.ts");

    expect(form).not.toMatch(/purchase_price|sales_price|price_net|price_gross|margin|markup_percent/);
    expect(actions).toContain("await checkBringListAvailability");
    expect(source("lib/inventory/check-availability.ts")).toContain("createOrUpdateMaterialAlert");
  });

  it("keeps employee-facing material reporting free of price fields", () => {
    const page = source("app/(app)/material-melden/page.tsx");
    expect(page).not.toMatch(/purchase_price|sales_price|price_net|price_gross|margin|markup_percent/);
    expect(page).toContain("Preis- und Einkaufsdaten bleiben ausgeblendet");
    expect(page).toContain("Materialname");
  });
});
