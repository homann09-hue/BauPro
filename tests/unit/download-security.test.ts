import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { downloadHeaders } from "@/lib/security/downloads";

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
      "app/portal/[token]/work-orders/[id]/pdf/route.ts"
    ]) {
      const source = fs.readFileSync(path.join(root, file), "utf8");
      expect(source, file).toContain("downloadHeaders(");
    }
  });
});
