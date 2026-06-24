export type BauProValueDriver = {
  id: string;
  title: string;
  category: string;
  switchReason: string;
  timeSaving: string;
  moneySaving: string;
  errorPrevention: string;
  automation: string;
  demoProof: string;
};

export const bauProValueDrivers: BauProValueDriver[] = [
  {
    id: "mobile-time-tracking",
    title: "Mobile Zeiterfassung mit Tages- und Monatsauswertung",
    category: "Zeiterfassung",
    switchReason: "Papierzettel, WhatsApp-Nachrichten und Excel-Listen werden durch einen prüfbaren Ablauf ersetzt.",
    timeSaving: "Mitarbeiter erfassen Start, Ende und Pause direkt am Handy; Chef prüft Tagesstunden zentral statt Zettel einzusammeln.",
    moneySaving: "Vergessene Stunden, Rundungsfehler und Nacharbeit in der Lohnvorbereitung werden reduziert.",
    errorPrevention: "Nettozeit, Pausen und Status werden automatisch berechnet; freigegebene Einträge sind für Mitarbeiter gesperrt.",
    automation: "Aus genehmigten Zeiten entstehen PDF-Stundenzettel und CSV-Exporte für die Weiterverarbeitung.",
    demoProof: "In der Demo-Firma sind Tagesstunden, offene Freigaben und Monatsberichte bereits gefuellt."
  },
  {
    id: "daily-reports",
    title: "Tagesberichte mit Fotos, Wetter und PDF-Nachweis",
    category: "Dokumentation",
    switchReason: "Baustellendokumentation liegt nicht mehr verteilt in Fotoalben, Papierordnern und Chatverlaeufen.",
    timeSaving: "Tätigkeiten, Materialverbrauch, Besonderheiten und Fotos werden direkt am Arbeitstag erfasst.",
    moneySaving: "Saubere Nachweise helfen bei Rueckfragen, Nachtraegen und Streitfaellen, bevor daraus unbezahlte Arbeit wird.",
    errorPrevention: "Pflichtfelder, Wettervorschlaege und klare Zuordnung zur Baustelle vermeiden lueckenhafte Berichte.",
    automation: "Berichte können mit echten Wetterwerten, Fotos und PDF-Ausgabe vorbereitet werden.",
    demoProof: "Die Demo zeigt vorhandene Tagesberichte mit Baustellenbezug, Wetter und Fotoflow."
  },
  {
    id: "material-calculation",
    title: "Materialberechnung aus Auftragsmaßen",
    category: "Auftrag und Kalkulation",
    switchReason: "Vor-Kalkulation und Materialbedarf entstehen im Auftrag statt in getrennten Tabellen.",
    timeSaving: "Länge, Breite und Dachdetails erzeugen schnell eine Materialliste inklusive Standard-Verschnitt.",
    moneySaving: "Chef sieht EK/VK/Marge und erkennt frueh, ob Materialbedarf und Verkaufspreis zusammenpassen.",
    errorPrevention: "Mitarbeiter sehen keine Preise; Mengen werden nachvollziehbar mit Grundmenge, Zuschlag und Gesamtmenge dargestellt.",
    automation: "Aus Maßen entstehen Materialpositionen, Lagerabgleich und Mitbringlisten-Vorbereitung.",
    demoProof: "In der Demo lassen sich Aufträge mit Maßen öffnen und Materialbedarf nachvollziehen."
  },
  {
    id: "bring-lists",
    title: "Mitbringlisten für morgen mit Lagerabgleich",
    category: "Baustellenlogistik",
    switchReason: "Die Frage 'Was muss morgen ins Fahrzeug?' wird nicht mehr kurz vor Feierabend im Chat geklaert.",
    timeSaving: "Team und Vorarbeiter sehen eine klare Packliste mit Status statt mehrfacher Rueckfragen.",
    moneySaving: "Leerfahrten, Expresskaeufe und Baustellenstillstand durch fehlendes Material werden seltener.",
    errorPrevention: "Knappes oder fehlendes Material wird sichtbar, bevor das Team morgens losfaehrt.",
    automation: "BauPro gleicht Bestand, Reservierungen und Mindestbestand ab und erzeugt Warnungen für Chef/Admin.",
    demoProof: "Die Demo-Firma enthaelt Mitbringlisten, Materialwarnungen und Einkaufsvorschlaege."
  },
  {
    id: "inventory-control",
    title: "Lager, Fahrzeuge und Materialwarnungen",
    category: "Lager",
    switchReason: "Bestand im Hauptlager, Fahrzeug und auf Baustellen wird gemeinsam sichtbar.",
    timeSaving: "Material kann direkt gebucht, umgelagert oder als knapp markiert werden.",
    moneySaving: "Mindestbestaende und Einkaufsvorschlaege verhindern teure Sofortkaeufe und doppelte Lagerhaltung.",
    errorPrevention: "Atomare Buchungen schuetzen vor negativem Bestand bei parallelen Reservierungen.",
    automation: "Warnungen entstehen aus Lagerbestand, Mitbringliste und Reservierung statt aus Bauchgefuehl.",
    demoProof: "Die Demo zeigt knappe Artikel, Fahrzeuge und Lagerorte mit realistischen Dachdecker-Materialien."
  },
  {
    id: "customers-orders",
    title: "Kundenkartei, Aufträge und Baustellen in einem Prozess",
    category: "Bürosteuerung",
    switchReason: "Kundendaten, Auftrag, Baustelle, Bericht und Materialbedarf bleiben verbunden.",
    timeSaving: "Aus einem Kunden kann direkt ein Auftrag mit Baustelle und Materialplanung entstehen.",
    moneySaving: "Weniger doppelte Eingaben und weniger verlorene Informationen zwischen Angebot, Ausfuehrung und Dokumentation.",
    errorPrevention: "Mandanten- und Rollenlogik verhindert falsche Firmenzuordnung und unerlaubte Team-/Preiszugriffe.",
    automation: "Auftragsnummern, Baustellenbezug und Materialberechnung werden aus dem Ablauf heraus erzeugt.",
    demoProof: "Die Demo-Firma enthaelt Kunden, mehrere Baustellen und laufende Aufträge."
  },
  {
    id: "role-security",
    title: "Rollenrechte ohne Preis-Leaks",
    category: "Sicherheit",
    switchReason: "Chef/Admin behalten kaufmännische Daten, während Mitarbeiter schnell arbeiten können.",
    timeSaving: "Jeder sieht nur die Bereiche, die für seine Arbeit relevant sind.",
    moneySaving: "EK, VK, Margen und Preisquellen bleiben geschuetzt und werden nicht versehentlich geteilt.",
    errorPrevention: "Frontend und Supabase RLS trennen Firmen, Rollen und Preisfelder serverseitig.",
    automation: "Rollen steuern Navigation, Datenabfragen, Server Actions und preisbereinigte Views automatisch.",
    demoProof: "In der Demo kann zwischen Chef-, Vorarbeiter- und Mitarbeiterlogik unterschieden werden."
  },
  {
    id: "voice-ai",
    title: "Spracheingabe und KI-Unterstuetzung",
    category: "Mobile Arbeit",
    switchReason: "Baustelleninformationen müssen nicht mehr mühsam auf kleinen Displays getippt werden.",
    timeSaving: "Stunden, Tagesberichte, Materialmeldungen und Mitbringlisten können diktiert und bestätigt werden.",
    moneySaving: "Schnellere Erfassung senkt Nacharbeit im Büro und macht vergessene Details unwahrscheinlicher.",
    errorPrevention: "Texte werden vor dem Speichern bestätigt; unsichere KI-Vorschläge bleiben Entwürfe.",
    automation: "Diktate werden strukturiert und können zu Bericht, Zeit, Materialmeldung oder Mitbringliste werden.",
    demoProof: "Die Demo zeigt Spracheingabe, KI-Assistent und lokalen Fallback, falls OpenAI nicht erreichbar ist."
  },
  {
    id: "customer-portal-signature",
    title: "Kundenportal und digitale Arbeitsaufträge",
    category: "Kundenkommunikation",
    switchReason: "Kunden erhalten freigegebene Informationen statt ungeordneter Einzelupdates per Telefon oder Chat.",
    timeSaving: "Status, Fotos, Dokumente und Arbeitsaufträge können gezielt geteilt werden.",
    moneySaving: "Weniger Rueckfragen und klarere Freigaben beschleunigen Abnahmen und Folgeentscheidungen.",
    errorPrevention: "Kunden sehen keine internen Notizen, Lagerdaten, EK-Preise oder andere Baustellen.",
    automation: "Portal-Links, Arbeitsauftrag-Status, Signaturdaten, Dokumentenhash und PDF-Nachweis werden strukturiert gespeichert.",
    demoProof: "Die Demo kann freigegebene Kundenansichten und Arbeitsaufträge im Verkaufsdialog zeigen."
  },
  {
    id: "live-weather",
    title: "Wetter und Baustellenrisiken",
    category: "Planung",
    switchReason: "Wetter wird nicht als lose Notiz behandelt, sondern direkt mit Baustelle, Bericht und Planung verbunden.",
    timeSaving: "Chef sieht Live-Wetter der aktiven Baustelle; Mitarbeiter bekommen beim Einreichen einen einfachen Vorschlag.",
    moneySaving: "Regen, Wind und Materialrisiken können früher erkannt werden, bevor Schutzmaterial oder Teamplanung zu spät kommt.",
    errorPrevention: "Echte Wetterwerte werden gespeichert und bleiben im Bericht/PDF nachvollziehbar.",
    automation: "Open-Meteo, Baustellenkoordinaten und Risikobadges liefern automatisch praktische Hinweise.",
    demoProof: "Die Demo zeigt Wetterkarten, Fallbacks und wetterbezogene Nachweise."
  }
];

export const whyBauProSalesHighlights = [
  {
    label: "Weniger Nacharbeit",
    value: "Zeiten, Berichte und Material direkt aus dem Baustellenalltag"
  },
  {
    label: "Weniger Fehlfahrten",
    value: "Mitbringlisten, Lagerabgleich und Materialwarnungen vor Arbeitsbeginn"
  },
  {
    label: "Mehr Kontrolle",
    value: "Chef sieht Preise, Freigaben, Risiken und offene Aufgaben; Mitarbeiter sehen keine Margen"
  },
  {
    label: "Mehr Nachweis",
    value: "PDF-Stundenzettel, Tagesberichte, Fotos, Wetter und Audit-Spuren"
  }
];

export const whyBauProDemoFlow = [
  "Chef oeffnet Dashboard: Heute, Materialwarnungen, offene Zeiten und Live-Wetter sind sichtbar.",
  "Auftrag öffnen: Maße erfassen, Materialbedarf berechnen, Lagerbestand abgleichen.",
  "Mitbringliste erzeugen: Team sieht morgen nur die benoetigten Positionen ohne Preise.",
  "Mitarbeiter erfasst mobil: Stunden, Bericht, Foto und Material fehlt per Sprache oder Formular.",
  "Chef exportiert: Stundenzettel, Bericht oder Kundenfreigabe als nachvollziehbarer Nachweis."
];

export function valueDriverCountByCategory() {
  return bauProValueDrivers.reduce<Record<string, number>>((counts, driver) => {
    counts[driver.category] = (counts[driver.category] ?? 0) + 1;
    return counts;
  }, {});
}
