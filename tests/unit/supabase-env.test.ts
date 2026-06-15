import { afterEach, describe, expect, it } from "vitest";
import { getSupabasePublishableKey } from "@/lib/supabase/env";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("Supabase environment", () => {
  it("accepts legacy anon keys and new publishable keys", () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "legacy-anon";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_new";
    expect(getSupabasePublishableKey()).toBe("legacy-anon");

    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(getSupabasePublishableKey()).toBe("sb_publishable_new");
  });
});
