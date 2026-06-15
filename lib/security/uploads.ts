import { SafeActionError } from "@/lib/security/errors";

export const MAX_REPORT_PHOTO_BYTES = 10 * 1024 * 1024;

export const ALLOWED_REPORT_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
]);

export function sanitizeUploadFileName(name: string) {
  const fallback = "foto";
  const safe = name
    .trim()
    .replace(/[/\\]/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
  return safe || fallback;
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

async function hasAllowedImageSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const type = file.type.toLowerCase();

  if (type === "image/jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (type === "image/png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (type === "image/webp") {
    return (
      startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }
  if (type === "image/heic" || type === "image/heif") {
    const brand = String.fromCharCode(...bytes.slice(4, 12)).toLowerCase();
    return brand.includes("ftyp") && /(heic|heif|heix|hevc|mif1|msf1)/.test(brand);
  }

  return false;
}

export async function validateReportPhoto(file: File) {
  if (!ALLOWED_REPORT_PHOTO_TYPES.has(file.type)) {
    throw new SafeActionError("Nur JPG, PNG, WebP oder HEIC Fotos sind erlaubt.");
  }

  if (file.size > MAX_REPORT_PHOTO_BYTES) {
    throw new SafeActionError("Ein Foto darf maximal 10 MB gross sein.");
  }

  if (!(await hasAllowedImageSignature(file))) {
    throw new SafeActionError("Die Datei passt nicht zum angegebenen Bildformat.");
  }
}
