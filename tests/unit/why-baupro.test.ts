import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bauProValueDrivers, whyBauProDemoFlow, whyBauProSalesHighlights } from "@/lib/why-baupro";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("Warum BauPro", () => {
  it("documents switch reasons for every core function", () => {
    expect(bauProValueDrivers.length).toBeGreaterThanOrEqual(8);

    for (const driver of bauProValueDrivers) {
      expect(driver.title).toBeTruthy();
      expect(driver.switchReason).toBeTruthy();
      expect(driver.timeSaving).toBeTruthy();
      expect(driver.moneySaving).toBeTruthy();
      expect(driver.errorPrevention).toBeTruthy();
      expect(driver.automation).toBeTruthy();
      expect(driver.demoProof).toBeTruthy();
    }
  });

  it("keeps the value story public and out of the authenticated app shell", () => {
    expect(whyBauProSalesHighlights).toHaveLength(4);
    expect(whyBauProDemoFlow.length).toBeGreaterThanOrEqual(4);
    expect(source("app/(app)/warum-baupro/page.tsx")).toContain('redirect("/dashboard")');
    expect(source("components/app-shell.tsx")).not.toContain("/warum-baupro");
    expect(source("app/(auth)/layout.tsx")).toContain("whyBauProSalesHighlights");
    expect(source("app/(app)/dashboard/page.tsx")).not.toContain("whyBauProSalesHighlights");
    expect(source("lib/help/help-content.ts")).not.toContain("Warum BauPro?");
  });
});
