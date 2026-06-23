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
  description: string;
  features: string[];
  highlighted?: boolean;
};

export const marketingFeatures: MarketingFeature[] = [
  {
    title: "Aufträge & Baustellen",
    description: "Kunden, Aufträge, Adressen, Status, Maße und nächste Schritte sauber an einem Ort.",
    icon: "briefcase"
  },
  {
    title: "Zeiterfassung",
    description: "Mitarbeiter erfassen Zeiten mobil; Chef/Admin prüft Tagesstunden und Stundenzettel.",
    icon: "clock"
  },
  {
    title: "Material & Lager",
    description: "Bestände, Mindestmengen, Lagerorte, Fahrzeuge und Materialwarnungen bleiben übersichtlich.",
    icon: "package"
  },
  {
    title: "Bautagesberichte",
    description: "Tätigkeiten, Wetter, Zeiten, Material, Fotos und Besonderheiten werden nachvollziehbar dokumentiert.",
    icon: "report"
  },
  {
    title: "Kundenportal",
    description: "Kunden sehen freigegebene Baustelleninfos, Dokumente und Fotos ohne interne Firmendaten.",
    icon: "portal"
  },
  {
    title: "Fotos & Dokumente",
    description: "Baustellenfotos, Arbeitsaufträge und Nachweise sind passend zu Auftrag oder Bericht verknüpft.",
    icon: "camera"
  },
  {
    title: "KI-Unterstützung",
    description: "Optional für Strukturierung, Berichtsentwürfe und Materialvorschläge. Der Nutzer entscheidet.",
    icon: "bot"
  },
  {
    title: "Mitarbeiter & Rollen",
    description: "Chef/Admin, Vorarbeiter, Mitarbeiter und Kunde bekommen jeweils passende Ansichten und Rechte.",
    icon: "users"
  },
  {
    title: "Angebote/Rechnungen",
    description: "Belege mit Positionen, Summen und PDF-Export sind vorbereitet und in die Auftragsstrecke eingebunden.",
    icon: "receipt"
  }
];

export const marketingBenefits = [
  "Weniger Papierkram im Büro",
  "Schnellere Planung für morgen",
  "Bessere Übersicht über laufende Baustellen",
  "Saubere Nachweise mit Fotos, Wetter und Bericht",
  "Mobil auf der Baustelle nutzbar",
  "Chef sieht Preise und Überblick, Mitarbeiter nur das Nötige"
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
    description: "Für Betriebe, die Baustellen, Material, Fotos, Wetter und Tagesberichte im Alltag zusammenführen müssen.",
    points: ["Aufmaß und Materialbedarf", "Bautagesberichte mit Fotos", "Mitbringlisten für morgen"]
  },
  {
    title: "Zimmereien",
    description: "Für Teams, die mobile Zeiten, Baustellenstatus und Dokumentation ohne Zettelwirtschaft brauchen.",
    points: ["Teamplanung", "Zeiten je Auftrag", "Nachweise für Kunden"]
  },
  {
    title: "Klempner/Spengler",
    description: "Für Betriebe mit viel Material, Fahrzeuglager und wiederkehrenden Baustellendokumenten.",
    points: ["Fahrzeug- und Lagerorte", "Materialmeldungen", "Fotos und Mängel"]
  },
  {
    title: "Kleine und mittlere Handwerksbetriebe",
    description: "Für Chefs, die keine komplizierte ERP-Schulung wollen, sondern klare Abläufe fürs Tagesgeschäft.",
    points: ["Mobile First", "Rollenrechte", "Schnelle Demo-Daten"]
  }
];

export const marketingSecurityNotes = [
  {
    title: "Rollen statt Einheitszugang",
    text: "Chef/Admin, Vorarbeiter, Mitarbeiter und Kunden sehen unterschiedliche Oberflächen und Daten."
  },
  {
    title: "Mandantentrennung",
    text: "Supabase Row Level Security ist auf Firmenebene vorbereitet, damit Betriebe ihre eigenen Daten getrennt sehen."
  },
  {
    title: "Preisbereiche geschützt",
    text: "EK, VK, Aufschläge, Margen und Preisvergleichsdaten sind für Mitarbeiter nicht vorgesehen."
  },
  {
    title: "DSGVO-orientierte Prozesse",
    text: "Datenschutzseiten, Auskunftsexport, Rollenrechte und Audit-Logs sind technisch vorbereitet. Rechtliche Prüfung bleibt erforderlich."
  }
];

export const marketingPlans: MarketingPlan[] = [
  {
    name: "Starter",
    price: "Tarif in Vorbereitung",
    description: "Für kleine Teams, die BauPro mit echten Abläufen testen wollen.",
    features: ["1 Firma", "Basis-Aufträge", "Zeiten", "Berichte", "Demo-Daten"]
  },
  {
    name: "Professional",
    price: "Für Betriebe geplant",
    description: "Für Dachdeckerbetriebe mit Team, Lager, Rollen und Kundenkommunikation.",
    features: ["Teamrollen", "Material & Lager", "Mitbringlisten", "Kundenportal", "PDF-Exporte"],
    highlighted: true
  },
  {
    name: "Business",
    price: "Auf Anfrage",
    description: "Für größere Betriebe mit mehreren Teams, erweiterten Abläufen und mehr Automatisierung.",
    features: ["Mehrere Teams", "Erweiterte Rechte", "KI-Kontingente", "Preisquellen", "Priorisierte Einführung"]
  }
];

export const marketingFaq = [
  {
    question: "Was ist BauPro?",
    answer: "BauPro ist eine Web-App für Dachdecker- und Handwerksbetriebe, die Aufträge, Baustellen, Zeiten, Material, Berichte und Kundenkommunikation zusammenführt."
  },
  {
    question: "Für welche Betriebe ist es geeignet?",
    answer: "Der erste Fokus liegt auf Dachdeckerbetrieben. Viele Abläufe passen auch für Zimmereien, Klempner/Spengler und kleine bis mittlere Handwerksbetriebe."
  },
  {
    question: "Funktioniert BauPro auf dem Handy?",
    answer: "Ja. BauPro ist mobile-first aufgebaut: große Buttons, einfache Formulare, Foto-Upload, Zeiterfassung und Spracheingabe sind auf Baustellen-Nutzung ausgelegt."
  },
  {
    question: "Können Mitarbeiter Preise sehen?",
    answer: "Nein, Preisbereiche wie EK, VK, Marge, Aufschlag und Preisvergleich sind für Chef/Admin vorgesehen und werden in Mitarbeiteransichten ausgeblendet."
  },
  {
    question: "Gibt es ein Kundenportal?",
    answer: "Ja. Kunden können freigegebene Baustelleninformationen, Fotos, Dokumente und Arbeitsaufträge sehen, ohne Zugriff auf interne Notizen oder Preise zu erhalten."
  },
  {
    question: "Brauche ich eine App-Installation?",
    answer: "Nein. BauPro läuft im Browser und kann als PWA auf iPhone und Android zum Home-Bildschirm hinzugefügt werden."
  },
  {
    question: "Ist KI Pflicht?",
    answer: "Nein. KI-Funktionen sind optional und sollen Vorschläge liefern. Kernfunktionen wie Aufträge, Zeiten, Material und Berichte funktionieren ohne KI."
  },
  {
    question: "Was kostet BauPro?",
    answer: "Tarife sind in Vorbereitung. Die öffentliche Preis-Seite zeigt die geplante Struktur und verweist auf Demo oder Registrierung."
  }
];
