import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("jobsite file record", () => {
  it("creates tenant isolated document and activity tables with private storage", () => {
    const migration = read("supabase/migrations/20260624_jobsite_file_documents.sql");
    const schema = read("supabase/schema.sql");

    for (const source of [migration, schema]) {
      expect(source).toContain("create table if not exists public.jobsite_documents");
      expect(source).toContain("create table if not exists public.jobsite_activity_events");
      expect(source).toContain("values ('jobsite-documents', 'jobsite-documents', false)");
      expect(source).toContain("alter table public.jobsite_documents force row level security");
      expect(source).toContain("alter table public.jobsite_activity_events force row level security");
      expect(source).toContain("(storage.foldername(name))[2] = 'jobsites'");
      expect(source).toContain("auth.uid() = any(j.assigned_employee_ids)");
      expect(source).toContain('drop policy if exists "redteam managers delete fallback" on public.jobsite_documents');
      expect(source).toContain('drop policy if exists "redteam managers delete fallback" on public.jobsite_activity_events');
    }
  });

  it("hardens upload, archive and download actions", () => {
    const actions = read("lib/actions/jobsite-file-actions.ts");
    const route = read("app/(app)/baustellen/[id]/documents/[documentId]/route.ts");
    const page = read("app/(app)/baustellen/[id]/page.tsx");

    expect(actions).toContain("validateCustomerDocument(file)");
    expect(actions).toContain('storage.from("jobsite-documents").upload');
    expect(actions).toContain('company_id: context.companyId');
    expect(actions).not.toMatch(/formData\.get\(["'`]company_id["'`]\)/);
    expect(actions).toContain("update({ archived_at:");
    expect(actions).not.toMatch(/\.from\(["'`]jobsite_documents["'`]\)[\s\S]{0,600}?\.delete\(/);
    expect(route).toContain("downloadHeaders(");
    expect(route).toContain('storage.from("jobsite-documents").download');
    expect(page).toContain("Baustellenakte");
    expect(page).toContain("uploadJobsiteDocumentAction");
    expect(page).toContain("createJobsiteActivityNoteAction");
  });
});
