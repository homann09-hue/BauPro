import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  geplant: "bg-steel/10 text-steel ring-steel/15",
  aktiv: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  abgeschlossen: "bg-slate-100 text-slate-700 ring-slate-200",
  offen: "bg-signal/20 text-amber-900 ring-signal/25",
  in_arbeit: "bg-steel/10 text-steel ring-steel/15",
  erledigt: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  submitted: "bg-steel/10 text-steel ring-steel/15",
  approved: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  generated: "bg-steel/10 text-steel ring-steel/15",
  archived: "bg-slate-100 text-slate-700 ring-slate-200",
  ready: "bg-steel/10 text-steel ring-steel/15",
  packed: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  delivered: "bg-mint text-moss ring-moss/15",
  reserved: "bg-steel/10 text-steel ring-steel/15",
  partially_reserved: "bg-signal/20 text-amber-900 ring-signal/25",
  missing: "bg-red-50 text-red-700 ring-red-200",
  cancelled: "bg-slate-100 text-slate-700 ring-slate-200",
  acknowledged: "bg-steel/10 text-steel ring-steel/15",
  resolved: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  ordered: "bg-steel/10 text-steel ring-steel/15",
  ignored: "bg-slate-100 text-slate-700 ring-slate-200",
  received: "bg-emerald-100 text-emerald-800 ring-emerald-200"
};

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  const displayLabel = label ?? value.replace("_", " ");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold capitalize ring-1",
        styles[value] || "bg-slate-100 text-slate-700"
      )}
    >
      {displayLabel}
    </span>
  );
}
