import { expect, test } from "@playwright/test";

type CspTestWindow = Window &
  typeof globalThis & {
    __bauproCspInlineEvalWorked?: boolean;
  };

function scriptDirective(csp: string) {
  return csp
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith("script-src"));
}

function isLocalDevServer() {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
  return baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");
}

test("CSP blockiert unberechtigte Inline-eval-Payloads", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  const response = await page.goto("/login", { waitUntil: "domcontentloaded" });
  const csp = response?.headers()["content-security-policy"] ?? "";

  expect(csp).toContain("'nonce-");

  await page.evaluate(() => {
    const script = document.createElement("script");
    script.textContent = `eval("window.__bauproCspInlineEvalWorked = true");`;
    document.head.appendChild(script);
  });

  await expect.poll(() => page.evaluate(() => (window as CspTestWindow).__bauproCspInlineEvalWorked === true)).toBe(false);
  expect(browserErrors.some((message) => message.includes("Content Security Policy") || message.includes("script-src"))).toBe(true);
});

test("CSP-Header haertet script-src produktionsnah", async ({ page }) => {
  const response = await page.goto("/login", { waitUntil: "domcontentloaded" });
  const csp = response?.headers()["content-security-policy"] ?? "";
  const scripts = scriptDirective(csp);

  expect(csp).toContain("script-src");
  expect(scripts).toBeTruthy();
  expect(scripts).toContain("'self'");
  expect(scripts).toContain("'nonce-");
  if (isLocalDevServer()) {
    expect(scripts).toContain("unsafe-eval");
  } else {
    expect(scripts).not.toContain("unsafe-eval");
  }
  expect(scripts).not.toContain("unsafe-inline");
});
