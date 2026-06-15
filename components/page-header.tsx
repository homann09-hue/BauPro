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
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-moss">BauPro</p>
        <h1 className="text-2xl font-black tracking-normal text-ink sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="btn-primary shrink-0">
          {ActionIcon ? <ActionIcon className="h-4 w-4" aria-hidden="true" /> : null}
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
