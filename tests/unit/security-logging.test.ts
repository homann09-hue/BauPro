import { afterEach, describe, expect, it, vi } from "vitest";
import { logServerError, logServerWarning } from "@/lib/security/logging";

describe("server logging redaction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts known secrets and signed URL query tokens in error messages", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const signedUrl =
      "https://example.supabase.co/storage/v1/object/sign/reports/photo.jpg?token=raw-token-value&download=1";

    logServerWarning("signed-url-leak-check", new Error(`failed ${signedUrl} sk-proj-abcdefghijklmnopqrstuvwxyz`));

    const payload = JSON.stringify(warn.mock.calls[0]);
    expect(payload).toContain("[redacted]");
    expect(payload).not.toContain("raw-token-value");
    expect(payload).not.toContain("sk-proj-abcdefghijklmnopqrstuvwxyz");
  });

  it("redacts sensitive metadata values even when the value itself does not match a secret pattern", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logServerError("meta-redaction-check", "upload failed", {
      companyId: "company-1",
      signedUrl: "https://example.test/private/photo.jpg",
      signature_data_url: "data:image/jpeg;base64,abcdef123456",
      authorization: "plain-session-token",
      durationMs: 42
    });

    const [, payload] = error.mock.calls[0];
    expect(payload).toMatchObject({
      companyId: "company-1",
      signedUrl: "[redacted]",
      signature_data_url: "[redacted]",
      authorization: "[redacted]",
      durationMs: 42
    });
  });

  it("redacts image data URLs inside string metadata", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logServerWarning("data-url-redaction-check", "signature parse failed", {
      details: "payload=data:image/png;base64,AAABBBCCC"
    });

    const payload = JSON.stringify(warn.mock.calls[0]);
    expect(payload).toContain("[redacted]");
    expect(payload).not.toContain("AAABBBCCC");
  });
});
