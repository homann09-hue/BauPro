function safeAsciiFilename(filename: string) {
  return (
    filename
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ß/g, "ss")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "") || "download"
  );
}

function encodedUtf8Filename(filename: string) {
  return encodeURIComponent(filename.normalize("NFC")).replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function contentDisposition(disposition: "attachment" | "inline", filename: string) {
  return `${disposition}; filename="${safeAsciiFilename(filename)}"; filename*=UTF-8''${encodedUtf8Filename(filename)}`;
}

function normalizedContentType(contentType: string) {
  return /;\s*charset=/i.test(contentType) || !/^(application\/json|application\/xml|text\/)/i.test(contentType)
    ? contentType
    : `${contentType}; charset=utf-8`;
}

export function downloadHeaders(contentType: string, filename: string) {
  return {
    "Content-Type": normalizedContentType(contentType),
    "Content-Disposition": contentDisposition("attachment", filename),
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff"
  };
}

export function inlineDownloadHeaders(contentType: string, filename: string) {
  return {
    ...downloadHeaders(contentType, filename),
    "Content-Disposition": contentDisposition("inline", filename)
  };
}
