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
    summary: "Prüfpflichtiger Entwurf für Anbieterkennzeichnung, Kontaktangaben und verantwortliche Stelle.",
    sections: [
      { heading: "Prüfhinweis", body: [draftNotice] },
      {
        heading: "Anbieter",
        body: [
          "BauPro SaaS Betreiber: [Firmenname eintragen]",
          "Adresse: [ladungsfähige Anschrift eintragen]",
          "E-Mail: [Kontaktadresse eintragen]",
          "Telefon: [optional eintragen]",
          "Vertreten durch: [Geschäftsführung/Inhaber eintragen]"
        ]
      },
      {
        heading: "Register und Aufsicht",
        body: [
          "Registergericht, Registernummer, Umsatzsteuer-ID und berufsrechtliche Angaben müssen final ergänzt werden, sofern sie für den Betreiber erforderlich sind.",
          "Für Handwerks- oder Softwareleistungen können zusätzliche Pflichtangaben relevant sein. Diese Seite ist deshalb bewusst als Entwurf gekennzeichnet."
        ]
      },
      {
        heading: "Kontakt und Support",
        body: [
          "Für Kundenanfragen, Support und Datenschutzthemen sollte eine zentrale Kontaktadresse angegeben werden.",
          "Empfehlung: Support, Datenschutz und Rechnungsfragen sollten intern klar getrennt bearbeitet werden, auch wenn nach außen zunächst eine gemeinsame Adresse genutzt wird."
        ]
      }
    ]
  },
  {
    slug: "datenschutz",
    title: "Datenschutzerklärung",
    summary: "Transparenzentwurf zu Datenarten, Zwecken, Rollen und Drittanbietern.",
    sections: [
      { heading: "Prüfhinweis", body: [draftNotice] },
      {
        heading: "Grundsatz",
        body: [
          "BauPro ist als B2B-SaaS für Handwerksbetriebe gedacht. Die Kundenfirma bleibt regelmäßig Verantwortlicher für die Daten ihrer Mitarbeiter, Kunden und Baustellen.",
          "Der SaaS-Betreiber verarbeitet Daten nach Konfiguration, Vertrag und technischer Rolle. Ein finaler AVV/DPA muss vor produktiver Nutzung bereitgestellt und geprüft werden."
        ]
      },
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
        heading: "Kundenportal",
        body: [
          "Kundenportal-Links sollen nur freigegebene Baustelleninhalte zeigen. Interne Notizen, Lagerdaten, Mitarbeiterpreise und Einkaufspreise gehören nicht in die Kundenansicht.",
          "Portalzugriffe sollten zeitlich begrenzt, protokollierbar und bei Bedarf widerrufbar sein."
        ]
      },
      {
        heading: "KI, Spracheingabe und Fotos",
        body: [
          "KI-Funktionen sind optional und laufen serverseitig. Eingaben werden vor Verwendung im UI bestätigt.",
          "Spracheingabe wird im Browser erkannt und erst nach Bestätigung gespeichert.",
          "Fotos sollen nur soweit erforderlich hochgeladen werden; Personen, Kennzeichen und private Innenräume nach Möglichkeit vermeiden.",
          "Wenn KI-Dienste externe Anbieter nutzen, muss die Datenübermittlung transparent beschrieben, vertraglich abgesichert und im Produkt als optionale Verarbeitung kenntlich gemacht werden."
        ]
      },
      {
        heading: "Speicherung, Export und Löschung",
        body: [
          "Personenbezogene Daten sollten nur so lange gespeichert werden, wie sie für Betrieb, Nachweis, Vertrag oder gesetzliche Pflichten benötigt werden.",
          "BauPro bereitet Exporte, Archivierung und Löschkonzepte technisch vor. Konkrete Fristen müssen durch Betreiber und Kundenfirma festgelegt werden."
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
          "Noch vorbereitete Module wie Angebote/Rechnungen werden im Produkt als vorbereitet markiert, bis Billing, Vertragsunterlagen und Leistungsumfang final konfiguriert sind.",
          "Die Software unterstützt Arbeitsabläufe, ersetzt aber keine fachliche Prüfung, Meisterentscheidung, rechtliche Beratung oder steuerliche Prüfung."
        ]
      },
      {
        heading: "Pflichten der Kundenfirma",
        body: [
          "Die Kundenfirma vergibt Rollen sorgfältig, prüft Mitarbeiterrechte und stellt sicher, dass hochgeladene Inhalte erforderlich sind.",
          "Rechtliche Pflichten wie Arbeitsrecht, Steuerrecht und Datenschutz müssen kunden- und landesspezifisch geprüft werden."
        ]
      },
      {
        heading: "Verfügbarkeit und Änderungen",
        body: [
          "Für produktive Nutzung sollten Verfügbarkeit, Supportzeiten, Wartungsfenster, Datensicherung und Reaktionszeiten vertraglich konkret geregelt werden.",
          "Neue Funktionen, KI-Module oder Preisquellen dürfen nicht automatisch als verbindliche Fach- oder Preisentscheidung verstanden werden."
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
          "Ein finaler AVV/DPA muss Gegenstand, Dauer, Art und Zweck der Verarbeitung, Kategorien betroffener Personen, technische und organisatorische Maßnahmen sowie Subprozessoren regeln.",
          "Dazu gehören insbesondere Supabase, Hosting, E-Mail, Zahlungsabwicklung, Fehler-Monitoring und optional KI-Anbieter."
        ]
      },
      {
        heading: "AVV-Dokument",
        body: ["Im Produkt kann ein final geprüfter AVV als PDF bereitgestellt werden. Bis zur rechtlichen Finalisierung bleibt dieser Bereich klar als prüfpflichtiger Entwurf gekennzeichnet."]
      },
      {
        heading: "Technische und organisatorische Maßnahmen",
        body: [
          "Relevante Maßnahmen sind unter anderem Rollenrechte, Mandantentrennung, Zugriffskontrolle, sichere Uploads, Protokollierung, Backups und ein Prozess für Datenschutzanfragen.",
          "Diese Maßnahmen müssen in der produktiven Umgebung regelmäßig geprüft und dokumentiert werden."
        ]
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
      },
      {
        heading: "Einstellungen",
        body: [
          "Nutzer sollen freiwillige Analyse- oder Marketing-Cookies ablehnen oder später ändern können.",
          "Technisch notwendige Cookies können für Authentifizierung, Sicherheit und Session-Funktion erforderlich sein."
        ]
      }
    ]
  },
  {
    slug: "loeschkonzept",
    title: "Lösch- und Aufbewahrungskonzept",
    summary: "Technischer Entwurf für Retention, Archivierung und Vertragsende.",
    sections: [
      { heading: "Prüfhinweis", body: [draftNotice] },
      { heading: "Grundsätze", body: retentionConcept },
      {
        heading: "Technische Vorbereitung",
        body: [
          "Mitarbeiter können deaktiviert statt hart gelöscht werden.",
          "Datenschutzanfragen und Exporte sind im Datenschutz-Center vorbereitet.",
          "Soft-Delete/Archivfelder sind für zentrale Tabellen vorbereitet."
        ]
      },
      {
        heading: "Vertragsende",
        body: [
          "Bei Kündigung oder Vertragsende sollte geregelt sein, wie lange Daten exportiert werden können und wann sie gelöscht oder archiviert werden.",
          "Für steuer- und nachweisrelevante Dokumente können gesetzliche Aufbewahrungsfristen gelten. Diese müssen kundenspezifisch geprüft werden."
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
