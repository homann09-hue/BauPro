"use client";

import { BellPlus, ClipboardList, Clock3, ListChecks, Mic, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

export type VoiceQuickActionKind = "time_tracking" | "report_entry" | "bring_list" | "material_alert" | "job_note";

export function openVoiceQuickAction(kind?: VoiceQuickActionKind) {
  window.dispatchEvent(new CustomEvent("baupro:open-voice", { detail: { kind } }));
}

function VoiceQuickActionIcon({ kind, className }: { kind?: VoiceQuickActionKind; className: string }) {
  if (kind === "time_tracking") return <Clock3 className={className} aria-hidden="true" />;
  if (kind === "report_entry") return <ClipboardList className={className} aria-hidden="true" />;
  if (kind === "bring_list") return <ListChecks className={className} aria-hidden="true" />;
  if (kind === "material_alert") return <BellPlus className={className} aria-hidden="true" />;
  if (kind === "job_note") return <StickyNote className={className} aria-hidden="true" />;
  return <Mic className={className} aria-hidden="true" />;
}

export function VoiceQuickAction({
  kind,
  title = "Sprache aufnehmen",
  description = "Diktieren statt tippen",
  primary = false,
  className
}: {
  kind?: VoiceQuickActionKind;
  title?: string;
  description?: string;
  primary?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => openVoiceQuickAction(kind)}
      className={cn(
        "group flex min-h-24 flex-col justify-between rounded-lg border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft",
        primary
          ? "border-primary-dark bg-primary text-white hover:bg-primary-dark"
          : "border-line bg-white text-ink hover:border-primary/35 hover:bg-mint",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-md", primary ? "bg-white/15 text-white" : "bg-primary/10 text-primary")}>
          <VoiceQuickActionIcon kind={kind} className="h-5 w-5" />
        </span>
        <Mic className={cn("h-4 w-4", primary ? "text-white/70" : "text-primary")} aria-hidden="true" />
      </div>
      <div>
        <p className="font-black">{title}</p>
        <p className={cn("mt-1 text-sm", primary ? "text-white/75" : "text-slate-500")}>{description}</p>
      </div>
    </button>
  );
}
