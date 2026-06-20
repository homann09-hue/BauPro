import { buildPdfDocument, line, text, truncatePdfText } from "@/lib/pdf/simple-pdf";
import type { BringList, BringListItem } from "@/types/app";

export function bringListFilename(list: Pick<BringList, "title" | "date">) {
  const safeTitle = list.title
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return `mitbringliste_${safeTitle || "baustelle"}_${list.date}.pdf`;
}

export function buildBringListPdf({
  companyName,
  list,
  items
}: {
  companyName: string;
  list: BringList;
  items: BringListItem[];
}) {
  let y = 800;
  let content = text(42, y, 18, "BauPro Mitbringliste", "F1");
  y -= 24;
  content += text(42, y, 10, companyName);
  y -= 18;
  content += text(42, y, 10, `${list.title} - ${list.date}`);
  y -= 16;
  content += text(42, y, 9, `${list.jobsites?.name ?? "Baustelle"} - ${list.jobsites?.address ?? "Keine Adresse"}`);
  y -= 22;
  content += line(42, y, 553, y);
  y -= 22;

  content += text(42, y, 10, "Check");
  content += text(86, y, 10, "Position");
  content += text(365, y, 10, "Menge");
  content += text(450, y, 10, "Hinweis");
  y -= 12;
  content += line(42, y, 553, y);
  y -= 18;

  for (const item of items.slice(0, 30)) {
    const checked = item.packed ? "x" : " ";
    const hint = item.missing_reported ? "Fehlt gemeldet" : (item.notes ?? item.storage_location ?? "");
    content += text(50, y, 10, `[${checked}]`);
    content += text(86, y, 10, truncatePdfText(item.custom_item_name, 42));
    content += text(365, y, 10, `${item.quantity} ${item.unit}`);
    content += text(450, y, 9, truncatePdfText(hint, 30));
    y -= 18;
    if (y < 70) break;
  }

  y = 52;
  content += line(42, y + 16, 553, y + 16);
  content += text(42, y, 8, "Automatisch erzeugte Mitbringliste aus BauPro. Preise und interne Kalkulationen sind nicht enthalten.");

  return buildPdfDocument(content);
}
