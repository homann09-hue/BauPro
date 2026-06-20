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
        label: "Taetigkeit",
        defaultValue: "",
        placeholder: "Diktieren oder tippen"
      })
    );

    expect(html).toContain("Taetigkeit");
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
  });
});
