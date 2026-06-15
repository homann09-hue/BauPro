import type { VoiceIntent } from "@/types/app";
import {
  extractActivity,
  extractDate,
  extractMaterials,
  extractTargetName,
  extractTimes,
  hasKeyword,
  type ParsedVoiceInput
} from "@/lib/voice/entity-parser";

export function detectIntent(text: string): VoiceIntent {
  if (hasKeyword(text, ["mitnehmen", "mitbringliste", "einpacken", "morgen mit", "auf laden"])) return "bring_list";
  if (hasKeyword(text, ["gearbeitet", "arbeitszeit", "von", "pause", "stunden"])) return "time_tracking";
  if (hasKeyword(text, ["fehlt", "fehlen", "knapp", "nicht vorhanden", "materialmeldung"])) return "material_alert";
  if (hasKeyword(text, ["notiz", "baustellennotiz", "hinweis"])) return "job_note";
  return "unknown";
}

export function parseVoiceInput(text: string): ParsedVoiceInput {
  const times = extractTimes(text);
  const intent = detectIntent(text);

  return {
    intent,
    date: extractDate(text),
    targetName: extractTargetName(text),
    startTime: times.startTime,
    endTime: times.endTime,
    breakMinutes: times.breakMinutes,
    materials: extractMaterials(text),
    note: intent === "time_tracking" ? extractActivity(text) : text.trim()
  };
}
