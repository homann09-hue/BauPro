import { SafeActionError } from "@/lib/security/errors";
import type { Role } from "@/types/app";

export const SIGNATURE_DATA_URL_MAX_CHARS = 350_000;

export type DigitalDocumentType = "work_order" | "report" | "commercial_document" | "jobsite_document" | "acceptance";
export type DigitalSignatureStatus = "draft" | "signed" | "rejected";
export type DigitalSignerRole = Extract<Role, "kunde" | "mitarbeiter" | "vorarbeiter" | "chef" | "admin">;

function boundedSignature(value: string | null, required: boolean) {
  const dataUrl = value?.trim() || null;
  if (!dataUrl) {
    if (required) throw new SafeActionError("Bitte im Unterschriftenfeld unterschreiben.");
    return null;
  }
  if (dataUrl.length > SIGNATURE_DATA_URL_MAX_CHARS) throw new SafeActionError("Unterschrift ist zu gross.");
  return dataUrl;
}

export function validateSignatureDataUrl(value: string | null, options: { required?: boolean } = {}) {
  const dataUrl = boundedSignature(value, options.required ?? true);
  if (!dataUrl) return null;

  const match = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) throw new SafeActionError("Unterschrift muss als PNG, JPG oder WebP gespeichert werden.");

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 250 * 1024) throw new SafeActionError("Unterschrift ist zu gross.");

  const type = match[1];
  const validSignature =
    (type === "png" && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) ||
    (type === "jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (type === "webp" &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50);

  if (!validSignature) throw new SafeActionError("Unterschrift passt nicht zum angegebenen Bildformat.");
  return dataUrl;
}

export function signerRole(role: Role): DigitalSignerRole {
  if (role === "admin" || role === "chef" || role === "vorarbeiter" || role === "mitarbeiter" || role === "kunde") {
    return role;
  }
  return "mitarbeiter";
}
