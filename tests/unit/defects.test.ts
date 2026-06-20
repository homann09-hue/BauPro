import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDefectPdf } from "@/lib/defect-export";
import { defectPriorityLabels, defectStatusLabels, isDefectDueSoon, isDefectOverdue } from "@/lib/defects";
import type { Defect, DefectPhoto } from "@/types/app";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("Mängelmanagement", () => {
  it("ships forced-RLS defect tables, storage and source automation", () => {
    for (const sql of ["supabase/migrations/20260706_defect_management.sql", "supabase/schema.sql"].map(source)) {
      expect(sql).toContain("create table if not exists public.defects");
      expect(sql).toContain("create table if not exists public.defect_photos");
      expect(sql).toContain("create table if not exists public.defect_notifications");
      expect(sql).toContain("alter table public.defects force row level security");
      expect(sql).toContain("alter table public.defect_photos force row level security");
      expect(sql).toContain('create policy "members read relevant defects"');
      expect(sql).toContain('create policy "members insert assigned jobsite defects"');
      expect(sql).toContain("create or replace function public.validate_defect_tenant()");
      expect(sql).toContain("create or replace function public.create_defect_from_checklist_problem()");
      expect(sql).toContain("create or replace function public.create_defect_due_notification()");
      expect(sql).toContain("'defect-photos'");
      expect(sql).toContain("(storage.foldername(name))[2] = 'defects'");
      expect(sql).toContain('drop policy if exists "redteam managers delete fallback" on public.defects');
    }
  });

  it("protects customer visibility, assignee changes and source tenant checks", () => {
    const sql = source("supabase/migrations/20260706_defect_management.sql");

    expect(sql).toContain("restricted_defect_update");
    expect(sql).toContain("new.visible_to_customer is distinct from old.visible_to_customer");
    expect(sql).toContain("p.role in ('vorarbeiter', 'mitarbeiter')");
    expect(sql).toContain("defect_report_source_invalid");
    expect(sql).toContain("defect_checklist_item_source_invalid");
    expect(sql).toContain("defect_customer_message_source_invalid");
  });

  it("keeps defect business data protected from hard deletes", () => {
    const guard = source("lib/data/soft-delete-guard.ts");
    for (const table of ["defects", "defect_photos", "defect_notifications"]) {
      expect(guard).toContain(`"${table}"`);
      expect(source("supabase/schema.sql")).toContain(`drop policy if exists "redteam managers delete fallback" on public.${table}`);
    }
  });

  it("labels statuses and detects deadlines", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    expect(defectStatusLabels.wartet_auf_kunde).toBe("Wartet auf Kunde");
    expect(defectPriorityLabels.kritisch).toBe("Kritisch");
    expect(isDefectDueSoon({ due_date: tomorrow.toISOString().slice(0, 10), status: "offen" })).toBe(true);
    expect(isDefectOverdue({ due_date: yesterday.toISOString().slice(0, 10), status: "in_arbeit" })).toBe(true);
    expect(isDefectOverdue({ due_date: yesterday.toISOString().slice(0, 10), status: "abgenommen" })).toBe(false);
  });

  it("renders a PDF defect report", () => {
    const defect = {
      id: "defect-1",
      company_id: "company-1",
      jobsite_id: "job-1",
      title: "Ortgang links beschädigt",
      description: "Der Ortgang links ist beim Rückbau beschädigt aufgefallen und muss vor Abnahme korrigiert werden.",
      priority: "hoch",
      status: "in_arbeit",
      assigned_to: "user-1",
      due_date: "2026-06-25",
      visible_to_customer: true,
      customer_released_at: "2026-06-20T12:00:00.000Z",
      customer_released_by: "chef-1",
      source_type: "checklist",
      source_report_id: null,
      source_report_photo_id: null,
      source_checklist_id: "checklist-1",
      source_checklist_item_id: "item-1",
      source_customer_message_id: null,
      source_task_id: "task-1",
      closed_at: null,
      accepted_at: null,
      created_by: "user-1",
      created_at: "2026-06-20T10:00:00.000Z",
      updated_at: "2026-06-20T12:00:00.000Z",
      archived_at: null,
      jobsites: {
        id: "job-1",
        name: "Musterdach Schmidt",
        customer: "Familie Schmidt",
        address: "Dachstrasse 1",
        assigned_employee_ids: ["user-1"]
      },
      profiles: {
        id: "user-1",
        full_name: "Max Muster",
        email: "max@example.test",
        role: "vorarbeiter"
      }
    } satisfies Defect;

    const photos = [
      {
        id: "photo-1",
        company_id: "company-1",
        defect_id: "defect-1",
        jobsite_id: "job-1",
        storage_path: "company-1/defects/defect-1/photo.jpg",
        file_name: "ortgang.jpg",
        content_type: "image/jpeg",
        size_bytes: 1234,
        visible_to_customer: true,
        uploaded_by: "user-1",
        created_at: "2026-06-20T10:05:00.000Z",
        archived_at: null
      } satisfies DefectPhoto
    ];

    const pdf = buildDefectPdf({
      company: { id: "company-1", name: "Mueller Dachtechnik GmbH" },
      defect,
      photos,
      generatedAt: "2026-06-20T13:00:00.000Z"
    });

    expect(pdf.subarray(0, 7).toString("utf8")).toBe("%PDF-1.");
  });
});
