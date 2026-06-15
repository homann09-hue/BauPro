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

export function validateReportPhoto(file: File) {
  if (!ALLOWED_REPORT_PHOTO_TYPES.has(file.type)) {
    throw new Error("Nur JPG, PNG, WebP oder HEIC Fotos sind erlaubt.");
  }

  if (file.size > MAX_REPORT_PHOTO_BYTES) {
    throw new Error("Ein Foto darf maximal 10 MB gross sein.");
  }
}
