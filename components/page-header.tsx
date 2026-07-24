import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actionHref?: string;
  actionLabel?: string;
  actionIcon?: LucideIcon;
};

export function PageHeader({
  title,
  description,
  eyebrow = "BauPro",
  actionHref,
  actionLabel,
  actionIcon: ActionIcon
}: PageHeaderProps) {
  return (
    <header className="app-hero-subtle construction-rail mb-5 overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[1fr_auto]">
        <div className="p-4 pl-5 sm:p-5 sm:pl-6 lg:p-6 lg:pl-7">
          <div className="mb-4 inline-flex min-h-8 items-center gap-2 border border-line bg-mint px-3 text-[11px] font-black uppercase tracking-[0.18em] text-primary">
            <span className="h-1.5 w-1.5 rotate-45 bg-primary" aria-hidden="true" />
            {eyebrow}
          </div>
          <h1 className="max-w-4xl text-4xl font-normal uppercase leading-none tracking-wide text-ink [font-family:var(--font-display)] sm:text-5xl">
            {title}
          </h1>
          {description ? <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-ash">{description}</p> : null}
        </div>
        {actionHref && actionLabel ? (
          <div className="border-t border-line bg-fog p-4 sm:p-5 lg:flex lg:min-w-64 lg:items-center lg:justify-center lg:border-l lg:border-t-0">
            <Link href={actionHref} className="btn-primary w-full shrink-0 lg:w-auto">
              {ActionIcon ? <ActionIcon className="h-4 w-4" aria-hidden="true" /> : null}
              {actionLabel}
            </Link>
          </div>
        ) : null}
      </div>
    </header>
  );
}
