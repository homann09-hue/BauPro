import { describe, expect, it } from "vitest";
import { buildConsentState, CONSENT_VERSION, defaultConsentState, parseConsentState } from "@/lib/compliance/consent";

describe("consent state", () => {
  it("defaults optional processing to opt-in false", () => {
    const state = defaultConsentState(new Date("2026-06-15T10:00:00.000Z"));
    expect(state).toEqual({
      version: CONSENT_VERSION,
      essential: true,
      analytics: false,
      marketing: false,
      decidedAt: "2026-06-15T10:00:00.000Z"
    });
  });

  it("parses only the current consent version", () => {
    const state = buildConsentState({ analytics: true, marketing: false, now: new Date("2026-06-15T10:00:00.000Z") });
    expect(parseConsentState(JSON.stringify(state))).toMatchObject({ analytics: true, marketing: false });
    expect(parseConsentState(JSON.stringify({ ...state, version: "old" }))).toBeNull();
    expect(parseConsentState("not json")).toBeNull();
  });
});
