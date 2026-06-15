import { describe, expect, it } from "vitest";
import { MAX_REPORT_PHOTO_BYTES, sanitizeUploadFileName, validateReportPhoto } from "@/lib/security/uploads";

describe("report photo upload validation", () => {
  it("sanitizes filenames", () => {
    expect(sanitizeUploadFileName("../Dach Foto ä.png")).toBe("..-Dach-Foto-.png");
    expect(sanitizeUploadFileName("")).toBe("foto");
  });

  it("allows expected image types and rejects risky uploads", () => {
    expect(() => validateReportPhoto(new File(["ok"], "foto.jpg", { type: "image/jpeg" }))).not.toThrow();
    expect(() => validateReportPhoto(new File(["bad"], "script.svg", { type: "image/svg+xml" }))).toThrow("Nur JPG");
    expect(() =>
      validateReportPhoto(new File([new Uint8Array(MAX_REPORT_PHOTO_BYTES + 1)], "gross.jpg", { type: "image/jpeg" }))
    ).toThrow("maximal 10 MB");
  });
});
