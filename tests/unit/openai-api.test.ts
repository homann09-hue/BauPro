import { afterEach, describe, expect, it, vi } from "vitest";
import { createStructuredAiResponse, isOpenAiConfigured } from "@/lib/ai/openai";

const oldEnv = { ...process.env };
const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" }
  },
  required: ["answer"]
};

afterEach(() => {
  process.env = { ...oldEnv };
  vi.unstubAllGlobals();
});

describe("OpenAI backend adapter", () => {
  it("stays disabled without a server-side key", async () => {
    delete process.env.OPENAI_API_KEY;
    expect(isOpenAiConfigured()).toBe(false);

    const result = await createStructuredAiResponse<{ answer: string }>({
      feature: "test",
      system: "Du antwortest als JSON.",
      user: "Hallo",
      schema,
      schemaName: "test_schema"
    });

    expect(result.ok).toBe(false);
    expect(result.disabled).toBe(true);
  });

  it("uses the Responses API and parses structured JSON", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ output_text: "{\"answer\":\"ok\"}" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createStructuredAiResponse<{ answer: string }>({
      feature: "test",
      system: "Du antwortest als JSON.",
      user: "Hallo",
      schema,
      schemaName: "test_schema"
    });

    expect(result).toMatchObject({ ok: true, data: { answer: "ok" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/responses");
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({
      Authorization: "Bearer sk-test"
    });
  });
});
