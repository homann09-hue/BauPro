import { describe, expect, it } from "vitest";
import {
  MAX_CUSTOMER_DOCUMENT_BYTES,
  MAX_REPORT_PHOTO_BYTES,
  sanitizeUploadFileName,
  validateCustomerDocument,
  validateReportPhoto
} from "@/lib/security/uploads";

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

  it("validates customer documents by type, size and magic bytes", async () => {
    await expect(
      validateCustomerDocument(new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "auftrag.pdf", { type: "application/pdf" }))
    ).resolves.toBeUndefined();
    await expect(
      validateCustomerDocument(new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "foto.png", { type: "image/png" }))
    ).resolves.toBeUndefined();
    await expect(validateCustomerDocument(new File(["bad"], "tabelle.xlsx", { type: "application/vnd.ms-excel" }))).rejects.toThrow(
      "Kundendokument"
    );
    await expect(
      validateCustomerDocument(new File([new Uint8Array(MAX_CUSTOMER_DOCUMENT_BYTES + 1)], "gross.pdf", { type: "application/pdf" }))
    ).rejects.toThrow("maximal 15 MB");
    await expect(validateCustomerDocument(new File(["bad"], "fake.pdf", { type: "application/pdf" }))).rejects.toThrow("Dokumentformat");
  });
});
