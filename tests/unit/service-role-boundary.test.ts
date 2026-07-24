import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const allowedFiles = new Set(["lib/supabase/server.ts", "lib/supabase/admin.ts"]);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) return [];
    return [absolute];
  });
}

describe("service role boundary", () => {
  it("keeps direct Supabase service-role access behind the audited wrapper", () => {
    const files = [...walk(path.join(root, "lib")), ...walk(path.join(root, "app"))];
    const offenders = files
      .map((file) => path.relative(root, file))
      .filter((file) => !allowedFiles.has(file))
      .filter((file) => fs.readFileSync(path.join(root, file), "utf8").includes("createSupabaseAdminClient"));

    expect(offenders).toEqual([]);

    const wrapper = fs.readFileSync(path.join(root, "lib/supabase/admin.ts"), "utf8");
    expect(wrapper).toContain("reason");
    expect(wrapper).toContain("caller");
    expect(wrapper).toContain("Service-Role-Key umgeht Supabase RLS");
  });
});
