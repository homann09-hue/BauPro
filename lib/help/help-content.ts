import type { Role } from "@/types/app";

export type HelpFeatureKey =
  | "time_entry_create"
  | "daily_report_create"
  | "voice_input"
  | "bring_list_use"
  | "material_missing_report"
  | "weather_accept"
  | "photo_upload"
  | "jobsite_view"
  | "task_complete"
  | "inventory_availability"
  | "material_reservation"
  | "purchase_suggestion"
  | "material_control_center"
  | "why_baupro_time"
  | "why_baupro_money"
  | "why_baupro_errors"
  | "why_baupro_automation";

export type HelpAudience = "all" | "worker" | "manager";

export type HelpTipDefinition = {
  featureKey: HelpFeatureKey;
  title: string;
  body: string;
  audience: HelpAudience;
  category: string;
  steps?: string[];
};

export const helpTips: HelpTipDefinition[] = [
  {
    featureKey: "why_baupro_time",
    title: "BauPro Nutzen: Zeit sparen",
    body: "Stunden, Berichte, Fotos, Materialmeldungen und Mitbringlisten entstehen direkt im Arbeitsfluss statt später im Büro.",
    audience: "all",
    category: "BauPro Nutzen",
    steps: ["Dashboard öffnen", "Tagesstunden prüfen", "Bericht oder Mitbringliste zeigen", "PDF/CSV-Export als Ergebnis nennen"]
  },
  {
    featureKey: "why_baupro_money",
    title: "BauPro Nutzen: Kosten senken",
    body: "Materialwarnungen, Lagerabgleich, Einkaufsvorschläge und Chef-Preise helfen, Fehlfahrten, Expresskäufe und Margeverlust zu reduzieren.",
    audience: "manager",
    category: "BauPro Nutzen",
    steps: ["Material-Zentrale zeigen", "Knappe Artikel öffnen", "Mitbringliste für morgen erklären", "Preisfelder nur Chef zeigen"]
  },
  {
    featureKey: "why_baupro_errors",
    title: "BauPro Nutzen: Fehler vermeiden",
    body: "Rollenrechte, Pflichtfelder, Status, Freigaben, Wetterwerte und Audit-Spuren machen Betriebsdaten vollständiger und kontrollierbarer.",
    audience: "all",
    category: "BauPro Nutzen"
  },
  {
    featureKey: "why_baupro_automation",
    title: "BauPro Nutzen: Automatisieren",
    body: "Auftragsmaße berechnen Materialbedarf, Mitbringlisten prüfen Bestand, Zeiten erzeugen Stundenzettel und Diktate werden zu Entwürfen.",
    audience: "all",
    category: "BauPro Nutzen"
  },
  {
    featureKey: "bring_list_use",
    title: "Mitbringliste nutzen",
    body: "Hier siehst du, was morgen mit zur Baustelle muss. Hake gepackte Sachen ab und melde fehlendes Material direkt dem Chef.",
    audience: "all",
    category: "Mitbringlisten",
    steps: ["Liste öffnen", "Material prüfen", "Gepackte Sachen abhaken", "Fehlendes Material melden"]
  },
  {
    featureKey: "material_missing_report",
    title: "Material fehlt melden",
    body: "Wenn etwas fehlt, hier melden. Der Chef sieht es sofort und kann Material besorgen.",
    audience: "worker",
    category: "Material",
    steps: ["Material nennen", "Menge eintragen", "Baustelle wählen", "Meldung senden"]
  },
  {
    featureKey: "inventory_availability",
    title: "Lagerstatus verstehen",
    body: "Grün bedeutet: genug da. Gelb bedeutet: knapp. Rot bedeutet: fehlt oder muss besorgt werden.",
    audience: "all",
    category: "Lager"
  },
  {
    featureKey: "material_reservation",
    title: "Material reservieren",
    body: "Reserviertes Material ist für diese Baustelle vorgemerkt und wird nicht doppelt verplant.",
    audience: "manager",
    category: "Lager",
    steps: ["Mitbringliste prüfen", "Lagerort wählen", "Menge reservieren", "Packstatus beobachten"]
  },
  {
    featureKey: "voice_input",
    title: "Sprache statt Tippen",
    body: "Du kannst sprechen statt tippen. Gespeichert wird erst, wenn du bestätigst.",
    audience: "all",
    category: "Sprache"
  },
  {
    featureKey: "time_entry_create",
    title: "Stunden schnell erfassen",
    body: "Wähle Baustelle, Beginn, Ende und Pause. BauPro rechnet Brutto- und Nettozeit automatisch.",
    audience: "all",
    category: "Zeiterfassung"
  },
  {
    featureKey: "daily_report_create",
    title: "Tagesbericht schreiben",
    body: "Halte Tätigkeiten, Materialverbrauch, Fotos und Besonderheiten direkt am Arbeitstag fest.",
    audience: "all",
    category: "Berichte"
  },
  {
    featureKey: "weather_accept",
    title: "Wetter als Nachweis",
    body: "Beim Einreichen kann BauPro Wetterdaten vorschlagen. Du entscheidest, ob du sie übernimmst.",
    audience: "all",
    category: "Wetter"
  },
  {
    featureKey: "photo_upload",
    title: "Fotos sauber dokumentieren",
    body: "Lade nur notwendige Baustellenfotos hoch und achte darauf, private Bereiche zu vermeiden.",
    audience: "all",
    category: "Berichte"
  },
  {
    featureKey: "jobsite_view",
    title: "Baustelle im Blick",
    body: "Auf der Baustelle findest du Adresse, Aufgaben, Berichte, Material und wichtige Hinweise an einem Ort.",
    audience: "all",
    category: "Baustellen"
  },
  {
    featureKey: "task_complete",
    title: "Aufgaben erledigen",
    body: "Setze Aufgaben auf erledigt, sobald sie abgeschlossen sind. So sieht das Team, was offen bleibt.",
    audience: "all",
    category: "Aufgaben"
  },
  {
    featureKey: "purchase_suggestion",
    title: "Einkaufsvorschläge",
    body: "Wenn Material fehlt, erstellt BauPro Vorschläge für Chef. Preise bleiben für Mitarbeiter ausgeblendet.",
    audience: "manager",
    category: "Einkauf"
  },
  {
    featureKey: "material_control_center",
    title: "Material Control Center",
    body: "Hier sieht Chef, welche Mitbringlisten für morgen kritisch sind, was reserviert ist und was gekauft werden muss.",
    audience: "manager",
    category: "Lager"
  }
];

export function canSeeHelpTip(role: Role, audience: HelpAudience) {
  const isManager = role === "admin" || role === "chef";
  if (audience === "manager") return isManager;
  if (audience === "worker") return !isManager;
  return true;
}

export function helpTipByKey(featureKey: HelpFeatureKey) {
  return helpTips.find((tip) => tip.featureKey === featureKey) ?? null;
}
