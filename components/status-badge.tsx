import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  geplant: "bg-info/10 text-info ring-info/30",
  aktiv: "bg-primary/15 text-primary ring-primary/30",
  abgeschlossen: "bg-mint text-ash ring-line",
  anfrage: "bg-primary/10 text-primary ring-primary/30",
  angebot: "bg-info/10 text-info ring-info/30",
  fertig: "bg-primary/15 text-primary ring-primary/30",
  abgerechnet: "bg-mint text-ash ring-line",
  offen: "bg-warning/15 text-primary ring-warning/30",
  in_arbeit: "bg-info/10 text-info ring-info/30",
  in_progress: "bg-info/10 text-info ring-info/30",
  erledigt: "bg-primary/15 text-primary ring-primary/30",
  nicht_zutreffend: "bg-mint text-ash ring-line",
  problem: "bg-red-950/40 text-red-200 ring-red-500/30",
  niedrig: "bg-mint text-ash ring-line",
  mittel: "bg-info/10 text-info ring-info/30",
  hoch: "bg-warning/15 text-primary ring-warning/30",
  kritisch: "bg-red-950/40 text-red-200 ring-red-500/30",
  draft: "bg-mint text-ash ring-line",
  completed: "bg-primary/15 text-primary ring-primary/30",
  submitted: "bg-info/10 text-info ring-info/30",
  reviewed: "bg-warning/15 text-primary ring-warning/30",
  approved: "bg-primary/15 text-primary ring-primary/30",
  rejected: "bg-red-950/40 text-red-200 ring-red-500/30",
  wartet_auf_kunde: "bg-warning/15 text-primary ring-warning/30",
  abgenommen: "bg-primary/15 text-primary ring-primary/30",
  generated: "bg-info/10 text-info ring-info/30",
  archived: "bg-mint text-ash ring-line",
  sent: "bg-info/10 text-info ring-info/30",
  accepted: "bg-primary/15 text-primary ring-primary/30",
  paid: "bg-primary/15 text-primary ring-primary/30",
  ready: "bg-info/10 text-info ring-info/30",
  packed: "bg-primary/15 text-primary ring-primary/30",
  delivered: "bg-mint text-primary ring-primary/30",
  reserved: "bg-info/10 text-info ring-info/30",
  partially_reserved: "bg-warning/15 text-primary ring-warning/30",
  missing: "bg-red-950/40 text-red-200 ring-red-500/30",
  cancelled: "bg-mint text-ash ring-line",
  acknowledged: "bg-info/10 text-info ring-info/30",
  resolved: "bg-primary/15 text-primary ring-primary/30",
  ordered: "bg-info/10 text-info ring-info/30",
  ignored: "bg-mint text-ash ring-line",
  received: "bg-primary/15 text-primary ring-primary/30"
};

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  const displayLabel = label ?? value.replace("_", " ");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-black capitalize ring-1",
        "min-h-8",
        styles[value] || "bg-mint text-ash ring-line"
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {displayLabel}
    </span>
  );
}
