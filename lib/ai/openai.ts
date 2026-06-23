import type { StructuredAiResult } from "@/lib/ai/types";
import { logServerError } from "@/lib/security/logging";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1-mini";

type ResponseUsage = {
  input_tokens?: number;
  output_tokens?: number;
};

type ResponseContent = {
  type?: string;
  text?: string;
};

type ResponseOutput = {
  content?: ResponseContent[];
};

type ResponsePayload = {
  output_text?: string;
  output?: ResponseOutput[];
  usage?: ResponseUsage;
  error?: {
    message?: string;
  };
};

type OpenAiInputContent =
  | {
      type: "input_text";
      text: string;
    }
  | {
      type: "input_image";
      image_url: string;
      detail: "low" | "high" | "auto";
    };

export function getOpenAiModel() {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

export function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function extractOutputText(payload: ResponsePayload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  const texts =
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => Boolean(text?.trim())) ?? [];

  return texts.join("\n").trim();
}

function parseJsonOutput<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

export async function createStructuredAiResponse<T>({
  feature,
  system,
  user,
  schema,
  schemaName,
  imageUrls = [],
  maxOutputTokens = 1200
}: {
  feature: string;
  system: string;
  user: string;
  schema: object;
  schemaName: string;
  imageUrls?: string[];
  maxOutputTokens?: number;
}): Promise<StructuredAiResult<T>> {
  const model = getOpenAiModel();
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return {
      ok: false,
      disabled: true,
      model,
      message: "KI-Funktionen sind noch nicht konfiguriert."
    };
  }

  try {
    const userContent: string | OpenAiInputContent[] =
      imageUrls.length > 0
        ? [
            { type: "input_text", text: user },
            ...imageUrls.slice(0, 4).map((imageUrl) => ({
              type: "input_image" as const,
              image_url: imageUrl,
              detail: "low" as const
            }))
          ]
        : user;

    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "developer", content: system },
          { role: "user", content: userContent }
        ],
        text: {
          format: {
            type: "json_schema",
            name: schemaName,
            strict: true,
            schema
          }
        },
        max_output_tokens: maxOutputTokens,
        metadata: {
          app: "baupro",
          feature
        }
      })
    });

    const payload = (await response.json().catch(() => ({}))) as ResponsePayload;
    const inputTokens = payload.usage?.input_tokens ?? null;
    const outputTokens = payload.usage?.output_tokens ?? null;

    if (!response.ok) {
      console.error("openai-response-failed", {
        status: response.status,
        feature,
        model
      });

      const message =
        response.status === 401 || response.status === 403
          ? "OpenAI-Zugang wurde abgelehnt. Bitte serverseitigen OPENAI_API_KEY pruefen."
          : response.status === 429
            ? "OpenAI-Limit erreicht. Bitte spaeter erneut versuchen oder OpenAI-Abrechnung pruefen."
            : "KI-Anfrage konnte nicht verarbeitet werden. Bitte spaeter erneut versuchen.";

      return {
        ok: false,
        disabled: false,
        model,
        inputTokens,
        outputTokens,
        message
      };
    }

    const outputText = extractOutputText(payload);
    const data = parseJsonOutput<T>(outputText);

    if (!data) {
      return {
        ok: false,
        disabled: false,
        model,
        inputTokens,
        outputTokens,
        message: "KI-Antwort konnte nicht als JSON gelesen werden."
      };
    }

    return {
      ok: true,
      data,
      model,
      inputTokens,
      outputTokens
    };
  } catch (error) {
    logServerError("openai-structured-response-failed", error, { feature, model });
    return {
      ok: false,
      disabled: false,
      model,
      message: "OpenAI-Anfrage konnte nicht ausgefuehrt werden."
    };
  }
}
