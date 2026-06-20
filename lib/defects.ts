import type { DefectPriority, DefectSourceType, DefectStatus } from "@/types/app";

export const defectStatuses = ["offen", "in_arbeit", "wartet_auf_kunde", "erledigt", "abgenommen"] as const;
export const defectPriorities = ["niedrig", "mittel", "hoch", "kritisch"] as const;
export const defectSourceTypes = ["manual", "photo", "report", "checklist", "customer_message"] as const;

export const defectStatusLabels: Record<DefectStatus, string> = {
  offen: "Offen",
  in_arbeit: "In Arbeit",
  wartet_auf_kunde: "Wartet auf Kunde",
  erledigt: "Erledigt",
  abgenommen: "Abgenommen"
};

export const defectPriorityLabels: Record<DefectPriority, string> = {
  niedrig: "Niedrig",
  mittel: "Mittel",
  hoch: "Hoch",
  kritisch: "Kritisch"
};

export const defectSourceLabels: Record<DefectSourceType, string> = {
  manual: "Manuell",
  photo: "Foto",
  report: "Bericht",
  checklist: "Checkliste",
  customer_message: "Kundennachricht"
};

export function isOpenDefectStatus(status: DefectStatus) {
  return status !== "erledigt" && status !== "abgenommen";
}

type DefectDeadlineInput = {
  due_date?: string | null;
  status?: DefectStatus;
};

function deadlineValues(input?: string | null | DefectDeadlineInput, status?: DefectStatus) {
  if (typeof input === "object" && input !== null) {
    return { dueDate: input.due_date ?? null, status: input.status };
  }

  return { dueDate: input ?? null, status };
}

export function isDefectOverdue(input?: string | null | DefectDeadlineInput, status?: DefectStatus) {
  const values = deadlineValues(input, status);
  if (!values.dueDate || (values.status && !isOpenDefectStatus(values.status))) return false;
  const today = new Date().toISOString().slice(0, 10);
  return values.dueDate < today;
}

export function isDefectDueSoon(input?: string | null | DefectDeadlineInput, status?: DefectStatus) {
  const values = deadlineValues(input, status);
  if (!values.dueDate || (values.status && !isOpenDefectStatus(values.status))) return false;
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);
  return values.dueDate <= tomorrowIso;
}
