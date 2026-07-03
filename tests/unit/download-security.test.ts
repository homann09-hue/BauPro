import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { downloadHeaders, inlineDownloadHeaders } from "@/lib/security/downloads";

const root = process.cwd();

describe("download security", () => {
  it("sets no-store headers for sensitive file downloads", () => {
    expect(downloadHeaders("application/pdf", "stundenzettel.pdf")).toEqual({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="stundenzettel.pdf"; filename*=UTF-8\'\'stundenzettel.pdf',
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff"
    });
  });

  it("keeps UTF-8 filenames with an ASCII fallback", () => {
    const headers = downloadHeaders("text/csv", "stundenzettel_Müller_Größe.csv");
    expect(headers["Content-Type"]).toBe("text/csv; charset=utf-8");
    expect(headers["Content-Disposition"]).toContain('filename="stundenzettel_Muller_Grosse.csv"');
    expect(headers["Content-Disposition"]).toContain("filename*=UTF-8''stundenzettel_M%C3%BCller_Gr%C3%B6%C3%9Fe.csv");
  });

  it("sanitizes inline content-disposition filenames as strictly as attachments", () => {
    const headers = inlineDownloadHeaders("application/pdf", 'angebot"\r\nX-Bad: 1.pdf');
    expect(headers["Content-Disposition"]).toContain("inline;");
    expect(headers["Content-Disposition"]).toContain('filename="angebot_X-Bad_1.pdf"');
    expect(headers["Content-Disposition"]).not.toContain("\r");
    expect(headers["Content-Disposition"]).not.toContain("\n");
    expect(headers["Content-Disposition"]).not.toContain('filename="angebot"');
  });

  it("uses shared download headers for privacy, time and portal exports", () => {
    for (const file of [
      "lib/privacy/export.ts",
      "app/(app)/time-tracking/daily/export/route.ts",
      "app/(app)/time-tracking/reports/[id]/csv/route.ts",
      "app/(app)/time-tracking/reports/[id]/pdf/route.ts",
      "app/(app)/angebote-rechnungen/[id]/pdf/route.ts",
      "app/(app)/angebote-rechnungen/[id]/datev/route.ts",
      "app/(app)/angebote-rechnungen/[id]/xrechnung/route.ts",
      "app/(app)/baustellen/[id]/documents/[documentId]/route.ts",
      "app/(app)/fahrzeuge/documents/[documentId]/route.ts",
      "app/portal/[token]/work-orders/[id]/pdf/route.ts"
    ]) {
      const source = fs.readFileSync(path.join(root, file), "utf8");
      expect(source, file).toContain("downloadHeaders(");
    }
  });

  it("uses the shared safe inline headers for app document preview routes", () => {
    for (const file of [
      "app/(app)/baustellen/[id]/documents/[documentId]/route.ts",
      "app/(app)/fahrzeuge/documents/[documentId]/route.ts"
    ]) {
      const source = fs.readFileSync(path.join(root, file), "utf8");
      expect(source, file).toContain("inlineDownloadHeaders(");
      expect(source, file).not.toContain("inline; filename=");
    }
  });
});
