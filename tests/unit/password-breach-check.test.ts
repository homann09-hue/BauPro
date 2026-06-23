import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkPasswordBreach } from "@/lib/security/password-breach-check";

function sha1Parts(password: string) {
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  return {
    prefix: hash.slice(0, 5),
    suffix: hash.slice(5)
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("checkPasswordBreach", () => {
  it("erkennt ein bekanntes kompromittiertes Passwort", async () => {
    const { prefix, suffix } = sha1Parts("password123");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(`${suffix}:123456\nABCDE:1`));

    await expect(checkPasswordBreach("password123")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      expect.objectContaining({
        cache: "no-store"
      })
    );
  });

  it("gibt false fuer ein nicht gelistetes sicheres Passwort zurueck", async () => {
    const { suffix } = sha1Parts("Sicheres-Passwort-2026!BauPro");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(`00000000000000000000000000000000000:1\n${suffix.slice(1)}:2`));

    await expect(checkPasswordBreach("Sicheres-Passwort-2026!BauPro")).resolves.toBe(false);
  });

  it("blockiert Nutzer bei API-Timeout nicht hart", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation((_input: URL | RequestInfo, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
      });
    });

    const result = checkPasswordBreach("Noch-Ein-Sicheres-Passwort-2026!");
    await vi.advanceTimersByTimeAsync(3_000);

    await expect(result).resolves.toBe(false);
  });
});
