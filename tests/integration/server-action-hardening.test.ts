import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("server action hardening", () => {
  it("decrypts supplier API keys only at provider-call time", () => {
    const supplierActions = source("lib/actions/supplier-actions.ts");
    expect(supplierActions).toContain("function decryptApiKey");
    expect(supplierActions).toContain("apiKey: decryptApiKey(typed.api_key_encrypted)");
    expect(supplierActions).not.toContain("apiKey: typed.api_key_encrypted");
  });

  it("does not trust report photo storage paths from FormData", () => {
    const reportActions = source("lib/actions/report-actions.ts");
    const deletePhotoAction = reportActions.slice(reportActions.indexOf("export async function deleteReportPhotoAction"));
    expect(deletePhotoAction).not.toContain('requiredString(formData, "storage_path")');
    expect(deletePhotoAction).toContain('.select("storage_path, created_by")');
  });
});
