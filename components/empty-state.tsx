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
    <div className="surface-strong construction-rail flex flex-col items-center justify-center px-4 py-12 pl-5 text-center sm:py-14">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-anthracite text-white shadow-soft ring-1 ring-ink/10">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-black text-ink">{title}</h2>
      <p className="outdoor-copy mt-2 max-w-md">{description}</p>
      {actionHref && actionLabel ? (
        <Link className="btn-primary mt-5" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
