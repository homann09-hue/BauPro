import Link from "next/link";
import { AlertTriangle, BadgeEuro, Boxes, ClipboardCheck, MapPin, Search, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const materialLinks = [
  {
    href: "/materials/inventory",
    label: "Lager",
    description: "Bestand buchen",
    icon: Boxes,
    managerOnly: false
  },
  {
    href: "/materials/catalog",
    label: "Katalog",
    description: "Artikel finden",
    icon: Search,
    managerOnly: true
  },
  {
    href: "/materials/low-stock",
    label: "Mindestbestand",
    description: "Nachbestellen",
    icon: AlertTriangle,
    managerOnly: true
  },
  {
    href: "/materials/delivery-notes",
    label: "Lieferscheine",
    description: "Foto erkennen",
    icon: ClipboardCheck,
    managerOnly: false,
    operatorOnly: true
  },
  {
    href: "/materials/live-offers",
    label: "Angebote",
    description: "Preise vergleichen",
    icon: BadgeEuro,
    managerOnly: true
  },
  {
    href: "/materials/online-discovery",
    label: "Onlinepreise",
    description: "Preisindikator",
    icon: Search,
    managerOnly: true
  },
  {
    href: "/materials/locations",
    label: "Orte",
    description: "Lager, Auto, Baustelle",
    icon: MapPin,
    managerOnly: true
  },
  {
    href: "/materials/import",
    label: "Schnellerfassung",
    description: "Startbestand",
    icon: Upload,
    managerOnly: true
  }
];

export function MaterialSubnav({ active, canManage = true, canOperate = canManage }: { active: string; canManage?: boolean; canOperate?: boolean }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
      {materialLinks.filter((item) => (canManage || !item.managerOnly) && (!item.operatorOnly || canOperate)).map((item) => {
        const Icon = item.icon;
        const isActive = active === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft",
              isActive ? "border-primary bg-primary text-white" : "border-line text-ink hover:border-primary/30 hover:bg-mint"
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                  isActive ? "bg-white/15 text-white" : "bg-primary/10 text-primary"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{item.label}</p>
                <p className={cn("truncate text-xs", isActive ? "text-white/70" : "text-slate-500")}>
                  {item.description}
                </p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
