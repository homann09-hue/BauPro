import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  geplant: "bg-info/10 text-info ring-info/20",
  aktiv: "bg-primary/10 text-primary-dark ring-primary/20",
  abgeschlossen: "bg-slate-100 text-slate-700 ring-slate-200",
  offen: "bg-warning/15 text-amber-900 ring-warning/30",
  in_arbeit: "bg-info/10 text-info ring-info/20",
  erledigt: "bg-primary/10 text-primary-dark ring-primary/20",
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  submitted: "bg-info/10 text-info ring-info/20",
  approved: "bg-primary/10 text-primary-dark ring-primary/20",
  rejected: "bg-red-50 text-danger ring-red-200",
  generated: "bg-info/10 text-info ring-info/20",
  archived: "bg-slate-100 text-slate-700 ring-slate-200",
  ready: "bg-info/10 text-info ring-info/20",
  packed: "bg-primary/10 text-primary-dark ring-primary/20",
  delivered: "bg-mint text-primary-dark ring-primary/20",
  reserved: "bg-info/10 text-info ring-info/20",
  partially_reserved: "bg-warning/15 text-amber-900 ring-warning/30",
  missing: "bg-red-50 text-danger ring-red-200",
  cancelled: "bg-slate-100 text-slate-700 ring-slate-200",
  acknowledged: "bg-info/10 text-info ring-info/20",
  resolved: "bg-primary/10 text-primary-dark ring-primary/20",
  ordered: "bg-info/10 text-info ring-info/20",
  ignored: "bg-slate-100 text-slate-700 ring-slate-200",
  received: "bg-primary/10 text-primary-dark ring-primary/20"
};

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  const displayLabel = label ?? value.replace("_", " ");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold capitalize ring-1",
        styles[value] || "bg-slate-100 text-slate-700"
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {displayLabel}
    </span>
  );
}
