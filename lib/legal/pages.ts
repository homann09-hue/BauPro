import { dataMap, retentionConcept, subprocessors } from "@/lib/compliance/data-map";

export type LegalPage = {
  slug: string;
  title: string;
  summary: string;
  sections: Array<{ heading: string; body: string[] }>;
};

const draftNotice =
  "Prüfpflichtiger Entwurf: Dieser Text ist keine Rechtsberatung und muss vor produktiver Nutzung durch Anwalt oder Datenschutzbeauftragten final geprüft werden.";

export const legalPages: LegalPage[] = [
  {
    slug: "impressum",
    title: "Impressum",
    summary: "Prüfpflichtiger Entwurf für Anbieterkennzeichnung und Kontaktangaben.",
    sections: [
      { heading: "Prüfhinweis", body: [draftNotice] },
      {
        heading: "Anbieter",
        body: [
          "BauPro SaaS Betreiber: [Firmenname eintragen]",
          "Adresse: [ladungsfaehige Anschrift eintragen]",
          "E-Mail: [Kontaktadresse eintragen]",
          "Telefon: [optional eintragen]",
          "Vertreten durch: [Geschaeftsfuehrung/Inhaber eintragen]"
        ]
      },
      { heading: "Register und Aufsicht", body: ["Registergericht, Registernummer, Umsatzsteuer-ID und berufsrechtliche Angaben final ergänzen, falls erforderlich."] }
    ]
  },
  {
    slug: "datenschutz",
    title: "Datenschutzerklaerung",
    summary: "Transparenzentwurf zu Datenarten, Zwecken, Rollen und Drittanbietern.",
    sections: [
      { heading: "Prüfhinweis", body: [draftNotice] },
      {
        heading: "Verarbeitete Daten",
        body: dataMap.map((entry) => `${entry.area}: ${entry.data.join(", ")}. Zweck: ${entry.purpose}`)
      },
      {
        heading: "Rollen und Zugriff",
        body: [
          "Chef/Admin sieht betriebliche Stammdaten, Mitarbeiterdaten, Zeiten, Preise und Exporte im Rahmen der Firmenverwaltung.",
          "Vorarbeiter und Mitarbeiter sehen operative zugeordnete Daten ohne EK, VK, Marge, Aufschlag und Preisvergleich.",
          "Row Level Security trennt Firmenmandanten technisch in Supabase."
        ]
      },
      {
        heading: "KI, Spracheingabe und Fotos",
        body: [
          "KI-Funktionen sind optional und laufen serverseitig. Eingaben werden vor Verwendung im UI bestätigt.",
          "Spracheingabe wird im Browser erkannt und erst nach Bestätigung gespeichert.",
          "Fotos sollen nur soweit erforderlich hochgeladen werden; Personen, Kennzeichen und private Innenraeume nach Möglichkeit vermeiden."
        ]
      }
    ]
  },
  {
    slug: "agb",
    title: "AGB",
    summary: "B2B-SaaS Vertragsentwurf für spätere anwaltliche Finalisierung.",
    sections: [
      { heading: "Prüfhinweis", body: [draftNotice] },
      {
        heading: "Leistungsbeschreibung",
        body: [
          "BauPro stellt eine Web-App für Handwerksbetriebe bereit: Baustellen, Kunden, Material, Zeiten, Berichte, optionale KI und Exporte.",
          "Noch vorbereitete Module wie Angebote/Rechnungen werden im Produkt als vorbereitet markiert."
        ]
      },
      {
        heading: "Pflichten der Kundenfirma",
        body: [
          "Die Kundenfirma vergibt Rollen sorgfältig, prüft Mitarbeiterrechte und stellt sicher, dass hochgeladene Inhalte erforderlich sind.",
          "Rechtliche Pflichten wie Arbeitsrecht, Steuerrecht und Datenschutz müssen kunden- und landesspezifisch geprüft werden."
        ]
      }
    ]
  },
  {
    slug: "avv",
    title: "AVV-Hinweis",
    summary: "Prüfpflichtiger Entwurf für Auftragsverarbeitung zwischen SaaS-Anbieter und Kundenfirma.",
    sections: [
      { heading: "Prüfhinweis", body: [draftNotice] },
      {
        heading: "Auftragsverarbeitung",
        body: [
          "BauPro verarbeitet Betriebs- und Mitarbeiterdaten im Auftrag der Kundenfirma.",
          "Ein finaler AVV/DPA muss Gegenstand, Dauer, Art und Zweck der Verarbeitung, Kategorien betroffener Personen, technische und organisatorische Massnahmen sowie Subprozessoren regeln."
        ]
      },
      {
        heading: "AVV-Dokument",
        body: ["Im Produkt kann ein final geprüfter AVV als PDF bereitgestellt werden. Bis zur rechtlichen Finalisierung bleibt dieser Bereich klar als prüfpflichtiger Entwurf gekennzeichnet."]
      }
    ]
  },
  {
    slug: "cookies",
    title: "Cookie-Richtlinie",
    summary: "Notwendige Login-Cookies und optionales Opt-in für spätere Analyse/Marketing-Tools.",
    sections: [
      { heading: "Prüfhinweis", body: [draftNotice] },
      {
        heading: "Aktueller Stand",
        body: [
          "Notwendige Cookies werden für Login, Session und Sicherheit genutzt.",
          "Analyse- und Marketing-Verarbeitung ist optional vorbereitet und darf erst nach aktiver Zustimmung aktiviert werden."
        ]
      }
    ]
  },
  {
    slug: "loeschkonzept",
    title: "Loesch- und Aufbewahrungskonzept",
    summary: "Technischer Entwurf für Retention, Archivierung und Vertragsende.",
    sections: [
      { heading: "Prüfhinweis", body: [draftNotice] },
      { heading: "Grundsaetze", body: retentionConcept },
      {
        heading: "Technische Vorbereitung",
        body: [
          "Mitarbeiter können deaktiviert statt hart gelöscht werden.",
          "Datenschutzanfragen und Exporte sind im Datenschutz-Center vorbereitet.",
          "Soft-Delete/Archivfelder sind für zentrale Tabellen vorbereitet."
        ]
      }
    ]
  },
  {
    slug: "subprozessoren",
    title: "Subprozessoren und Drittanbieter",
    summary: "Entwurf für Drittanbietertransparenz.",
    sections: [
      { heading: "Prüfhinweis", body: [draftNotice] },
      {
        heading: "Drittanbieter",
        body: subprocessors.map((processor) => `${processor.name}: ${processor.role}. Daten: ${processor.data}. Status: ${processor.status}.`)
      }
    ]
  }
];

export function getLegalPage(slug: string) {
  return legalPages.find((page) => page.slug === slug) ?? null;
}
