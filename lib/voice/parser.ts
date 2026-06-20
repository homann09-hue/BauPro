import { extractDate, extractMaterials, extractTargetName, type ParsedMaterialEntity } from "@/lib/voice/entity-parser";

export type ParsedBringListItem = ParsedMaterialEntity & {
  itemType: "material" | "tool" | "document" | "safety" | "other";
};

export type ParsedBringListDraft = {
  date: string | null;
  targetName: string | null;
  items: ParsedBringListItem[];
  notes: string;
};

const toolWords = ["brenner", "hammer", "bohrer", "leiter", "säge", "saege", "akkuschrauber", "schere", "zange", "kanter"];
const safetyWords = ["helm", "handschuhe", "schutzbrille", "sicherung", "psa", "gurt"];
const ignoreWords = [
  "für",
  "fuer",
  "morgen",
  "heute",
  "baustelle",
  "auftrag",
  "kunde",
  "brauchen",
  "wir",
  "bitte",
  "mitnehmen",
  "einpacken",
  "und",
  "den",
  "die",
  "das",
  "der",
  "dem"
];

function normalizeName(value: string) {
  return value
    .replace(/\b(für|fuer|morgen|heute|bei|auf|zur|zum|bitte|brauchen|wir|mitnehmen|einpacken)\b/gi, " ")
    .replace(/[.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function itemTypeForName(name: string): ParsedBringListItem["itemType"] {
  const normalized = name.toLowerCase();
  if (toolWords.some((word) => normalized.includes(word))) return "tool";
  if (safetyWords.some((word) => normalized.includes(word))) return "safety";
  return "material";
}

function quantityFromText(value: string) {
  const match = value.match(/\b(\d+(?:[,.]\d+)?)\b/);
  return match ? Number(match[1].replace(",", ".")) : 1;
}

function unitFromText(value: string) {
  const normalized = value.toLowerCase();
  if (/\b(rollen|rolle)\b/.test(normalized)) return "Rollen";
  if (/\b(meter|lfm|m)\b/.test(normalized)) return "m";
  if (/\b(kg|kilo)\b/.test(normalized)) return "kg";
  if (/\b(packung|paket)\b/.test(normalized)) return "Packung";
  return "Stueck";
}

function stripQuantityAndUnit(value: string) {
  return value
    .replace(/\b\d+(?:[,.]\d+)?\b/g, " ")
    .replace(/\b(rollen|rolle|meter|lfm|kg|kilo|packung|paket|stueck|stück|stk)\b/gi, " ")
    .split(/\s+/)
    .filter((word) => word && !ignoreWords.includes(word.toLowerCase()))
    .join(" ")
    .trim();
}

function extractFallbackItems(text: string) {
  const relevant = text
    .replace(/^.*?(?:brauchen wir|brauche|mitnehmen|einpacken)\s+/i, "")
    .replace(/\bbei\s+baustelle\s+[A-Za-zÄÖÜäöüß0-9 .-]+?\s+(?:brauchen|mitnehmen|einpacken)\b/i, "");

  return relevant
    .split(/,|\bund\b/gi)
    .map(normalizeName)
    .map((part) => {
      const name = stripQuantityAndUnit(part);
      if (name.length < 3) return null;
      return {
        name,
        quantity: quantityFromText(part),
        unit: unitFromText(part),
        itemType: itemTypeForName(name)
      } satisfies ParsedBringListItem;
    })
    .filter((item): item is ParsedBringListItem => Boolean(item));
}

export function parseBringListDraft(text: string): ParsedBringListDraft {
  const materials = extractMaterials(text).map((item) => ({
    ...item,
    itemType: itemTypeForName(item.name)
  }));
  const fallbackItems = extractFallbackItems(text);
  const names = new Set(materials.map((item) => item.name.toLowerCase()));
  const merged = [
    ...materials,
    ...fallbackItems.filter((item) => !names.has(item.name.toLowerCase()))
  ].slice(0, 12);

  return {
    date: extractDate(text),
    targetName: extractTargetName(text),
    items: merged,
    notes: text.trim()
  };
}
