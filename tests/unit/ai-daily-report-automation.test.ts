import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("AI daily report automation", () => {
  it("requires explicit opt-in and keeps OpenAI behind a server endpoint", () => {
    const route = read("app/api/ai/report-draft/route.ts");
    const component = read("components/ai/report-draft-assistant.tsx");

    expect(route).toContain("reportDraftRequestSchema");
    expect(route).toContain("aiProcessingOptIn");
    expect(route).toContain("z.literal(true");
    expect(route).toContain("getOptionalAppContext");
    expect(route).toContain("signedReportPhotoUrls");
    expect(route).toContain("generateDailyReportDraftFromPayload");
    expect(component).toContain('fetch("/api/ai/report-draft"');
    expect(component).toContain("KI-Verarbeitung erlauben");
    expect(component).not.toContain("OPENAI_API_KEY");
  });

  it("structures the prompt into construction report sections without inventing facts", () => {
    const prompts = read("lib/ai/prompts.ts");
    const types = read("lib/ai/types.ts");

    for (const section of [
      "Allgemeine Angaben",
      "Wetter",
      "Mitarbeiter",
      "Ausgeführte Arbeiten",
      "Materialverbrauch",
      "Maschinen/Fahrzeuge",
      "Besonderheiten",
      "Mängel/Behinderungen",
      "Nächste Schritte"
    ]) {
      expect(prompts).toContain(section);
    }

    expect(prompts).toContain("Erfinde niemals Baustellen, Namen, Zeiten, Wetter, Mengen, Materialien, Mängel oder Fotos");
    expect(prompts).toContain("missing_information");
    expect(types).toContain("DailyReportAutomationContext");
    expect(types).toContain("missing_information: string[]");
  });

  it("supports photo context and editable AI sections before applying to the form", () => {
    const openai = read("lib/ai/openai.ts");
    const component = read("components/ai/report-draft-assistant.tsx");
    const form = read("components/forms/report-form.tsx");

    expect(openai).toContain("input_image");
    expect(openai).toContain("imageUrls");
    expect(component).toContain("DraftEditor");
    expect(component).toContain("existingPhotoIds");
    expect(component).toContain("selected_photo_names");
    expect(component).toContain("In Formular übernehmen");
    expect(form).toContain("existingPhotos={photos.map");
  });

  it("logs token usage and preserves the existing AI gate", () => {
    const actions = read("lib/actions/ai-actions.ts");

    expect(actions).toContain("generateDailyReportDraftFromPayload");
    expect(actions).toContain('feature: "daily_report"');
    expect(actions).toContain("checkAiLimit");
    expect(actions).toContain("checkRateLimit");
    expect(actions).toContain("logAiUsage");
    expect(actions).toContain("OpenAI genutzt");
  });
});
