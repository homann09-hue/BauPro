import type { Role } from "@/types/app";

export const BUSINESS_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: {
      type: "string",
      enum: [
        "customer_note",
        "new_task",
        "time_entry",
        "bring_list",
        "material_request",
        "job_note",
        "report_entry",
        "appointment",
        "unknown"
      ]
    },
    confidence: { type: "number" },
    customer_name: { type: ["string", "null"] },
    job_name: { type: ["string", "null"] },
    date: { type: ["string", "null"] },
    time_start: { type: ["string", "null"] },
    time_end: { type: ["string", "null"] },
    break_minutes: { type: ["number", "null"] },
    materials: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
          notes: { type: "string" }
        },
        required: ["name", "quantity", "unit", "notes"]
      }
    },
    tools: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
          notes: { type: "string" }
        },
        required: ["name", "quantity", "unit", "notes"]
      }
    },
    notes: { type: "string" },
    follow_up_questions: { type: "array", items: { type: "string" } }
  },
  required: [
    "intent",
    "confidence",
    "customer_name",
    "job_name",
    "date",
    "time_start",
    "time_end",
    "break_minutes",
    "materials",
    "tools",
    "notes",
    "follow_up_questions"
  ]
} as const;

export const DAILY_REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    activities: { type: "string" },
    material_usage: { type: "string" },
    issues: { type: "string" },
    weather: { type: ["string", "null"] },
    summary: { type: "string" },
    follow_up_questions: { type: "array", items: { type: "string" } }
  },
  required: ["activities", "material_usage", "issues", "weather", "summary", "follow_up_questions"]
} as const;

export const ASSISTANT_ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
    suggested_action: {
      type: "string",
      enum: ["none", "create_time_entry", "create_bring_list", "create_task", "create_report_draft", "create_material_request"]
    },
    action_draft: { type: "string" },
    needs_confirmation: { type: "boolean" },
    follow_up_questions: { type: "array", items: { type: "string" } }
  },
  required: ["answer", "warnings", "suggested_action", "action_draft", "needs_confirmation", "follow_up_questions"]
} as const;

export const MATERIAL_MATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    original_name: { type: "string" },
    normalized_name: { type: "string" },
    unit: { type: "string" },
    confidence: { type: "number" },
    explanation: { type: "string" },
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          catalog_id: { type: ["string", "null"] },
          name: { type: "string" },
          unit: { type: "string" },
          reason: { type: "string" }
        },
        required: ["catalog_id", "name", "unit", "reason"]
      }
    }
  },
  required: ["original_name", "normalized_name", "unit", "confidence", "explanation", "candidates"]
} as const;

export const AI_JOB_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    customer_name: { type: ["string", "null"] },
    existing_customer_id: { type: ["string", "null"] },
    title: { type: "string" },
    order_type: {
      type: "string",
      enum: ["steildach", "flachdach", "reparatur", "dachrinne", "blech", "wartung", "sonstiges"]
    },
    priority: { type: "string", enum: ["niedrig", "normal", "hoch"] },
    jobsite_name: { type: ["string", "null"] },
    jobsite_address: { type: ["string", "null"] },
    start_date: { type: ["string", "null"] },
    end_date: { type: ["string", "null"] },
    timeframe_text: { type: ["string", "null"] },
    description: { type: "string" },
    internal_notes: { type: "string" },
    customer_friendly_description: { type: "string" },
    internal_work_instructions: { type: "string" },
    dimensions: {
      type: "object",
      additionalProperties: false,
      properties: {
        length_m: { type: ["number", "null"] },
        width_m: { type: ["number", "null"] },
        area_m2: { type: ["number", "null"] },
        roof_pitch: { type: ["number", "null"] },
        eaves_length_m: { type: ["number", "null"] },
        ridge_length_m: { type: ["number", "null"] },
        verge_length_m: { type: ["number", "null"] },
        valley_length_m: { type: ["number", "null"] },
        wall_connection_length_m: { type: ["number", "null"] },
        building_height_m: { type: ["number", "null"] },
        downpipe_length_m: { type: ["number", "null"] },
        roof_windows_count: { type: "number" },
        penetrations_count: { type: "number" },
        roof_drains_count: { type: "number" },
        emergency_overflows_count: { type: "number" }
      },
      required: [
        "length_m",
        "width_m",
        "area_m2",
        "roof_pitch",
        "eaves_length_m",
        "ridge_length_m",
        "verge_length_m",
        "valley_length_m",
        "wall_connection_length_m",
        "building_height_m",
        "downpipe_length_m",
        "roof_windows_count",
        "penetrations_count",
        "roof_drains_count",
        "emergency_overflows_count"
      ]
    },
    material_system: { type: ["string", "null"] },
    suggested_materials: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
          notes: { type: "string" }
        },
        required: ["name", "quantity", "unit", "notes"]
      }
    },
    labor_hours_estimated: { type: ["number", "null"] },
    missing_fields: { type: "array", items: { type: "string" } },
    follow_up_questions: { type: "array", items: { type: "string" } },
    confidence: { type: "number" }
  },
  required: [
    "customer_name",
    "existing_customer_id",
    "title",
    "order_type",
    "priority",
    "jobsite_name",
    "jobsite_address",
    "start_date",
    "end_date",
    "timeframe_text",
    "description",
    "internal_notes",
    "customer_friendly_description",
    "internal_work_instructions",
    "dimensions",
    "material_system",
    "suggested_materials",
    "labor_hours_estimated",
    "missing_fields",
    "follow_up_questions",
    "confidence"
  ]
} as const;

export function roleAwareSystemPrompt(role: Role, canManage: boolean) {
  return [
    "Du bist BauPro KI, ein produktiver Assistent fuer deutsche Dachdecker- und Handwerksbetriebe.",
    "Antworte immer auf Deutsch, knapp, praktisch und mit klaren naechsten Schritten.",
    "Speichere oder versende niemals Daten selbst. Du lieferst nur Vorschlaege, die ein Nutzer bestaetigen muss.",
    "Wenn Angaben fehlen oder unsicher sind, stelle Rueckfragen statt Annahmen als Tatsache auszugeben.",
    canManage
      ? "Der Nutzer ist Chef/Admin. Preis- und Kalkulationsdaten duerfen verwendet werden, wenn sie im Kontext enthalten sind."
      : "Der Nutzer ist Mitarbeiter. Gib niemals EK, VK, Marge, Aufschlag, Gewinn, Angebotssummen oder Preisvergleichsdaten aus.",
    `Aktuelle Rolle: ${role}.`
  ].join("\n");
}

export function businessInputPrompt(contextJson: string) {
  return [
    "Analysiere den folgenden Spracheingabe- oder Freitext fuer eine Dachdecker-App.",
    "Ordne ihn genau einem Intent zu und extrahiere Felder als JSON.",
    "Datumsangaben muessen ISO-Format YYYY-MM-DD haben, falls erkennbar.",
    "Zeiten muessen HH:MM sein, falls erkennbar.",
    "Wenn confidence < 0.7, muss follow_up_questions mindestens eine Rueckfrage enthalten.",
    "Kontext aus der App, nur zur Zuordnung:",
    contextJson
  ].join("\n");
}

export function dailyReportPrompt(contextJson: string) {
  return [
    "Erstelle aus Stichpunkten oder Sprache einen sauberen Tagesbericht fuer einen Dachdeckerbetrieb.",
    "Strukturiere Taetigkeiten, Materialverbrauch und Probleme/Besonderheiten.",
    "Erfinde keine Fakten. Wenn Informationen fehlen, schreibe sie in follow_up_questions.",
    "Kontext aus der App:",
    contextJson
  ].join("\n");
}

export function assistantPrompt(contextJson: string) {
  return [
    "Beantworte Fragen zur BauPro-App mit den bereitgestellten echten Betriebsdaten.",
    "Wenn der Nutzer eine Aktion wuenscht, gib nur einen Entwurf und setze needs_confirmation=true.",
    "Keine Rechtsberatung, keine finalen Angebote/Rechnungen, keine automatische Speicherung.",
    "Nutze ausschliesslich den Kontext. Wenn etwas nicht im Kontext steht, sage das klar.",
    "Rollenbereinigter App-Kontext:",
    contextJson
  ].join("\n");
}

export function materialMatchPrompt(contextJson: string) {
  return [
    "Normalisiere einen diktierten Dachdecker-Materialnamen und ordne ihn moeglichen Katalogartikeln zu.",
    "Keine Fantasieprodukte. Nutze typische deutsche Dachdecker-Begriffe.",
    "Wenn keine sichere Zuordnung moeglich ist, confidence niedrig setzen und erklaeren.",
    "Katalog-/Lagerkontext:",
    contextJson
  ].join("\n");
}

export function jobDraftPrompt(contextJson: string) {
  return [
    "Extrahiere aus Sprache oder Text einen vollstaendigen Auftragsentwurf fuer einen deutschen Dachdeckerbetrieb.",
    "Du bereitest nur vor. Du darfst keine Daten speichern und keine finale Kalkulation behaupten.",
    "Ordne vorhandene Kunden ueber Namen zu, wenn der Kontext einen plausiblen Treffer enthaelt. Setze sonst existing_customer_id=null.",
    "Datumsangaben als YYYY-MM-DD, falls erkennbar. Relative Begriffe wie naechste Woche aus dem Kontextdatum ableiten, wenn moeglich.",
    "Maße in Meter und Quadratmeter. Wenn Laenge und Breite vorhanden sind, area_m2 berechnen.",
    "order_type muss einer App-Kategorie entsprechen: steildach, flachdach, reparatur, dachrinne, blech, wartung, sonstiges.",
    "Wichtige fehlende Angaben in missing_fields und als konkrete follow_up_questions aufnehmen.",
    "suggested_materials sind nur fachliche Vorschlaege; Mengen werden danach regelbasiert von der App berechnet.",
    "Kontext aus der App:",
    contextJson
  ].join("\n");
}
