export type MarketingFeature = {
  title: string;
  description: string;
  icon: "briefcase" | "clock" | "package" | "report" | "portal" | "camera" | "bot" | "users" | "receipt";
};

export type MarketingUseCase = {
  title: string;
  description: string;
  points: string[];
};

export type MarketingPlan = {
  name: string;
  price: string;
  priceNote: string;
  description: string;
  features: string[];
  highlighted?: boolean;
};

export type MarketingFeatureDetail = {
  title: string;
  lead: string;
  body: string;
  outcome: string;
};

export type MarketingComparisonRow = {
  label: string;
  starter: string;
  professional: string;
  business: string;
};

export const marketingFeatures: MarketingFeature[] = [
  {
    title: "Aufträge & Baustellen",
    description:
      "Kunden, Aufträge, Baustellenadressen, Status, Maße und nächste Schritte werden sauber verbunden. Der Chef sieht, was offen ist; das Team sieht, was auf der Baustelle wichtig ist.",
    icon: "briefcase"
  },
  {
    title: "Zeiterfassung",
    description:
      "Mitarbeiter erfassen Arbeitszeiten mobil mit Pause, Tätigkeit und Baustelle. Chef/Admin prüft Tagesstunden, Freigaben und Stundenzettel ohne handschriftliche Nachträge.",
    icon: "clock"
  },
  {
    title: "Material & Lager",
    description:
      "Bestände, Mindestmengen, Lagerorte, Fahrzeuglager und Materialwarnungen bleiben sichtbar. Fehlendes Material wird früher erkannt, bevor morgens auf der Baustelle etwas fehlt.",
    icon: "package"
  },
  {
    title: "Bautagesberichte",
    description:
      "Tätigkeiten, Wetter, Zeiten, Materialverbrauch, Fotos und Besonderheiten werden nachvollziehbar dokumentiert und können als PDF-Nachweis ausgegeben werden.",
    icon: "report"
  },
  {
    title: "Kundenportal",
    description:
      "Kunden sehen nur freigegebene Baustelleninfos, Termine, Fotos und Dokumente. Interne Notizen, Lagerdaten, EK/VK-Preise und Mitarbeiterinformationen bleiben geschützt.",
    icon: "portal"
  },
  {
    title: "Fotos & Dokumente",
    description:
      "Baustellenfotos, Arbeitsaufträge, Abnahmen und Nachweise werden direkt Auftrag, Bericht oder Kunde zugeordnet. Das reduziert Suchen in Chats und privaten Fotoalben.",
    icon: "camera"
  },
  {
    title: "KI-Unterstützung",
    description:
      "Optionale KI hilft bei Berichtsentwürfen, Strukturierung von Spracheingaben und Materialvorschlägen. Alles bleibt Entwurf und muss vom Nutzer geprüft werden.",
    icon: "bot"
  },
  {
    title: "Mitarbeiter & Rollen",
    description:
      "Chef/Admin, Vorarbeiter, Mitarbeiter und Kunde bekommen unterschiedliche Ansichten. Sensible Preise und Einstellungen bleiben für operative Nutzer ausgeblendet.",
    icon: "users"
  },
  {
    title: "Angebote/Rechnungen",
    description:
      "Angebote, Rechnungen, Positionen und PDF-Export sind in die Auftragsstrecke eingebunden. Kunden-PDFs zeigen keine internen EK-Preise oder Margen.",
    icon: "receipt"
  }
];

export const marketingFeatureDetails: MarketingFeatureDetail[] = [
  {
    title: "Aufträge",
    lead: "Ein Auftrag ist der zentrale Arbeitsordner für Kunde, Adresse, Leistungsbeschreibung, Status und Kalkulation.",
    body:
      "BauPro hält die kaufmännische Vorbereitung und die operative Baustellenarbeit zusammen. Aus dem Auftrag entstehen Baustellen, Materialbedarf, Fotos, Berichte und später Angebote oder Rechnungen. Dadurch müssen Informationen nicht mehrfach in Excel, Chat und Papierlisten gepflegt werden.",
    outcome: "Ergebnis: Chef und Büro sehen den Status, das Team arbeitet mit klaren nächsten Schritten."
  },
  {
    title: "Baustellen",
    lead: "Jede Baustelle bündelt Adresse, Notizen, Team, Status, Fotos, Berichte, Material und Aufgaben.",
    body:
      "Für Dachdecker ist die Baustelle der Ort, an dem alles zusammenläuft: Wetter, Anfahrt, Aufmaß, Mitbringliste, Tagesbericht und offene Punkte. BauPro zeigt diese Informationen mobil und im Büro so, dass sie schnell auffindbar bleiben.",
    outcome: "Ergebnis: weniger Rückfragen, weniger verlorene Informationen, klarere Tagesplanung."
  },
  {
    title: "Zeiterfassung",
    lead: "Zeiten werden direkt am Handy zur Baustelle erfasst und später von Chef/Admin geprüft.",
    body:
      "Mitarbeiter wählen Datum, Baustelle, Start, Ende, Pause und Tätigkeit. Das System berechnet Brutto- und Nettozeit und bereitet Monatsberichte sowie CSV/PDF-Exporte vor. Freigegebene Einträge bleiben nachvollziehbar und können nicht mehr beliebig durch Mitarbeiter geändert werden.",
    outcome: "Ergebnis: sauberere Stundenzettel und weniger Nachtragen aus dem Gedächtnis."
  },
  {
    title: "Lager",
    lead: "Bestände werden nach Lagerort geführt: Hauptlager, Fahrzeug, Baustelle oder offene Bestellung.",
    body:
      "Der Lagerbereich macht sichtbar, wo Material liegt, was knapp wird und welche Baustelle bereits Material reserviert hat. Bewegungen wie Verbrauch, Rückgabe, Verlust oder Korrektur werden nachvollziehbarer, statt nur in Zuruf oder Papierlisten zu landen.",
    outcome: "Ergebnis: weniger Stillstand, weil Material früher auffällt."
  },
  {
    title: "Material",
    lead: "Materialstammdaten, Einheiten, Mindestbestand und Preise werden rollenbasiert verwaltet.",
    body:
      "Chef/Admin kann Einkaufspreise, Verkaufspreise, Lieferanten und Aufschläge pflegen. Mitarbeiter sehen dagegen nur operative Informationen wie Materialname, Menge, Einheit, Lagerort und Bestand. So bleibt die Baustellen-App schnell, ohne kaufmännische Daten offenzulegen.",
    outcome: "Ergebnis: Materialplanung bleibt praktisch, Preise bleiben Chefsache."
  },
  {
    title: "Mitbringlisten",
    lead: "Für morgen sieht das Team, was zur Baustelle mitgenommen werden soll.",
    body:
      "Mitbringlisten entstehen aus Auftrag, Materialbedarf, Lagerbestand und manuellen Ergänzungen. Mitarbeiter und Vorarbeiter können abhaken, Material fehlt melden und Hinweise für Chef/Admin erzeugen. Die Liste ist bewusst einfach gehalten, damit sie morgens auf dem Handy funktioniert.",
    outcome: "Ergebnis: weniger vergessene Rollen, Latten, Schrauben oder Werkzeuge."
  },
  {
    title: "Bautagesberichte",
    lead: "Tagesberichte verbinden Wetter, Zeiten, Tätigkeiten, Material, Fotos und Besonderheiten.",
    body:
      "Vorarbeiter und Mitarbeiter können Berichte per Text, Sprache und Foto vorbereiten. Chef/Admin kann prüfen und freigeben. Damit entstehen bessere Nachweise für Kunden, interne Rückfragen und spätere Abrechnung.",
    outcome: "Ergebnis: Nachweise entstehen während der Arbeit, nicht erst Tage später."
  },
  {
    title: "Fotos",
    lead: "Fotos werden direkt an Auftrag, Baustelle oder Bericht gehängt.",
    body:
      "Auf der Baustelle öffnet der Foto-Flow direkt die Kamera. Bilder können Mängel, Fortschritt, Abnahmen und Materialverbrauch dokumentieren. Freigaben steuern, welche Fotos später im Kundenportal sichtbar sind.",
    outcome: "Ergebnis: Fotos verschwinden nicht mehr in privaten Chats."
  },
  {
    title: "Dokumente",
    lead: "Arbeitsaufträge, Berichte, PDFs und Nachweise werden zentral abgelegt.",
    body:
      "BauPro bereitet PDF-Exporte, digitale Unterschriften und dokumentenbezogene Status vor. Dokumente sollen nachvollziehbar mit Kunde, Auftrag oder Baustelle verbunden sein, ohne interne Notizen unkontrolliert nach außen zu geben.",
    outcome: "Ergebnis: bessere Ablage und professionellerer Kundeneindruck."
  },
  {
    title: "Kundenportal",
    lead: "Kunden erhalten Einblick in freigegebene Informationen ihrer eigenen Baustelle.",
    body:
      "Das Portal kann Status, Fortschritt, freigegebene Fotos, Dokumente, Termine, Ansprechpartner und Fragen anzeigen. Kunden sehen keine internen Notizen, keine Lagerdaten und keine EK/VK-Preise. Links und Zugriffe sind bewusst getrennt von internen Mitarbeiteransichten.",
    outcome: "Ergebnis: Kunden fühlen sich informiert, ohne dass das Büro ständig Updates schreiben muss."
  },
  {
    title: "Rollen",
    lead: "Nicht jeder Nutzer braucht dieselbe Software.",
    body:
      "Chef/Admin steuert Betrieb, Preise, Team, Einstellungen und Auswertungen. Vorarbeiter organisiert Baustellen und Berichte ohne sensible Preise. Mitarbeiter sehen eigene Aufgaben, Zeiten, Mitbringlisten und Berichte. Kunden sehen nur freigegebene Portal-Daten.",
    outcome: "Ergebnis: weniger Überforderung und weniger Risiko durch falsche Einsicht."
  },
  {
    title: "KI",
    lead: "KI hilft beim Formulieren und Strukturieren, trifft aber keine endgültigen Entscheidungen.",
    body:
      "BauPro nutzt KI optional für Berichtsentwürfe, Sprache-zu-Struktur, Materialvorschläge und Zusammenfassungen. Ergebnisse werden als Entwurf gekennzeichnet. Nutzer müssen prüfen, anpassen und bestätigen, bevor Daten weiterverwendet werden.",
    outcome: "Ergebnis: weniger Schreibarbeit, aber fachliche Kontrolle bleibt beim Betrieb."
  },
  {
    title: "Teamverwaltung",
    lead: "Mitarbeiter, Vorarbeiter und Chefrollen werden zentral verwaltet.",
    body:
      "Neue Mitarbeiter können eingeladen oder angelegt werden. Rechte und Rollen bestimmen, welche Navigation, Daten und Aktionen sichtbar sind. Kritische Änderungen wie Rollen- oder Rechtewechsel können auditierbar protokolliert werden.",
    outcome: "Ergebnis: klare Zuständigkeiten statt gemeinsamer Sammelzugänge."
  },
  {
    title: "Fahrzeuge",
    lead: "Fahrzeuge, Anhänger, Maschinen und Werkzeugstandorte werden mit Baustellen und Lagerorten verbunden.",
    body:
      "Ein Betrieb sieht, welches Fahrzeug verfügbar ist, wo Material liegt und welche Prüftermine oder Notizen relevant sind. Das ist besonders nützlich, wenn Material und Werkzeug nicht nur im Hauptlager, sondern auf mehreren Fahrzeugen verteilt sind.",
    outcome: "Ergebnis: bessere Planung von Team, Fahrzeug und Material für den nächsten Tag."
  },
  {
    title: "Datenschutz",
    lead: "BauPro ist auf Firmen-Trennung, Rollenrechte und transparente Verarbeitung vorbereitet.",
    body:
      "Technisch sind Mandantentrennung, Row Level Security, sichere Uploads, Audit-Logs, Datenschutzseiten und Exporte vorbereitet. Die rechtliche Finalisierung bleibt Sache des Betreibers und sollte vor Produktivbetrieb geprüft werden.",
    outcome: "Ergebnis: ein solides technisches Fundament ohne übertriebene Sicherheitsversprechen."
  }
];

export const marketingBenefits = [
  "Weniger Papierkram im Büro",
  "Schnellere Planung für morgen",
  "Bessere Übersicht über laufende Baustellen",
  "Saubere Nachweise mit Fotos, Wetter und Bericht",
  "Mobil auf der Baustelle nutzbar",
  "Chef sieht Preise und Überblick, Mitarbeiter nur das Nötige",
  "Kunden bekommen professionelle Updates statt einzelner Chat-Nachrichten",
  "Materialwarnungen werden früher sichtbar"
];

export const marketingWorkflow = [
  "Anfrage",
  "Auftrag",
  "Baustelle",
  "Zeiten",
  "Material",
  "Bericht",
  "Kunde informiert"
];

export const marketingUseCases: MarketingUseCase[] = [
  {
    title: "Dachdeckerbetriebe",
    description:
      "Für Betriebe, die Aufmaß, Material, Wetter, Fotos, Tagesberichte und Teamplanung zuverlässig zusammenführen müssen.",
    points: ["Aufmaß und Materialbedarf", "Bautagesberichte mit Fotos", "Mitbringlisten für morgen"]
  },
  {
    title: "Zimmereien",
    description:
      "Für Teams, die mobile Zeiten, Baustellenstatus, Fahrzeuge und Dokumentation ohne Zettelwirtschaft brauchen.",
    points: ["Teamplanung", "Zeiten je Auftrag", "Nachweise für Kunden"]
  },
  {
    title: "Klempner/Spengler",
    description:
      "Für Betriebe mit viel Kleinmaterial, Fahrzeuglager, Baustellendokumenten und wiederkehrenden Kundenfreigaben.",
    points: ["Fahrzeug- und Lagerorte", "Materialmeldungen", "Fotos und Mängel"]
  },
  {
    title: "Kleine und mittlere Handwerksbetriebe",
    description:
      "Für Chefs, die keine monatelange ERP-Einführung wollen, sondern schnelle, klare Abläufe fürs Tagesgeschäft.",
    points: ["Mobile First", "Rollenrechte", "Schnelle Demo-Daten"]
  }
];

export const marketingSecurityNotes = [
  {
    title: "Rollen statt Einheitszugang",
    text: "Chef/Admin, Vorarbeiter, Mitarbeiter und Kunden sehen unterschiedliche Oberflächen, Aktionen und Daten."
  },
  {
    title: "Mandantentrennung",
    text: "Supabase Row Level Security ist auf Firmenebene vorbereitet, damit Betriebe nur ihre eigenen Daten sehen."
  },
  {
    title: "Preisbereiche geschützt",
    text: "EK, VK, Aufschläge, Margen und Preisvergleichsdaten sind nicht für Mitarbeiter- und Kundenansichten vorgesehen."
  },
  {
    title: "Kundenportal begrenzt",
    text: "Kunden sehen nur freigegebene Baustelleninhalte. Interne Notizen, Lager, Teamdaten und Einkaufspreise bleiben intern."
  },
  {
    title: "Upload- und Dokumentenschutz",
    text: "Fotos und Dokumente werden serverseitig validiert und sollen nur berechtigten Nutzern oder freigegebenen Portalen zugänglich sein."
  },
  {
    title: "Auditierbare Änderungen",
    text: "Kritische Aktionen wie Rollenänderungen, Preisänderungen, Exporte oder Lagerkorrekturen können nachvollziehbar protokolliert werden."
  },
  {
    title: "Backups und Wiederherstellung",
    text: "Für produktive Nutzung sollte Supabase-Backup, Point-in-Time-Recovery und ein getesteter Wiederherstellungsplan eingerichtet werden."
  },
  {
    title: "DSGVO-orientierte Prozesse",
    text: "Datenschutzseiten, Auskunftsexport, Rollenrechte und Audit-Logs sind technisch vorbereitet. Rechtliche Prüfung bleibt erforderlich."
  }
];

export const marketingPlans: MarketingPlan[] = [
  {
    name: "Starter",
    price: "29,99 €",
    priceNote: "pro Monat · Beispieltarif",
    description: "Für kleine Betriebe, die Baustellen, Zeiten, Material und Berichte sauber digitalisieren möchten.",
    features: [
      "bis 5 Mitarbeiter",
      "Aufträge und Baustellen",
      "Zeiterfassung",
      "Bautagesberichte",
      "Material und Lager",
      "Kundenverwaltung"
    ]
  },
  {
    name: "Professional",
    price: "49,99 €",
    priceNote: "pro Monat · Beispieltarif",
    description: "Für wachsende Dachdeckerbetriebe mit Teamorganisation, Kundenportal und mehr Automatisierung.",
    features: [
      "bis 10 Mitarbeiter",
      "alles aus Starter",
      "Kundenportal",
      "Fahrzeuge",
      "Mitbringlisten",
      "erweiterte Berichte",
      "KI-Funktionen"
    ],
    highlighted: true
  },
  {
    name: "Business",
    price: "79,99 €",
    priceNote: "pro Monat · Beispieltarif",
    description: "Für größere Betriebe, mehrere Teams und umfangreichere digitale Abläufe.",
    features: [
      "ab 10 Mitarbeitern",
      "unbegrenzte Mitarbeiter",
      "alle Funktionen",
      "Prioritäts-Support",
      "zukünftige Premium-Module"
    ]
  }
];

export const marketingPricingComparison: MarketingComparisonRow[] = [
  { label: "Mitarbeiter", starter: "bis 5", professional: "bis 10", business: "unbegrenzt" },
  { label: "Aufträge & Baustellen", starter: "enthalten", professional: "enthalten", business: "enthalten" },
  { label: "Zeiten & Berichte", starter: "Basis", professional: "erweitert", business: "erweitert" },
  { label: "Material & Lager", starter: "enthalten", professional: "enthalten", business: "enthalten" },
  { label: "Kundenportal", starter: "nicht enthalten", professional: "enthalten", business: "enthalten" },
  { label: "Fahrzeuge & Mitbringlisten", starter: "Basis", professional: "enthalten", business: "enthalten" },
  { label: "KI-Funktionen", starter: "nicht enthalten", professional: "enthalten", business: "enthalten" },
  { label: "Support", starter: "Standard", professional: "Standard", business: "Priorität" }
];

export const marketingFaq = [
  {
    question: "Was ist BauPro?",
    answer:
      "BauPro ist eine Web-App für Dachdecker- und Handwerksbetriebe, die Aufträge, Baustellen, Zeiten, Material, Berichte, Fotos und Kundenkommunikation zusammenführt."
  },
  {
    question: "Für welche Betriebe ist BauPro geeignet?",
    answer:
      "Der Schwerpunkt liegt auf Dachdeckern. Viele Abläufe passen auch für Zimmereien, Klempner/Spengler und kleine bis mittlere Handwerksbetriebe mit Baustellen, Teams und Material."
  },
  {
    question: "Funktioniert BauPro auf dem Handy?",
    answer:
      "Ja. BauPro ist mobile-first aufgebaut: große Buttons, klare Formulare, Foto-Upload, Zeiterfassung und Mitbringlisten sind auf Baustellen-Nutzung ausgelegt."
  },
  {
    question: "Gibt es eine App im App Store?",
    answer:
      "BauPro läuft als Web-App im Browser und kann als PWA auf iPhone und Android zum Home-Bildschirm hinzugefügt werden. Eine klassische Store-App ist dafür nicht zwingend nötig."
  },
  {
    question: "Können Mitarbeiter EK- oder VK-Preise sehen?",
    answer:
      "Nein. Preisbereiche wie EK, VK, Marge, Aufschlag und Online-Preisvergleich sind für Chef/Admin vorgesehen und werden in Mitarbeiteransichten nicht angezeigt."
  },
  {
    question: "Was sieht ein Vorarbeiter?",
    answer:
      "Vorarbeiter sehen operative Baustellendaten, Teamaufgaben, Mitbringlisten und Berichte, aber keine sensiblen Chefbereiche wie Einkaufspreise, Margen, Billing oder Firmen-Einstellungen."
  },
  {
    question: "Wie funktioniert das Kundenportal?",
    answer:
      "Kunden erhalten Zugriff auf freigegebene Informationen ihrer eigenen Baustelle: Status, Termine, Fotos, Dokumente oder Arbeitsaufträge. Interne Notizen und Preise bleiben verborgen."
  },
  {
    question: "Ist KI Pflicht?",
    answer:
      "Nein. KI-Funktionen sind optional. Sie helfen bei Berichtsentwürfen, Spracheingaben oder Materialvorschlägen, ersetzen aber keine fachliche Prüfung."
  },
  {
    question: "Kann ich Daten exportieren?",
    answer:
      "BauPro bereitet Exporte für Stundenzettel, CSV, PDFs, Datenschutz-Auskunft und Berichte vor. Welche Exporte produktiv genutzt werden, hängt vom aktivierten Modul ab."
  },
  {
    question: "Wie viele Mitarbeiter sind möglich?",
    answer:
      "Die Beispieltarife sehen Starter bis 5 Mitarbeiter, Professional bis 10 Mitarbeiter und Business mit unbegrenzten Mitarbeitern vor."
  },
  {
    question: "Was kostet BauPro?",
    answer:
      "Die öffentlichen Preise sind Beispieltarife: Starter 29,99 €, Professional 49,99 € und Business 79,99 € pro Monat. Billing muss vor Produktivverkauf final konfiguriert werden."
  },
  {
    question: "Kann ich BauPro erst testen?",
    answer:
      "Ja. Die Demo-Firma zeigt typische Baustellen, Team, Material, Zeiten, Berichte, Kundenportal und KI-Hilfen mit reinen Beispieldaten."
  },
  {
    question: "Braucht mein Team eine Schulung?",
    answer:
      "BauPro ist so gedacht, dass Mitarbeiter Kernfunktionen wie Zeit erfassen, Bericht schreiben oder Material melden schnell verstehen. Für Chef/Admin kann eine kurze Einführung sinnvoll sein."
  },
  {
    question: "Kann BauPro WhatsApp ersetzen?",
    answer:
      "Nicht komplett. Aber BauPro soll verhindern, dass wichtige Fotos, Zeiten, Materialmeldungen und Baustelleninfos nur noch in Chats liegen und später schwer auffindbar sind."
  },
  {
    question: "Kann ich Fotos direkt auf der Baustelle aufnehmen?",
    answer:
      "Ja. Foto-Uploads sind mobile-first ausgelegt und können die Kamera öffnen. Bilder werden passend zu Bericht, Auftrag oder Baustelle abgelegt."
  },
  {
    question: "Wie wird Material geplant?",
    answer:
      "Material kann im Lager geführt, einer Baustelle zugeordnet, als Mitbringliste vorbereitet und bei Knappheit als Warnung sichtbar gemacht werden."
  },
  {
    question: "Sind Angebote und Rechnungen enthalten?",
    answer:
      "Angebote und Rechnungen sind als Produktbereich vorbereitet. Kunden-PDFs sollen keine internen Einkaufspreise oder Margen anzeigen."
  },
  {
    question: "Wo werden die Daten gespeichert?",
    answer:
      "BauPro nutzt Supabase als Backend für Auth, Datenbank und Storage. Für produktive Nutzung müssen Region, Verträge, Backups und Datenschutz final passend eingerichtet werden."
  },
  {
    question: "Ist BauPro DSGVO-konform?",
    answer:
      "BauPro ist DSGVO-orientiert vorbereitet, macht aber keine pauschale 100%-Sicherheits- oder Rechtsaussage. Betreibertexte, AVV, Löschfristen und Prozesse müssen final geprüft werden."
  },
  {
    question: "Kann ich später weitere Module nutzen?",
    answer:
      "Ja. BauPro ist als SaaS-Plattform gedacht. Zusätzliche Premium-Module wie erweiterte Kalkulation, Automatisierung oder Integrationen können schrittweise ergänzt werden."
  }
];
