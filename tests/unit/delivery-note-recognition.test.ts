import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("delivery note recognition", () => {
  it("extracts delivery note fields with server-side AI only", () => {
    const recognition = read("lib/delivery-notes/recognition.ts");

    expect(recognition).toContain("createStructuredAiResponse");
    expect(recognition).toContain("delivery_note_recognition");
    expect(recognition).toContain("imageUrls: [imageUrl]");
    expect(recognition).toContain("supplier_name");
    expect(recognition).toContain("document_date");
    expect(recognition).toContain("article_name");
    expect(recognition).toContain("article_number");
    expect(recognition).toContain("unit_price");
    expect(recognition).toContain("total_price");
    expect(recognition).toContain("Erfinde keine Artikel");
  });

  it("keeps delivery note UI confirmation-first and hides prices from operators", () => {
    const listPage = read("app/(app)/materials/delivery-notes/page.tsx");
    const detailPage = read("app/(app)/materials/delivery-notes/[id]/page.tsx");

    expect(listPage).toContain("PhotoCaptureButton");
    expect(listPage).toContain("Es wird nichts gebucht, bis du die Positionen bestätigst.");
    expect(listPage).toContain("Datenschutz: Das Foto wird im privaten Firmen-Speicher abgelegt");
    expect(detailPage).toContain("Keine automatische Buchung");
    expect(detailPage).toContain("context.canManage ? (");
    expect(detailPage).toContain('name="unit_price"');
    expect(detailPage).toContain('name="total_price"');
    expect(detailPage).toContain("Preise sind für Vorarbeiter ausgeblendet");
    expect(detailPage).toContain("Bestätigen und Lager buchen");
  });
});
