import { AlertCircle, CheckCircle2 } from "lucide-react";

export function MessageBox({
  error,
  success
}: {
  error?: string | null;
  success?: string | null;
}) {
  if (!error && !success) return null;

  const Icon = error ? AlertCircle : CheckCircle2;

  return (
    <div
      className={
        error
          ? "mb-4 flex gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          : "mb-4 flex gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
      }
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{error || success}</span>
    </div>
  );
}
