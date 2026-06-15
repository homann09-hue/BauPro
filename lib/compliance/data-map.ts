export type DataMapEntry = {
  area: string;
  data: string[];
  purpose: string;
  visibility: string;
  retention: string;
  processors: string[];
  risk: "normal" | "sensibel" | "hoch";
};

export const dataMap: DataMapEntry[] = [
  {
    area: "Nutzerkonten und Rollen",
    data: ["E-Mail-Adresse", "Name", "Rolle", "Firmenzuordnung", "Aktivstatus"],
    purpose: "Authentifizierung, Berechtigung und Mandantentrennung.",
    visibility: "Eigene Firma; Rollenverwaltung nur Chef/Admin.",
    retention: "Solange Vertrags-/Arbeitsverhaeltnis besteht; Deaktivierung vor harter Loeschung vorbereiten.",
    processors: ["Supabase Auth", "Supabase Postgres"],
    risk: "sensibel"
  },
  {
    area: "Kunden, Auftraege und Baustellen",
    data: ["Kundennamen", "Kontaktpersonen", "Adressen", "Telefon/E-Mail optional", "Notizen", "Baustellenstatus"],
    purpose: "Auftragsdurchfuehrung, Einsatzplanung, Dokumentation und Abrechnungsvorbereitung.",
    visibility: "Chef/Admin vollstaendig; Mitarbeiter nur zugeordnete operative Daten ohne interne Preisdetails.",
    retention: "Nach handels-/steuerrechtlichen und vertraglichen Fristen; Archivierung statt Sofortloeschung vorbereiten.",
    processors: ["Supabase Postgres"],
    risk: "sensibel"
  },
  {
    area: "Zeiterfassung und Stundenzettel",
    data: ["Mitarbeiter", "Datum", "Baustelle", "Arbeitsbeginn/-ende", "Pause", "Taetigkeit", "Korrekturhistorie"],
    purpose: "Arbeitszeitdokumentation, Lohn-/Projektkontrolle und PDF-/CSV-Export.",
    visibility: "Mitarbeiter eigene Zeiten; Chef/Admin alle Zeiten der Firma.",
    retention: "Arbeitszeit- und Nachweispflichten pruefen; Aenderungen auditieren.",
    processors: ["Supabase Postgres", "PDF-Erzeugung serverseitig"],
    risk: "hoch"
  },
  {
    area: "Fotos und Tagesberichte",
    data: ["Baustellenfotos", "Dateinamen", "Tagesberichtstexte", "Wetter", "Besonderheiten"],
    purpose: "Baustellendokumentation und Nachweis gegenueber Kunden/Betrieb.",
    visibility: "Zugeordnete Nutzer und Chef/Admin; Storage-Pfade pro Firma getrennt.",
    retention: "Projekt-/Gewaehrleistungsfristen pruefen; unnoetige Personen-/Kennzeichenfotos vermeiden.",
    processors: ["Supabase Storage", "Supabase Postgres"],
    risk: "hoch"
  },
  {
    area: "Spracheingabe und KI",
    data: ["Diktattext", "erkannte Entitaeten", "KI-Vorschlaege", "Usage-Metadaten"],
    purpose: "Strukturierung von Eingaben, Vorschlaege fuer Berichte, Zeiten, Material und Auftraege.",
    visibility: "Eigene Firma; Mitarbeiter ohne Preis-/Margendaten; KI nur serverseitig.",
    retention: "Diktate und Vorschlaege nur zweckbezogen speichern; KI-Nutzung auditierbar halten.",
    processors: ["OpenAI optional", "Supabase Postgres"],
    risk: "hoch"
  },
  {
    area: "Material, Lager und Preise",
    data: ["Materialnamen", "Bestand", "Lagerort", "EK/VK", "Marge", "Preisquellen", "Lieferanten"],
    purpose: "Lagerfuehrung, Kalkulation, Einkaufsvorschlaege und Preisvergleich.",
    visibility: "Bestand ohne Preise fuer Mitarbeiter; Preise/Preisquellen nur Chef/Admin.",
    retention: "Solange fuer Betrieb, Nachweis, Kalkulation und Einkauf erforderlich.",
    processors: ["Supabase Postgres", "optionale Preis-APIs/CSV-Feeds"],
    risk: "sensibel"
  },
  {
    area: "Exports, Logs und Audit",
    data: ["Exportzeitpunkt", "Akteur", "Aktion", "Aenderungen", "Fehler ohne personenbezogene Details"],
    purpose: "Nachvollziehbarkeit, Datenschutzanfragen, Sicherheitsanalyse und Vertragsende.",
    visibility: "Chef/Admin; eigene Datenschutzanfragen fuer betroffene Nutzer.",
    retention: "Audit- und Sicherheitsfristen im Datenschutzkonzept final festlegen.",
    processors: ["Supabase Postgres"],
    risk: "sensibel"
  }
];

export const subprocessors = [
  {
    name: "Supabase",
    role: "Hosting, Authentifizierung, Datenbank und Storage",
    data: "Nutzerkonten, Firmen-/Betriebsdaten, Fotos, Dokumentationsdaten",
    status: "Produktiv erforderlich; AVV/DPA und Region final pruefen"
  },
  {
    name: "OpenAI",
    role: "Optionale KI-Verarbeitung ueber serverseitige API",
    data: "Reduzierte Texteingaben und Kontextdaten, keine API-Keys im Frontend",
    status: "Optional; nur nach Aktivierung und finaler Datenschutzpruefung"
  },
  {
    name: "eBay/PriceAPI/DataForSEO/SearchApi/CSV-Feeds",
    role: "Optionale Preisindikatoren fuer Chef/Admin",
    data: "Materialsuchbegriffe und Angebotsmetadaten, keine Mitarbeiterdaten erforderlich",
    status: "Optional; jeweilige Anbieterbedingungen und Drittlandbezug pruefen"
  },
  {
    name: "Vercel oder eigener Hoster",
    role: "Deployment und Webhosting",
    data: "Serverlogs, technische Requestdaten, Build-/Runtime-Umgebung",
    status: "Deployment-abhaengig; Logging/Region/AVV final pruefen"
  }
];

export const retentionConcept = [
  "Mitarbeiterzugang deaktivieren statt sofort hart loeschen, solange Nachweis- oder Aufbewahrungspflichten bestehen.",
  "Arbeitszeitdaten mit Aenderungshistorie aufbewahren; Fristen durch Anwalt/Datenschutzbeauftragten final festlegen.",
  "Baustellenberichte, Fotos und Auftragsdaten projektbezogen archivieren und nach Fristablauf loeschbar machen.",
  "KI-Diktate und Aktionsvorschlaege nur zweckbezogen speichern und nicht fuer verdeckte Leistungskontrolle verwenden.",
  "Preis-/Einkaufsdaten strikt von Mitarbeiteransichten trennen.",
  "Vertragsende: Firmenexport bereitstellen, danach Sperr-/Loeschkonzept anwenden."
];
