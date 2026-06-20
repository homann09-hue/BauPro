import type { ChecklistCategory, ChecklistItemStatus, JobsiteChecklistStatus } from "@/types/app";

export const checklistCategories = [
  "arbeitssicherheit",
  "baustart",
  "tagesabschluss",
  "abnahme",
  "material",
  "geruest",
  "dacharbeiten"
] as const;

export const checklistItemStatuses = ["offen", "erledigt", "nicht_zutreffend", "problem"] as const;

export const jobsiteChecklistStatuses = ["draft", "in_progress", "completed", "archived"] as const;

export const checklistCategoryLabels: Record<ChecklistCategory, string> = {
  arbeitssicherheit: "Arbeitssicherheit",
  baustart: "Baustart",
  tagesabschluss: "Tagesabschluss",
  abnahme: "Abnahme",
  material: "Material",
  geruest: "Geruest",
  dacharbeiten: "Dacharbeiten"
};

export const checklistItemStatusLabels: Record<ChecklistItemStatus, string> = {
  offen: "Offen",
  erledigt: "Erledigt",
  nicht_zutreffend: "Nicht zutreffend",
  problem: "Problem"
};

export const jobsiteChecklistStatusLabels: Record<JobsiteChecklistStatus, string> = {
  draft: "Entwurf",
  in_progress: "In Arbeit",
  completed: "Abgeschlossen",
  archived: "Archiviert"
};

export function checklistProgress(items: Array<{ status: ChecklistItemStatus; required?: boolean | null }>) {
  const relevant = items.filter((item) => item.status !== "nicht_zutreffend");
  const done = relevant.filter((item) => item.status === "erledigt").length;
  const problems = items.filter((item) => item.status === "problem").length;
  const requiredOpen = items.filter((item) => item.required && item.status === "offen").length;
  const total = relevant.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return { done, total, percent, problems, requiredOpen };
}
