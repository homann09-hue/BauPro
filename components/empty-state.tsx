import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="surface-strong flex flex-col items-center justify-center px-4 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-mint text-moss ring-1 ring-moss/10">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-black text-ink">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      {actionHref && actionLabel ? (
        <Link className="btn-primary mt-5" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
