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
  HardHat,
  Handshake,
  HelpCircle,
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
  plantafel: CalendarDays,
  baustellen: HardHat,
  berichte: ClipboardList,
  zeiten: Clock3,
  stundenzettel: FileText,
  mitbringen: ListChecks,
  material: Layers3,
  checklisten: ListChecks,
  maengel: BellPlus,
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
  katalog: PackageSearch,
  warum: HelpCircle,
  onboarding: Sparkles
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
          "flex min-h-[62px] min-w-0 flex-col items-center justify-center gap-1 rounded-md px-0.5 py-2 text-center text-[10px] font-black leading-tight text-slate-500 transition",
          active && "bg-primary text-white shadow-sm",
          !active && "hover:bg-mint hover:text-ink"
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
        <span className="line-clamp-2 max-w-full break-words">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-3 text-sm font-black text-slate-300 transition hover:bg-white/10 hover:text-white",
        active && "bg-primary text-white shadow-soft"
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", !active && "text-slate-400 group-hover:text-white")} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
