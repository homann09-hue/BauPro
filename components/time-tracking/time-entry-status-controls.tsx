"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { setTimeEntryStatusInlineAction } from "@/lib/actions/time-tracking-actions";
import type { TimeEntryStatus } from "@/types/app";

type TimeEntryStatusControlsProps = {
  entryId: string;
  initialStatus: TimeEntryStatus;
  returnTo: string;
};

export function TimeEntryStatusControls({ entryId, initialStatus, returnTo }: TimeEntryStatusControlsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<TimeEntryStatus>(initialStatus);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pendingStatus, setPendingStatus] = useState<TimeEntryStatus | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitStatus(form: HTMLFormElement | null, nextStatus: TimeEntryStatus) {
    if (!form || isPending) return;
    const formData = new FormData(form);
    setMessage(null);
    setPendingStatus(nextStatus);

    startTransition(async () => {
      const result = await setTimeEntryStatusInlineAction(formData);
      if (result.ok && result.status) {
        setStatus(result.status);
        setMessage({ type: "success", text: result.message });
        router.refresh();
      } else {
        setMessage({ type: "error", text: result.message });
      }
      setPendingStatus(null);
    });
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[620px]" data-testid="time-entry-status-controls">
      {status !== "approved" ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            submitStatus(event.currentTarget, "approved");
          }}
        >
          <input type="hidden" name="id" value={entryId} />
          <input type="hidden" name="status" value="approved" />
          <input type="hidden" name="return_to" value={returnTo} />
          <input
            className="field-input min-h-12 sm:min-w-56"
            name="change_reason"
            placeholder="Kommentar optional"
            defaultValue="Zeit freigegeben"
          />
          <button className="btn-primary sm:min-w-32" type="submit" disabled={isPending}>
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {pendingStatus === "approved" ? "Speichert..." : "Genehmigen"}
          </button>
        </form>
      ) : (
        <span className="inline-flex min-h-12 items-center justify-center rounded-md bg-primary/10 px-4 text-sm font-black text-primary-dark">
          Genehmigt
        </span>
      )}

      {status !== "rejected" ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            submitStatus(event.currentTarget, "rejected");
          }}
        >
          <input type="hidden" name="id" value={entryId} />
          <input type="hidden" name="status" value="rejected" />
          <input type="hidden" name="return_to" value={returnTo} />
          <input className="field-input min-h-12 sm:min-w-56" name="change_reason" placeholder="Ablehnungsgrund" defaultValue="Zeit abgelehnt" />
          <button className="btn-secondary sm:min-w-32" type="submit" disabled={isPending}>
            {pendingStatus === "rejected" ? "Speichert..." : "Ablehnen"}
          </button>
        </form>
      ) : (
        <span className="inline-flex min-h-12 items-center justify-center rounded-md bg-red-50 px-4 text-sm font-black text-danger">
          Abgelehnt
        </span>
      )}

      {message ? (
        <p
          className={`sm:col-span-2 rounded-md px-3 py-2 text-sm font-bold ${
            message.type === "success" ? "bg-primary/10 text-primary-dark" : "bg-red-50 text-danger"
          }`}
          role="status"
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
