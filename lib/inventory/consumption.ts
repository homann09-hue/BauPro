export type ConsumptionDraft = {
  materialName: string;
  quantity: number;
  unit: string;
  rawText: string;
};

const quantityPattern = /(\d+(?:[,.]\d+)?)\s*(rollen|rolle|stk|stück|stueck|m²|m2|qm|meter|m|kg|sack|säcke|saecke)?\s+([a-zäöüß\-/ ]{3,45})/gi;

function normalizeUnit(unit?: string) {
  const value = (unit ?? "Stueck").toLowerCase();
  if (value === "stk" || value === "stück") return "Stueck";
  if (value === "m2" || value === "qm") return "m2";
  if (value === "rolle") return "Rollen";
  if (value === "säcke" || value === "saecke") return "Sack";
  return unit ?? "Stueck";
}

export function parseMaterialConsumptionText(text: string): ConsumptionDraft[] {
  const drafts: ConsumptionDraft[] = [];
  for (const match of text.matchAll(quantityPattern)) {
    const quantity = Number(match[1].replace(",", "."));
    const materialName = match[3].trim().replace(/\s+/g, " ");
    if (!Number.isFinite(quantity) || materialName.length < 3) continue;

    drafts.push({
      materialName,
      quantity,
      unit: normalizeUnit(match[2]),
      rawText: match[0]
    });
  }

  return drafts.slice(0, 12);
}
