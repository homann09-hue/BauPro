import { includesGermanSearch, normalizeGermanSearchText } from "@/lib/text/german";

export type RoofingTileType =
  | "tonziegel_doppelmulde"
  | "tonziegel_flach"
  | "betondachstein"
  | "biberschwanz"
  | "schiefer";

export type RoofingMaterialEstimateInput = {
  areaM2: number;
  roofPitch: number;
  tileType: RoofingTileType;
  eavesLengthM: number;
  ridgeLengthM: number;
  vergeLengthM: number;
  valleyLengthM: number;
  hipLengthM: number;
  wastePercent: number;
};

export type RoofingMaterialPriceRow = {
  id: string;
  name: string;
  unit: string;
  stock: number | null;
  purchase_price: number | null;
  sales_price: number | null;
  inventory_locations?: { name: string | null } | null;
};

export type RoofingMaterialEstimateItem = {
  key: string;
  materialName: string;
  unit: string;
  baseQuantity: number;
  wastePercent: number;
  wasteQuantity: number;
  totalQuantity: number;
  inventoryItemId: string | null;
  inventoryItemName: string | null;
  locationName: string | null;
  stock: number | null;
  purchasePrice: number | null;
  salesPrice: number | null;
  purchaseTotal: number | null;
  salesTotal: number | null;
  warning: string | null;
  priceSource: string;
};

export type RoofingMaterialEstimate = {
  items: RoofingMaterialEstimateItem[];
  purchaseTotal: number;
  salesTotal: number;
  warnings: string[];
};

type RoofingMaterialDraft = {
  key: string;
  materialName: string;
  unit: string;
  baseQuantity: number;
  keywords: string[];
  wholeUnits?: boolean;
};

export const roofingTileTypes: Array<{
  value: RoofingTileType;
  label: string;
  piecesPerM2: number;
  keywords: string[];
}> = [
  {
    value: "tonziegel_doppelmulde",
    label: "Tonziegel Doppelmulde",
    piecesPerM2: 10.5,
    keywords: ["tonziegel", "doppelmulde", "dachziegel", "ziegel"]
  },
  {
    value: "tonziegel_flach",
    label: "Flachdachziegel",
    piecesPerM2: 11.5,
    keywords: ["flachdachziegel", "tonziegel", "dachziegel", "ziegel"]
  },
  {
    value: "betondachstein",
    label: "Betondachstein",
    piecesPerM2: 10,
    keywords: ["betondachstein", "dachstein", "pfanne"]
  },
  {
    value: "biberschwanz",
    label: "Biberschwanzziegel",
    piecesPerM2: 36,
    keywords: ["biberschwanz", "ziegel", "dachziegel"]
  },
  {
    value: "schiefer",
    label: "Schieferdeckung",
    piecesPerM2: 33,
    keywords: ["schiefer", "schieferplatte", "deckung"]
  }
];

export function roofingTileTypeValue(value: FormDataEntryValue | string | null | undefined): RoofingTileType {
  const raw = String(value ?? "tonziegel_doppelmulde");
  return roofingTileTypes.some((type) => type.value === raw) ? (raw as RoofingTileType) : "tonziegel_doppelmulde";
}

function safeNumber(value: number | null | undefined) {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : 0;
}

function roundQuantity(value: number, wholeUnits = false) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return wholeUnits ? Math.ceil(value) : Math.round(value * 100) / 100;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizedUnit(value: string) {
  const normalized = normalizeGermanSearchText(value);
  if (normalized === "stueck" || normalized === "stk" || normalized === "st") return "stueck";
  if (normalized === "m2" || normalized === "qm" || normalized === "m²") return "m2";
  if (normalized === "meter" || normalized === "lfm") return "m";
  return normalized;
}

function unitMatches(materialUnit: string, inventoryUnit: string) {
  const material = normalizedUnit(materialUnit);
  const inventory = normalizedUnit(inventoryUnit);
  if (material === inventory) return true;
  if (material === "stueck" && inventory === "stueck") return true;
  return material === "m2" && inventory === "m2";
}

function bestInventoryMatch(draft: RoofingMaterialDraft, inventoryItems: RoofingMaterialPriceRow[]) {
  const scored = inventoryItems
    .map((item) => {
      const name = item.name;
      const keywordScore = draft.keywords.reduce((score, keyword) => score + (includesGermanSearch(name, keyword) ? 10 : 0), 0);
      const exactNameBonus = includesGermanSearch(name, draft.materialName) ? 40 : 0;
      const unitBonus = unitMatches(draft.unit, item.unit) ? 12 : 0;
      const priceBonus = item.purchase_price !== null ? 3 : 0;
      const stockBonus = safeNumber(item.stock) > 0 ? 2 : 0;
      return { item, score: keywordScore + exactNameBonus + unitBonus + priceBonus + stockBonus };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || safeNumber(b.item.stock) - safeNumber(a.item.stock));

  return scored[0]?.item ?? null;
}

function tileTypeConfig(tileType: RoofingTileType) {
  return roofingTileTypes.find((type) => type.value === tileType) ?? roofingTileTypes[0];
}

function withWaste(baseQuantity: number, wastePercent: number, wholeUnits = false) {
  const base = roundQuantity(baseQuantity, wholeUnits);
  const wasteQuantity = roundQuantity(base * (wastePercent / 100), wholeUnits);
  return {
    baseQuantity: base,
    wasteQuantity,
    totalQuantity: roundQuantity(base + wasteQuantity, wholeUnits)
  };
}

export function buildRoofingMaterialDrafts(input: RoofingMaterialEstimateInput): RoofingMaterialDraft[] {
  const area = safeNumber(input.areaM2);
  const tileConfig = tileTypeConfig(input.tileType);
  const ridgeAndHipLength = safeNumber(input.ridgeLengthM) + safeNumber(input.hipLengthM);
  const vergeLength = safeNumber(input.vergeLengthM);
  const edgeLength =
    safeNumber(input.eavesLengthM) +
    safeNumber(input.valleyLengthM) +
    safeNumber(input.hipLengthM) +
    safeNumber(input.ridgeLengthM) +
    vergeLength;

  const drafts: RoofingMaterialDraft[] = [
    {
      key: "roof_tiles",
      materialName: tileConfig.label,
      unit: "Stueck",
      baseQuantity: area * tileConfig.piecesPerM2,
      keywords: tileConfig.keywords,
      wholeUnits: true
    },
    {
      key: "roof_battens",
      materialName: "Dachlatte 30 x 50 mm",
      unit: "m",
      baseQuantity: area / 0.32,
      keywords: ["dachlatte", "dachlatten", "lattung", "traglatte", "latte"]
    },
    {
      key: "counter_battens",
      materialName: "Konterlatte 30 x 50 mm",
      unit: "m",
      baseQuantity: area / 0.7,
      keywords: ["konterlatte", "konterlatten", "konterlattung"]
    },
    {
      key: "underlay",
      materialName: "Unterspannbahn diffusionsoffen",
      unit: "m2",
      baseQuantity: area,
      keywords: ["unterspannbahn", "unterdeckbahn", "usb", "diffusionsoffen"]
    },
    {
      key: "fasteners",
      materialName: "Schrauben/Naegel",
      unit: "Stueck",
      baseQuantity: area * 8,
      keywords: ["schrauben", "naegel", "nägel", "sturmklammer", "befestigung", "klammer"],
      wholeUnits: true
    },
    {
      key: "ridge_tiles",
      materialName: "Firstziegel passend",
      unit: "Stueck",
      baseQuantity: ridgeAndHipLength / 0.42,
      keywords: ["firstziegel", "first", "gratziegel", "grat"],
      wholeUnits: true
    },
    {
      key: "verge_tiles",
      materialName: "Ortgangziegel passend",
      unit: "Stueck",
      baseQuantity: vergeLength * 3,
      keywords: ["ortgangziegel", "ortgang", "formziegel"],
      wholeUnits: true
    },
    {
      key: "small_parts",
      materialName: "Kleinteile und Zubehoer",
      unit: "Pauschale",
      baseQuantity: area > 0 || edgeLength > 0 ? Math.max(1, edgeLength / 50) : 0,
      keywords: ["kleinteile", "zubehoer", "zubehör", "dichtstoff", "klebeband"]
    }
  ];

  return drafts.filter((draft) => draft.baseQuantity > 0).map((draft) => ({ ...draft }));
}

export function calculateRoofingMaterialEstimate(
  input: RoofingMaterialEstimateInput,
  inventoryItems: RoofingMaterialPriceRow[]
): RoofingMaterialEstimate {
  const wastePercent = Math.max(0, safeNumber(input.wastePercent));
  const items = buildRoofingMaterialDrafts(input).map((draft) => {
    const quantities = withWaste(draft.baseQuantity, wastePercent, draft.wholeUnits);
    const inventoryItem = bestInventoryMatch(draft, inventoryItems);
    const purchasePrice = inventoryItem?.purchase_price ?? null;
    const salesPrice = inventoryItem?.sales_price ?? null;
    const purchaseTotal = purchasePrice === null ? null : roundMoney(purchasePrice * quantities.totalQuantity);
    const salesTotal = salesPrice === null ? null : roundMoney(salesPrice * quantities.totalQuantity);
    const warning = !inventoryItem
      ? `Kein Lagerartikel fuer ${draft.materialName} gefunden.`
      : purchasePrice === null
        ? `EK-Preis fehlt fuer ${inventoryItem.name}.`
        : null;

    return {
      key: draft.key,
      materialName: inventoryItem?.name ?? draft.materialName,
      unit: draft.unit,
      baseQuantity: quantities.baseQuantity,
      wastePercent,
      wasteQuantity: quantities.wasteQuantity,
      totalQuantity: quantities.totalQuantity,
      inventoryItemId: inventoryItem?.id ?? null,
      inventoryItemName: inventoryItem?.name ?? null,
      locationName: inventoryItem?.inventory_locations?.name ?? null,
      stock: inventoryItem?.stock ?? null,
      purchasePrice,
      salesPrice,
      purchaseTotal,
      salesTotal,
      warning,
      priceSource: purchasePrice === null ? "kein EK-Preis vorhanden" : "Firmenlager EK"
    } satisfies RoofingMaterialEstimateItem;
  });

  return {
    items,
    purchaseTotal: roundMoney(items.reduce((sum, item) => sum + (item.purchaseTotal ?? 0), 0)),
    salesTotal: roundMoney(items.reduce((sum, item) => sum + (item.salesTotal ?? 0), 0)),
    warnings: items.map((item) => item.warning).filter((warning): warning is string => Boolean(warning))
  };
}
