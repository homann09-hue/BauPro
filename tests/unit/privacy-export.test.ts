import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const privacyExport = fs.readFileSync(path.join(root, "lib/privacy/export.ts"), "utf8");
const priceFieldPattern = /\b(purchase_price|sales_price|markup_percent|price_per_unit|price_net|price_gross|total_price_gross|cheapest_price_gross|average_price_gross)\b/;

function constString(name: string) {
  const match = privacyExport.match(new RegExp(`const ${name} =\\n  "([^"]+)";`));
  expect(match, `${name} must be a single string constant`).not.toBeNull();
  return match?.[1] ?? "";
}

function functionBlock(start: string, end: string) {
  const startIndex = privacyExport.indexOf(start);
  const endIndex = privacyExport.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return privacyExport.slice(startIndex, endIndex);
}

describe("privacy exports", () => {
  it("keeps own data export price-free", () => {
    const ownExport = functionBlock("export async function buildOwnDataExport", "export async function buildCompanyDataExport");

    expect(ownExport).not.toMatch(priceFieldPattern);
  });

  it("keeps operational company export sections price-redacted", () => {
    expect(privacyExport).not.toContain("inventoryItemManagerDetailSelect");
    expect(constString("materialExportSelect")).not.toMatch(priceFieldPattern);
    expect(constString("inventoryItemOperationalExportSelect")).not.toMatch(priceFieldPattern);
  });

  it("separates price data into an explicit chef/admin financial export block", () => {
    expect(privacyExport).toContain("restricted_financial_data");
    expect(privacyExport).toContain("restricted_financial_data_contains_prices: true");
    expect(constString("materialPriceExportSelect")).toMatch(/\b(purchase_price|sales_price)\b/);
    expect(constString("inventoryPriceExportSelect")).toMatch(/\b(purchase_price|sales_price|markup_percent)\b/);
    expect(constString("supplierOfferFinancialExportSelect")).toMatch(/\b(price_net|price_gross|total_price_gross)\b/);
    expect(constString("onlinePriceOfferFinancialExportSelect")).toMatch(/\b(price_gross|total_price_gross)\b/);
  });
});
