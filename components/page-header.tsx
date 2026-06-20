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
    <div className="construction-rail mb-5 overflow-hidden rounded-lg border border-line bg-white shadow-soft">
      <div className="border-b border-line bg-gradient-to-r from-white via-fog to-mint/70 px-4 py-3 sm:px-5">
        <p className="section-kicker">BauPro Einsatzbereich</p>
      </div>
      <div className="p-4 pl-5 sm:p-5 sm:pl-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-normal text-ink sm:text-3xl">{title}</h1>
          {description ? <p className="outdoor-copy mt-2 max-w-2xl">{description}</p> : null}
        </div>
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="btn-primary w-full shrink-0 sm:w-auto">
            {ActionIcon ? <ActionIcon className="h-4 w-4" aria-hidden="true" /> : null}
            {actionLabel}
          </Link>
        ) : null}
      </div>
      </div>
    </div>
  );
}
