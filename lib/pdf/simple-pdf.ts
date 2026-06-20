export type PdfImage = {
  name: string;
  data: Buffer;
  width: number;
  height: number;
};

export function cleanPdfText(value: string | number | null | undefined) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function pdfEscape(value: string | number | null | undefined) {
  return Array.from(toPdfWinAnsiBytes(cleanPdfText(value)))
    .map((byte) => {
      if (byte === 0x28 || byte === 0x29 || byte === 0x5c) return `\\${String.fromCharCode(byte)}`;
      if (byte < 0x20 || byte > 0x7e) return `\\${byte.toString(8).padStart(3, "0")}`;
      return String.fromCharCode(byte);
    })
    .join("");
}

const windows1252Extended: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f
};

export function toPdfWinAnsiBytes(value: string) {
  const bytes: number[] = [];
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0x20;
    if ((codePoint >= 0x20 && codePoint <= 0x7e) || (codePoint >= 0xa0 && codePoint <= 0xff)) {
      bytes.push(codePoint);
    } else {
      bytes.push(windows1252Extended[codePoint] ?? 0x20);
    }
  }
  return Uint8Array.from(bytes);
}

export function text(x: number, y: number, size: number, value: string | number | null | undefined, font = "F1") {
  return `BT /${font} ${size} Tf ${x} ${y} Td (${pdfEscape(value)}) Tj ET\n`;
}

export function line(x1: number, y1: number, x2: number, y2: number) {
  return `${x1} ${y1} m ${x2} ${y2} l S\n`;
}

export function wrapText(value: string | null | undefined, maxChars = 92) {
  const words = cleanPdfText(value).split(" ").filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length > maxChars) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export function truncatePdfText(value: string | null | undefined, length: number) {
  const cleaned = cleanPdfText(value ?? "");
  return cleaned.length > length ? `${cleaned.slice(0, length - 1)}.` : cleaned;
}

export function drawImage(name: string, x: number, y: number, width: number, height: number) {
  return `q ${width} 0 0 ${height} ${x} ${y} cm /${name} Do Q\n`;
}

function jpegDimensions(data: Buffer) {
  if (data[0] !== 0xff || data[1] !== 0xd8) return null;
  let offset = 2;

  while (offset < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = data[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > data.length) return null;

    const segmentLength = data.readUInt16BE(offset);
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame && offset + 7 < data.length) {
      return {
        height: data.readUInt16BE(offset + 3),
        width: data.readUInt16BE(offset + 5)
      };
    }

    offset += segmentLength;
  }

  return null;
}

export function imageFromDataUrl(dataUrl: string | null | undefined, name = "Sig1"): PdfImage | null {
  const match = dataUrl?.match(/^data:image\/jpeg;base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) return null;

  const data = Buffer.from(match[1], "base64");
  const size = jpegDimensions(data);
  if (!size) return null;

  return {
    name: name.replace(/[^A-Za-z0-9_-]/g, "") || "Sig1",
    data,
    width: size.width,
    height: size.height
  };
}

function objectStream(data: Buffer | string) {
  const body = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return body;
}

export function buildPdfDocument(content: string, images: PdfImage[] = []) {
  const imageResource = images.length
    ? `/XObject << ${images.map((image, index) => `/${image.name} ${index + 6} 0 R`).join(" ")} >>`
    : "";
  const objects: Buffer[] = [
    objectStream("<< /Type /Catalog /Pages 2 0 R >>"),
    objectStream("<< /Type /Pages /Kids [4 0 R] /Count 1 >>"),
    objectStream("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
    objectStream(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> ${imageResource} >> /Contents 5 0 R >>`
    ),
    Buffer.concat([
      Buffer.from(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n`, "utf8"),
      Buffer.from(content, "utf8"),
      Buffer.from("\nendstream", "utf8")
    ]),
    ...images.map((image) =>
      Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.data.length} >>\nstream\n`,
          "utf8"
        ),
        image.data,
        Buffer.from("\nendstream", "utf8")
      ])
    )
  ];

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "utf8")];
  const offsets: number[] = [0];
  let byteLength = chunks[0].length;

  objects.forEach((object, index) => {
    offsets.push(byteLength);
    const header = Buffer.from(`${index + 1} 0 obj\n`, "utf8");
    const footer = Buffer.from("\nendobj\n", "utf8");
    chunks.push(header, object, footer);
    byteLength += header.length + object.length + footer.length;
  });

  const xrefOffset = byteLength;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(Buffer.from(xref, "utf8"));

  return Buffer.concat(chunks);
}
