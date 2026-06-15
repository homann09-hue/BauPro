"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellPlus,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  Clock3,
  Cog,
  FileText,
  Hammer,
  Handshake,
  Home,
  Layers3,
  ListChecks,
  PackageSearch,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRound,
  Users,
  Warehouse
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  dashboard: Home,
  kunden: UserRound,
  auftraege: BriefcaseBusiness,
  kalender: CalendarDays,
  baustellen: Hammer,
  berichte: ClipboardList,
  zeiten: Clock3,
  stundenzettel: FileText,
  mitbringen: ListChecks,
  material: Layers3,
  lager: Warehouse,
  materialMelden: BellPlus,
  lieferanten: Handshake,
  fahrzeuge: Truck,
  team: Users,
  angebote: ReceiptText,
  ki: Sparkles,
  profil: UserRound,
  datenschutz: ShieldCheck,
  einstellungen: Cog,
  katalog: PackageSearch
};

type NavLinkProps = {
  href: string;
  label: string;
  icon: keyof typeof icons;
  variant?: "desktop" | "mobile";
};

export function NavLink({ href, label, icon, variant = "desktop" }: NavLinkProps) {
  const pathname = usePathname();
  const Icon = icons[icon] ?? Home;
  const active = pathname === href || pathname.startsWith(`${href}/`);

  if (variant === "mobile") {
    return (
      <Link
        href={href}
        aria-label={label}
        className={cn(
          "flex min-w-[74px] flex-none flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-[10px] font-semibold text-slate-500 transition sm:min-w-[86px] sm:text-[11px]",
          active && "bg-ink text-white shadow-sm"
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-mint/80 hover:text-ink",
        active && "bg-ink text-white shadow-sm"
      )}
    >
      <Icon className={cn("h-5 w-5", !active && "text-moss")} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
