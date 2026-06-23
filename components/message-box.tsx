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
          ? "mb-4 flex min-h-12 gap-2 border border-red-500/30 bg-red-950/40 px-3 py-3 text-sm font-semibold text-red-100 shadow-sm"
          : "mb-4 flex min-h-12 gap-2 border border-primary/35 bg-primary/10 px-3 py-3 text-sm font-semibold text-ink shadow-sm"
      }
      role={error ? "alert" : "status"}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{error || success}</span>
      {error ? (
        <a
          className="ml-auto shrink-0 rounded-md border border-current/30 px-2 py-1 text-xs font-black hover:bg-white/10"
          href=""
        >
          Erneut laden
        </a>
      ) : null}
    </div>
  );
}
