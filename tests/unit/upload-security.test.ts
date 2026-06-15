import { describe, expect, it } from "vitest";
import { MAX_REPORT_PHOTO_BYTES, sanitizeUploadFileName, validateReportPhoto } from "@/lib/security/uploads";

describe("report photo upload validation", () => {
  it("sanitizes filenames", () => {
    expect(sanitizeUploadFileName("../Dach Foto ä.png")).toBe("..-Dach-Foto-.png");
    expect(sanitizeUploadFileName("")).toBe("foto");
  });

  it("allows expected image types and rejects risky uploads", async () => {
    await expect(validateReportPhoto(new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], "foto.jpg", { type: "image/jpeg" }))).resolves.toBeUndefined();
    await expect(validateReportPhoto(new File(["bad"], "script.svg", { type: "image/svg+xml" }))).rejects.toThrow("Nur JPG");
    await expect(
      validateReportPhoto(new File([new Uint8Array(MAX_REPORT_PHOTO_BYTES + 1)], "gross.jpg", { type: "image/jpeg" }))
    ).rejects.toThrow("maximal 10 MB");
    await expect(validateReportPhoto(new File(["bad"], "fake.jpg", { type: "image/jpeg" }))).rejects.toThrow("Bildformat");
  });
});
