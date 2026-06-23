import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("protected app routes", () => {
  it("schuetzt Dashboard und App-Routen ueber das authenticated layout", () => {
    const layout = source("app/(app)/layout.tsx");

    expect(layout).toContain("const context = await requireAppContext()");
    expect(layout).toContain("<AppShell context={context}>");
    expect(layout).toContain("redirect(\"/onboarding\")");
  });

  it("haelt Login, Demo und Marketingseiten ausserhalb des geschuetzten App-Layouts", () => {
    for (const file of [
      "app/page.tsx",
      "app/(auth)/login/page.tsx",
      "app/(auth)/demo/page.tsx",
      "app/features/page.tsx",
      "app/use-cases/page.tsx",
      "app/security/page.tsx",
      "app/pricing/page.tsx",
      "app/about/page.tsx"
    ]) {
      expect(source(file), file).not.toContain("requireAppContext()");
    }
  });
});
