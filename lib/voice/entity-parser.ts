import type { VoiceIntent } from "@/types/app";

export type ParsedMaterialEntity = {
  name: string;
  quantity: number;
  unit: string;
};

export type ParsedVoiceInput = {
  intent: VoiceIntent;
  date: string | null;
  targetName: string | null;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number | null;
  materials: ParsedMaterialEntity[];
  note: string | null;
};

const materialStopWords = [
  "und",
  "mitnehmen",
  "fehlen",
  "fehlt",
  "einpacken",
  "fuer",
  "für",
  "baustelle",
  "auftrag",
  "morgen",
  "heute"
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss")
    .replace(/[^\p{L}\p{N},.:\-\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isoDateFromOffset(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function extractDate(text: string) {
  const normalized = normalizeText(text);
  if (normalized.includes("uebermorgen")) return isoDateFromOffset(2);
  if (normalized.includes("morgen")) return isoDateFromOffset(1);
  if (normalized.includes("heute")) return isoDateFromOffset(0);

  const match = normalized.match(/\b(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?\b/);
  if (!match) return null;

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3] ? (match[3].length === 2 ? `20${match[3]}` : match[3]) : String(new Date().getFullYear());
  return `${year}-${month}-${day}`;
}

function normalizeTime(hours: string, minutes?: string) {
  return `${hours.padStart(2, "0")}:${(minutes ?? "00").padStart(2, "0")}`;
}

export function extractTimes(text: string) {
  const normalized = normalizeText(text);
  const range = normalized.match(/\bvon\s+(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?\s+bis\s+(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?/);
  const breakMatch = normalized.match(/(\d{1,3})\s*(?:minuten|min|minute)\s+pause/);

  return {
    startTime: range ? normalizeTime(range[1], range[2]) : null,
    endTime: range ? normalizeTime(range[3], range[4]) : null,
    breakMinutes: breakMatch ? Number(breakMatch[1]) : null
  };
}

export function extractTargetName(text: string) {
  const match = text.match(/(?:baustelle|auftrag|kunde)\s+([A-Za-zÄÖÜäöüß0-9 .-]+)/i);
  if (!match) return null;

  return match[1]
    .replace(/\b(heute|morgen|uebermorgen|übermorgen|von|mit|fehlt|fehlen|bitte|fuer|für)\b.*$/i, "")
    .replace(/[,.]$/g, "")
    .trim();
}

function cleanMaterialName(value: string) {
  const words = value
    .replace(/[,.]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => !materialStopWords.includes(word.toLowerCase()));
  return words.join(" ").trim();
}

export function extractMaterials(text: string): ParsedMaterialEntity[] {
  const normalized = text.replace(/\b(?:eine|einen|ein)\b/gi, "1");
  const matches = [...normalized.matchAll(/(\d+(?:[,.]\d+)?)\s*([A-Za-zÄÖÜäöüß]+)?\s+([A-Za-zÄÖÜäöüß0-9\- ]{3,45})/g)];

  return matches
    .map((match) => {
      const quantity = Number(match[1].replace(",", "."));
      const unitCandidate = match[2] ?? "Stueck";
      const name = cleanMaterialName(match[3]);
      const unit = ["m", "meter", "rolle", "rollen", "stueck", "stk", "packung", "kg"].includes(unitCandidate.toLowerCase())
        ? unitCandidate
        : "Stueck";

      return {
        quantity: Number.isFinite(quantity) ? quantity : 1,
        unit: unit === "meter" ? "m" : unit === "rollen" ? "Rollen" : unit,
        name: unit === "Stueck" ? cleanMaterialName(`${unitCandidate} ${name}`) : name
      };
    })
    .filter((material) => material.name.length > 2)
    .slice(0, 12);
}

export function extractActivity(text: string) {
  const normalized = text.trim();
  const afterPause = normalized.split(/pause[,]?\s*/i).pop();
  if (afterPause && afterPause !== normalized) return afterPause.trim();
  const afterWorked = normalized.split(/gearbeitet[,]?\s*/i).pop();
  return afterWorked && afterWorked !== normalized ? afterWorked.trim() : normalized;
}

export function hasKeyword(text: string, keywords: string[]) {
  const normalized = normalizeText(text);
  return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
}
