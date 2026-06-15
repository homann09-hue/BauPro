import type { OrderType } from "@/types/app";

type TemplateItem = {
  name: string;
  itemType: "tool" | "safety" | "document" | "other";
  quantity: number;
  unit: string;
};

export const bringListTemplates: Record<OrderType, TemplateItem[]> = {
  steildach: [
    { name: "Latthammer", itemType: "tool", quantity: 1, unit: "Stueck" },
    { name: "Nagler", itemType: "tool", quantity: 1, unit: "Stueck" },
    { name: "Akkuschrauber", itemType: "tool", quantity: 1, unit: "Stueck" },
    { name: "Cuttermesser", itemType: "tool", quantity: 2, unit: "Stueck" },
    { name: "PSA Dacharbeiten", itemType: "safety", quantity: 1, unit: "Satz" }
  ],
  flachdach: [
    { name: "Gasbrenner", itemType: "tool", quantity: 1, unit: "Stueck" },
    { name: "Gasflasche", itemType: "tool", quantity: 1, unit: "Stueck" },
    { name: "Besen", itemType: "tool", quantity: 1, unit: "Stueck" },
    { name: "Andruckrolle", itemType: "tool", quantity: 1, unit: "Stueck" },
    { name: "Cuttermesser", itemType: "tool", quantity: 2, unit: "Stueck" },
    { name: "PSA Flachdach", itemType: "safety", quantity: 1, unit: "Satz" }
  ],
  dachrinne: [
    { name: "Bohrmaschine", itemType: "tool", quantity: 1, unit: "Stueck" },
    { name: "Blechschere", itemType: "tool", quantity: 1, unit: "Stueck" },
    { name: "Wasserwaage", itemType: "tool", quantity: 1, unit: "Stueck" },
    { name: "PSA Montage", itemType: "safety", quantity: 1, unit: "Satz" }
  ],
  blech: [
    { name: "Blechschere", itemType: "tool", quantity: 1, unit: "Stueck" },
    { name: "Falzzange", itemType: "tool", quantity: 1, unit: "Stueck" },
    { name: "Akkuschrauber", itemType: "tool", quantity: 1, unit: "Stueck" },
    { name: "PSA Blech", itemType: "safety", quantity: 1, unit: "Satz" }
  ],
  reparatur: [
    { name: "Werkzeugkoffer Reparatur", itemType: "tool", quantity: 1, unit: "Stueck" },
    { name: "Leiter sichern", itemType: "safety", quantity: 1, unit: "Satz" },
    { name: "PSA Reparatur", itemType: "safety", quantity: 1, unit: "Satz" }
  ],
  wartung: [
    { name: "Wartungsmappe", itemType: "document", quantity: 1, unit: "Stueck" },
    { name: "Kamera / Fotodoku", itemType: "tool", quantity: 1, unit: "Stueck" },
    { name: "PSA Wartung", itemType: "safety", quantity: 1, unit: "Satz" }
  ],
  sonstiges: [
    { name: "Werkzeug Grundausstattung", itemType: "tool", quantity: 1, unit: "Satz" },
    { name: "PSA", itemType: "safety", quantity: 1, unit: "Satz" }
  ]
};
