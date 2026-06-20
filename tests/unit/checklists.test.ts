import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildChecklistPdf } from "@/lib/checklist-export";
import { checklistProgress } from "@/lib/checklists";
import type { ChecklistPdfData } from "@/lib/checklist-export";
import type { JobsiteChecklist, JobsiteChecklistItem } from "@/types/app";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("flexible Checklisten", () => {
  it("ships the checklist schema with forced RLS, photo storage and problem task automation", () => {
    for (const sql of ["supabase/migrations/20260705_flexible_checklists.sql", "supabase/schema.sql"].map(source)) {
      expect(sql).toContain("create table if not exists public.checklist_templates");
      expect(sql).toContain("create table if not exists public.jobsite_checklists");
      expect(sql).toContain("create table if not exists public.jobsite_checklist_items");
      expect(sql).toContain("create table if not exists public.checklist_item_photos");
      expect(sql).toContain("alter table public.jobsite_checklists force row level security");
      expect(sql).toContain('create policy "members read jobsite checklists"');
      expect(sql).toContain('create policy "operators update jobsite checklist items"');
      expect(sql).toContain("create or replace function public.create_task_for_checklist_problem()");
      expect(sql).toContain("Mangel/Problem:");
      expect(sql).toContain("insert into storage.buckets (id, name, public)");
      expect(sql).toContain("'checklist-photos'");
    }
  });

  it("keeps checklist business data protected from hard deletes", () => {
    const guard = source("lib/data/soft-delete-guard.ts");
    for (const table of [
      "checklist_templates",
      "checklist_template_items",
      "jobsite_checklists",
      "jobsite_checklist_items",
      "checklist_item_photos"
    ]) {
      expect(guard).toContain(`"${table}"`);
      expect(source("supabase/schema.sql")).toContain(`drop policy if exists "redteam managers delete fallback" on public.${table}`);
    }
  });

  it("calculates progress without counting not-applicable items", () => {
    const result = checklistProgress([
      { status: "erledigt", required: true },
      { status: "offen", required: true },
      { status: "nicht_zutreffend", required: true },
      { status: "problem", required: false }
    ]);

    expect(result).toEqual({ done: 1, total: 3, percent: 33, problems: 1, requiredOpen: 1 });
  });

  it("renders a PDF checklist proof", () => {
    const checklist = {
      id: "checklist-1",
      company_id: "company-1",
      jobsite_id: "job-1",
      template_id: null,
      title: "Abnahme Dacharbeiten",
      category: "abnahme",
      status: "completed",
      due_date: "2026-06-19",
      completed_at: "2026-06-19T16:00:00.000Z",
      completed_by: "user-1",
      signature_name: null,
      signature_data_url: null,
      signature_role: null,
      signature_signed_at: null,
      notes: "Alles sauber dokumentiert.",
      created_by: "user-1",
      created_at: "2026-06-19T15:00:00.000Z",
      updated_at: "2026-06-19T16:00:00.000Z",
      archived_at: null,
      jobsites: {
        id: "job-1",
        name: "Musterdach Schmidt",
        customer: "Familie Schmidt",
        address: "Dachstrasse 1",
        assigned_employee_ids: ["user-1"]
      }
    } satisfies JobsiteChecklist;

    const items = [
      {
        id: "item-1",
        company_id: "company-1",
        checklist_id: "checklist-1",
        template_item_id: null,
        jobsite_id: "job-1",
        label: "Maengel dokumentiert",
        help_text: null,
        required: true,
        photo_required: true,
        status: "erledigt",
        notes: "Keine offenen Maengel.",
        problem_description: null,
        resolved_task_id: null,
        checked_by: "user-1",
        checked_at: "2026-06-19T15:30:00.000Z",
        sort_order: 10,
        created_at: "2026-06-19T15:00:00.000Z",
        updated_at: "2026-06-19T15:30:00.000Z",
        archived_at: null
      } satisfies JobsiteChecklistItem
    ];

    const pdf = buildChecklistPdf({
      companyName: "Mueller Dachtechnik GmbH",
      checklist,
      items,
      photosByItem: new Map(),
      generatedAt: "2026-06-19T16:05:00.000Z"
    } satisfies ChecklistPdfData);

    expect(pdf.subarray(0, 7).toString("utf8")).toBe("%PDF-1.");
  });
});
