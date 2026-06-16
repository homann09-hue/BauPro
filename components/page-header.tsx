import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type PageHeaderProps = {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  actionIcon?: LucideIcon;
};

export function PageHeader({
  title,
  description,
  actionHref,
  actionLabel,
  actionIcon: ActionIcon
}: PageHeaderProps) {
  return (
    <div className="construction-rail mb-5 rounded-lg border border-line bg-white p-4 shadow-soft sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker mb-2">BauPro Einsatzbereich</p>
          <h1 className="text-2xl font-black tracking-normal text-ink sm:text-3xl">{title}</h1>
          {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p> : null}
        </div>
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="btn-primary w-full shrink-0 sm:w-auto">
            {ActionIcon ? <ActionIcon className="h-4 w-4" aria-hidden="true" /> : null}
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
