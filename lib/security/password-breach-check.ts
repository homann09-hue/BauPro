import { createHash } from "node:crypto";

const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";
const HIBP_TIMEOUT_MS = 3_000;

export async function checkPasswordBreach(password: string): Promise<boolean> {
  if (!password) return false;

  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS);

  try {
    // k-Anonymity: Das echte Passwort wird nie gesendet. HaveIBeenPwned
    // bekommt nur die ersten 5 SHA-1-Zeichen und liefert passende Hash-Suffixe.
    const response = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      cache: "no-store",
      headers: {
        "Add-Padding": "true",
        "User-Agent": "BauPro password breach check"
      },
      signal: controller.signal
    });

    if (!response.ok) return false;

    const body = await response.text();
    return body.split(/\r?\n/).some((line) => {
      const [hashSuffix] = line.split(":");
      return hashSuffix?.trim().toUpperCase() === suffix;
    });
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
