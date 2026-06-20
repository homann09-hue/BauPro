import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanPdfText, pdfEscape } from "@/lib/pdf/simple-pdf";
import { parseSupplierCsv } from "@/lib/suppliers/csv-adapter";
import { includesGermanSearch, postgrestIlikeAnyFilter, safeUtf8FilenamePart } from "@/lib/text/german";

const root = process.cwd();
const textFileRoots = ["app", "components", "lib", "supabase", "tests"];
const textExtensions = new Set([".css", ".js", ".json", ".md", ".mjs", ".sql", ".ts", ".tsx", ".txt"]);
const mojibakePattern = /\u00c3|\u00c2|\u00e2\u20ac|\ufffd/;
const legacyUiTextPattern =
  /\b(fuer|Fuer|ueber|Ueber|oeffnen|Oeffnen|Pruef|pruef|gueltig|Gueltig|ungueltig|Ungueltig|Taetigkeit|Eintraege|Stueck|Rueckgabe)\b/;

function collectTextFiles(target: string): string[] {
  const absolute = path.join(root, target);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];

  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    if ([".next", "node_modules", ".git", "coverage"].includes(entry.name)) return [];
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) return collectTextFiles(path.relative(root, child));
    return textExtensions.has(path.extname(entry.name)) ? [child] : [];
  });
}

describe("UTF-8 and German special characters", () => {
  it("keeps repository text files valid UTF-8 without mojibake", () => {
    const files = textFileRoots.flatMap(collectTextFiles);
    expect(files.length).toBeGreaterThan(50);

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      expect(content, path.relative(root, file)).not.toContain("\uFFFD");
      expect(content, path.relative(root, file)).not.toMatch(mojibakePattern);
    }
  });

  it("uses real umlauts in visible app and component texts", () => {
    const files = ["app", "components"].flatMap(collectTextFiles);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      expect(content, path.relative(root, file)).not.toMatch(legacyUiTextPattern);
    }
  });

  it("roundtrips German data through JSON/API-style UTF-8 serialization", () => {
    const payload = {
      customer: "Müller",
      street: "Dachdeckerstraße",
      material: "Fußpfette",
      note: "Überstunden, Größe und Maßangaben"
    };
    const encoded = Buffer.from(JSON.stringify(payload), "utf8");
    expect(JSON.parse(encoded.toString("utf8"))).toEqual(payload);
  });

  it("preserves umlauts for PDF text and emits PDF-safe WinAnsi escapes", () => {
    const text = "Müller, Schröder, König, Dachdeckerstraße, Fußpfette, Überstunden, Größe, Maßangaben";
    expect(cleanPdfText(text)).toBe(text);
    const escaped = pdfEscape(text);
    expect(escaped).toContain("M\\374ller");
    expect(escaped).toContain("Schr\\366der");
    expect(escaped).toContain("Dachdeckerstra\\337e");
    expect(escaped).toContain("Fu\\337pfette");
    expect(escaped).toContain("\\334berstunden");
    expect(escaped).toContain("Ma\\337angaben");
  });

  it("finds German words with umlaut and ascii spellings", () => {
    const haystack = "Müller Schröder König Dachdeckerstraße Fußpfette Überstunden Größe Maßangaben";
    expect(includesGermanSearch(haystack, "Mueller")).toBe(true);
    expect(includesGermanSearch(haystack, "Schroeder")).toBe(true);
    expect(includesGermanSearch(haystack, "Dachdeckerstrasse")).toBe(true);
    expect(includesGermanSearch(haystack, "Fusspfette")).toBe(true);
    expect(includesGermanSearch(haystack, "Massangaben")).toBe(true);
    expect(postgrestIlikeAnyFilter(["name"], "Mueller")).toContain("Müller");
    expect(postgrestIlikeAnyFilter(["address"], "Dachdeckerstrasse")).toContain("Dachdeckerstraße");
  });

  it("keeps UTF-8 export filename parts while remaining filesystem-safe", () => {
    expect(safeUtf8FilenamePart("Müller / Dachdeckerstraße Größe")).toBe("Müller_Dachdeckerstraße_Größe");
  });

  it("keeps umlauts in UTF-8 CSV imports", () => {
    const rows = parseSupplierCsv("\uFEFFLieferant;Produktname;Einheit;Preis Brutto\nWürth;Fußpfette König;Stück;12,99");
    expect(rows).toEqual([
      {
        supplier_name: "Würth",
        product_name: "Fußpfette König",
        unit: "Stück",
        price_gross: "12,99"
      }
    ]);
  });
});
