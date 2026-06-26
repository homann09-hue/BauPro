import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function exists(file: string) {
  return fs.existsSync(path.join(root, file));
}

describe("Öffentliche BauPro Marketing-Seiten", () => {
  it("zeigt auf / eine Landingpage statt Gäste direkt zum Login umzuleiten", () => {
    const home = source("app/page.tsx");
    const hero = source("components/public/hero-section.tsx");
    const marketing = source("components/marketing/marketing-site.tsx");

    expect(home).toContain("HeroSection");
    expect(hero).toContain("MarketingHero");
    expect(marketing).toContain("BauPro digitalisiert Dachdeckerbetriebe");
    expect(home).toContain("getOptionalAppContext");
    expect(home).not.toContain('redirect("/login")');
    expect(home).not.toContain('redirect(context ? "/dashboard" : "/login")');
  });

  it("erklaert KI, Kundenportal und Rollenmodell auf der Startseite sichtbar", () => {
    const home = source("app/page.tsx");

    expect(home).toContain("KI-Erklärung");
    expect(home).toContain("Kundenportal");
    expect(home).toContain("Rollenmodell");
    expect(home).toContain("Nutzer prüfen und bearbeiten alles");
    expect(home).toContain("Interne Notizen, Lagerdaten und Preise bleiben intern");
    expect(home).toContain("Systemadmins verwalten Rechte, Sicherheit und Integrationen");
  });

  it("liefert die wichtigsten öffentlichen Informationsseiten", () => {
    for (const file of [
      "app/features/page.tsx",
      "app/use-cases/page.tsx",
      "app/security/page.tsx",
      "app/pricing/page.tsx",
      "app/about/page.tsx",
      "app/demo/page.tsx"
    ]) {
      expect(exists(file), file).toBe(true);
    }
  });

  it("stellt die öffentliche Informationsarchitektur als wiederverwendbare Komponenten bereit", () => {
    for (const file of [
      "components/public/public-nav.tsx",
      "components/public/public-footer.tsx",
      "components/public/hero-section.tsx",
      "components/public/feature-grid.tsx",
      "components/public/workflow-section.tsx",
      "components/public/security-section.tsx",
      "components/public/faq-section.tsx",
      "components/public/cta-section.tsx"
    ]) {
      expect(exists(file), file).toBe(true);
    }

    const shell = source("components/marketing/marketing-site.tsx");
    expect(shell).toContain("<PublicNav");
    expect(shell).toContain("<PublicFooter");

    const home = source("app/page.tsx");
    expect(home).toContain("HeroSection");
    expect(home).toContain("FeatureGrid");
    expect(home).toContain("WorkflowSection");
    expect(home).toContain("SecuritySection");
    expect(home).toContain("FaqSection");
    expect(home).toContain("CtaSection");
  });

  it("hat eine professionelle öffentliche Navigation mit Demo, Login und Rechtslinks", () => {
    const publicNav = source("components/public/public-nav.tsx");
    const marketing = source("components/marketing/marketing-site.tsx");

    expect(marketing).toContain("<PublicNav");
    expect(publicNav).toContain("Funktionen");
    expect(publicNav).toContain("Vorteile");
    expect(publicNav).toContain("Ablauf");
    expect(publicNav).toContain("Sicherheit");
    expect(publicNav).toContain("Preise");
    expect(publicNav).toContain("FAQ");
    expect(publicNav).toContain("Demo starten");
    expect(publicNav).toContain("Einloggen");
    expect(publicNav).toContain("Zum Dashboard");
    expect(publicNav).toContain('href={isLoggedIn ? "/dashboard" : "/login"}');
    expect(publicNav).toContain("/legal/impressum");
    expect(publicNav).toContain("/legal/datenschutz");
    expect(publicNav).toContain("/legal/agb");
    expect(publicNav).toContain("/legal/cookies");
  });

  it("hat ein schließbares, tastaturfreundliches Mobile-Burger-Menü", () => {
    const publicNav = source("components/public/public-nav.tsx");

    expect(publicNav).toContain('"use client"');
    expect(publicNav).toContain("aria-expanded");
    expect(publicNav).toContain('aria-controls="public-mobile-menu"');
    expect(publicNav).toContain('role="dialog"');
    expect(publicNav).toContain('aria-modal="true"');
    expect(publicNav).toContain('event.key === "Escape"');
    expect(publicNav).toContain("event.target === event.currentTarget");
    expect(publicNav).toContain("closeButtonRef.current?.focus()");
    expect(publicNav).toContain("onClick={closeMenu}");
  });

  it("spricht die Kernfunktionen und Vorteile für Dachdecker verständlich an", () => {
    const data = source("lib/marketing.ts");

    for (const text of [
      "Aufträge & Baustellen",
      "Zeiterfassung",
      "Material & Lager",
      "Bautagesberichte",
      "Kundenportal",
      "KI-Unterstützung",
      "Weniger Papierkram im Büro",
      "Chef sieht Preise und Überblick, Mitarbeiter nur das Nötige"
    ]) {
      expect(data).toContain(text);
    }
  });

  it("enthält ausführliche Funktionsinhalte, neue Beispieltarife und mindestens 15 FAQ-Fragen", () => {
    const data = source("lib/marketing.ts");

    expect(data).toContain("marketingFeatureDetails");
    expect(data).toContain("29,99 €");
    expect(data).toContain("49,99 €");
    expect(data).toContain("79,99 €");
    expect(data).toContain("pro Monat · Beispieltarif");
    expect(data).toContain("marketingPricingComparison");

    const faqQuestions = data.match(/question:/g) ?? [];
    expect(faqQuestions.length).toBeGreaterThanOrEqual(15);
  });

  it("führt öffentliche Legal-Seiten professionell mit deutschen Umlauten", () => {
    const legal = source("lib/legal/pages.ts");
    const legalIndex = source("app/legal/page.tsx");
    const legalDetail = source("app/legal/[slug]/page.tsx");

    expect(legal).toContain("Datenschutzerklärung");
    expect(legal).toContain("Lösch- und Aufbewahrungskonzept");
    expect(legal).toContain("Geschäftsführung");
    expect(legalIndex).toContain("Rechtliche Informationen");
    expect(legalDetail).toContain("generateMetadata");
  });
});
