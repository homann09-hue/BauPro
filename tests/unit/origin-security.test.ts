import { afterEach, describe, expect, it } from "vitest";
import { publicAppOrigin } from "@/lib/security/origin";

const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const previousNodeEnv = process.env.NODE_ENV;

describe("public app origin security", () => {
  afterEach(() => {
    if (previousAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
    }
    process.env.NODE_ENV = previousNodeEnv;
  });

  it("prefers the configured public app URL over request headers", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://baupro.example/app";
    expect(publicAppOrigin("https://evil.example")).toBe("https://baupro.example");
  });

  it("accepts localhost request origins for local development", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.NODE_ENV = "development";
    expect(publicAppOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("rejects untrusted production request origins when no public URL is configured", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.NODE_ENV = "production";
    expect(publicAppOrigin("https://evil.example")).toBe("http://localhost:3000");
  });
});
