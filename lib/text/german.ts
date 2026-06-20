const umlautToAsciiPairs: Array<[RegExp, string]> = [
  [/Ä/g, "Ae"],
  [/Ö/g, "Oe"],
  [/Ü/g, "Ue"],
  [/ä/g, "ae"],
  [/ö/g, "oe"],
  [/ü/g, "ue"],
  [/ß/g, "ss"]
];

function collapseSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function toGermanAscii(value: string) {
  return umlautToAsciiPairs.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), value);
}

export function toGermanUmlautVariant(value: string) {
  return value
    .replace(/Ae/g, "Ä")
    .replace(/Oe/g, "Ö")
    .replace(/Ue/g, "Ü")
    .replace(/ae/g, "ä")
    .replace(/oe/g, "ö")
    .replace(/ue/g, "ü")
    .replace(/ss/g, "ß");
}

export function stripCombiningMarks(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeGermanSearchText(value: string | null | undefined) {
  return collapseSpaces(stripCombiningMarks(toGermanAscii(String(value ?? "").normalize("NFC"))).toLowerCase());
}

export function includesGermanSearch(haystack: string | null | undefined, needle: string | null | undefined) {
  const normalizedNeedle = normalizeGermanSearchText(needle);
  if (!normalizedNeedle) return true;
  return normalizeGermanSearchText(haystack).includes(normalizedNeedle);
}

export function safeUtf8FilenamePart(value: string | null | undefined, fallback = "datei") {
  const cleaned = String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return cleaned || fallback;
}

export function germanSearchVariants(value: string) {
  const raw = collapseSpaces(String(value ?? "").normalize("NFC")).slice(0, 80);
  if (!raw) return [];

  return Array.from(
    new Set([
      raw,
      toGermanAscii(raw),
      stripCombiningMarks(raw),
      toGermanUmlautVariant(raw),
      toGermanUmlautVariant(toGermanAscii(raw))
    ].map(collapseSpaces).filter(Boolean))
  );
}

export function postgrestSearchPattern(value: string) {
  const sanitized = value.replace(/[%_,()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return `%${sanitized}%`;
}

export function postgrestIlikeAnyFilter(fields: string[], value: string) {
  const patterns = germanSearchVariants(value).map(postgrestSearchPattern);
  return fields.flatMap((field) => patterns.map((pattern) => `${field}.ilike.${pattern}`)).join(",");
}
