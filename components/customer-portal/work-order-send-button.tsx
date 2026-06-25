"use client";

import { useState, useSyncExternalStore } from "react";
import { Loader2, Send } from "lucide-react";

type ActionState = {
  success?: string;
  error?: string;
};

function statusUrl(path: string, type: "success" | "error", message: string) {
  return `${path}?${type}=${encodeURIComponent(message)}`;
}

export function WorkOrderSendButton({ orderId, workOrderId }: { orderId: string; workOrderId: string }) {
  const [state, setState] = useState<ActionState>({});
  const [pending, setPending] = useState(false);
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const disabled = pending || !hydrated || Boolean(state.success);

  async function send() {
    setPending(true);
    setState({});

    try {
      const response = await fetch("/api/customer-portal/work-orders/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, workOrderId })
      });
      const payload = (await response.json()) as ActionState;

      if (!response.ok || payload.error) {
        setState({ error: payload.error ?? "Arbeitsauftrag konnte nicht gesendet werden." });
        setPending(false);
        return;
      }

      const success = payload.success ?? "Arbeitsauftrag ist jetzt im Kundenportal sichtbar.";
      setState({ success });
      window.setTimeout(() => window.location.assign(statusUrl(`/orders/${orderId}`, "success", success)), 250);
    } catch {
      setState({ error: "Arbeitsauftrag konnte nicht gesendet werden." });
      setPending(false);
    }
  }

  return (
    <div className="mt-3">
      <button className="btn-primary min-h-10" type="button" disabled={disabled} onClick={() => void send()}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
        {pending ? "Wird gesendet..." : state.success ? "Gesendet" : "Ins Kundenportal senden"}
      </button>
      {state.error ? (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="mt-2 rounded-md border border-primary/30 bg-mint px-3 py-2 text-sm font-bold text-primary-dark" role="status">
          {state.success}
        </p>
      ) : null}
    </div>
  );
}
