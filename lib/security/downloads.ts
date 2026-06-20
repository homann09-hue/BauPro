export function downloadHeaders(contentType: string, filename: string) {
  const safeFilename = filename
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const fallbackFilename = safeFilename || "download";
  const encodedFilename = encodeURIComponent(filename.normalize("NFC")).replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  const normalizedContentType =
    /;\s*charset=/i.test(contentType) || !/^(application\/json|application\/xml|text\/)/i.test(contentType)
      ? contentType
      : `${contentType}; charset=utf-8`;

  return {
    "Content-Type": normalizedContentType,
    "Content-Disposition": `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`,
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff"
  };
}
