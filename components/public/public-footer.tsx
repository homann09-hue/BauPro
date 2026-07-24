import Image from "next/image";
import Link from "next/link";

const footerGroups = [
  {
    title: "Produkt",
    links: [
      ["Funktionen", "/features"],
      ["Anwendungsfälle", "/use-cases"],
      ["Preise", "/pricing"],
      ["Demo", "/demo"]
    ]
  },
  {
    title: "Vertrauen",
    links: [
      ["Sicherheit", "/security"],
      ["Über BauPro", "/about"],
      ["FAQ", "/#faq"]
    ]
  },
  {
    title: "Rechtliches",
    links: [
      ["Impressum", "/legal/impressum"],
      ["Datenschutz", "/legal/datenschutz"],
      ["AGB", "/legal/agb"],
      ["Cookies", "/legal/cookies"]
    ]
  }
] as const;

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-coal">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1.45fr] lg:px-8">
        <div>
          <Link href="/" className="flex w-fit items-center gap-3">
            <Image src="/icons/icon-192.png" alt="" width={36} height={36} className="border border-line bg-surface-container" />
            <span className="text-xl font-extrabold tracking-tight text-white">BauPro</span>
          </Link>
          <p className="mt-4 max-w-md text-sm leading-6 text-ash">
            BauPro ist eine mobile-first Handwerker-SaaS für deutsche Dachdecker- und Baubetriebe. Aufträge, Baustellen,
            Zeiten, Material, Berichte und Kundenkommunikation werden in einem klaren Ablauf verbunden.
          </p>
          <div className="mt-5 border border-line bg-surface-container p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-ocher">Kontakt & Support</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-ash">
              Support-Bereich und Kontaktadresse werden für den produktiven Betrieb vorbereitet.
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {footerGroups.map((group) => (
            <FooterGroup key={group.title} title={group.title} links={group.links} />
          ))}
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({ title, links }: { title: string; links: ReadonlyArray<readonly [string, string]> }) {
  return (
    <div>
      <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-ocher">{title}</p>
      <div className="grid gap-2">
        {links.map(([label, href]) => (
          <Link key={href} href={href} className="text-sm font-semibold text-ash transition hover:text-white focus:outline-none focus:ring-4 focus:ring-ocher/20">
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
