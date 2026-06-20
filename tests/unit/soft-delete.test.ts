import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PROTECTED_TABLES } from "@/lib/data/soft-delete-guard";

const actionsRoot = path.resolve(__dirname, "../../lib/actions");

function listTypeScriptFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listTypeScriptFiles(absolutePath);
    return entry.isFile() && absolutePath.endsWith(".ts") ? [absolutePath] : [];
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("soft delete guard", () => {
  it("verbietet Hard-Deletes fuer geschuetzte Geschaeftstabellen in Server Actions", () => {
    const protectedAlternatives = PROTECTED_TABLES.map(escapeRegExp).join("|");
    const forbiddenDelete = new RegExp(
      String.raw`\.from\(\s*["'\`](${protectedAlternatives})["'\`]\s*\)[\s\S]{0,600}?\.delete\s*\(`,
      "g"
    );
    const findings = listTypeScriptFiles(actionsRoot).flatMap((filePath) => {
      const source = fs.readFileSync(filePath, "utf8");
      return Array.from(source.matchAll(forbiddenDelete)).map((match) => ({
        file: path.relative(process.cwd(), filePath),
        table: match[1]
      }));
    });

    expect(findings).toEqual([]);
  });
});
