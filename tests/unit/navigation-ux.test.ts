import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("App-Navigation und Benutzerbereich", () => {
  it("ships a unified app top bar with back navigation, user identity and confirmed logout", () => {
    const topBar = source("components/app-top-bar.tsx");

    expect(topBar).toContain("useRouter");
    expect(topBar).toContain("router.back()");
    expect(topBar).toContain("router.push(info.fallback)");
    expect(topBar).toContain("Zurück");
    expect(topBar).toContain("displayName");
    expect(topBar).toContain("Möchtest du dich wirklich abmelden?");
    expect(topBar).toContain("signOutAction");
    expect(topBar).toContain('name="return_to"');
    expect(source("app/globals.css")).toContain("env(safe-area-inset-top)");
  });

  it("mounts the top bar once in the authenticated shell and avoids duplicate logout controls in the sidebar", () => {
    const shell = source("components/app-shell.tsx");
    const authActions = source("lib/actions/auth-actions.ts");

    expect(shell).toContain("<AppTopBar");
    expect(shell).toContain("roleLabel={roleLabel}");
    expect(shell).toContain("userName={context.profile.full_name}");
    expect(shell).toContain('logoutReturnTo={isDemoContext ? "/demo" : "/login"}');
    expect(authActions).toContain("const returnTo = safeReturnPath(formData?.get(\"return_to\"), \"/login\")");
    expect(authActions).toContain('redirectWithMessage(returnTo, "success", "Du wurdest abgemeldet.")');
    expect(shell).toContain('href: "/mehr", label: "Mehr"');
    expect(shell).not.toContain("form action={signOutAction}");
  });

  it("supports keyboard users with a global skip link and main content target", () => {
    const rootLayout = source("app/layout.tsx");
    const skipLink = source("components/skip-to-content.tsx");
    const shell = source("components/app-shell.tsx");
    const marketingShell = source("components/marketing/marketing-site.tsx");
    const authLayout = source("app/(auth)/layout.tsx");

    expect(rootLayout).toContain("SkipToContent");
    expect(skipLink).toContain("Zum Inhalt springen");
    expect(skipLink).toContain('document.getElementById("main-content") ?? document.querySelector("main")');
    expect(skipLink).toContain("focus({ preventScroll: true })");
    expect(skipLink).toContain("scrollIntoView");
    expect(shell).toContain('main id="main-content"');
    expect(marketingShell).toContain('main id="main-content"');
    expect(authLayout).toContain('main id="main-content"');
  });

  it("marks the active navigation item for assistive technology", () => {
    const navLink = source("components/nav-link.tsx");

    expect(navLink).toContain('aria-current={active ? "page" : undefined}');
    expect(navLink).toContain("aktueller Bereich");
    expect(navLink).toContain("accessibleLabel");
  });

  it("knows the major overview fallback routes for direct deep links", () => {
    const topBar = source("components/app-top-bar.tsx");

    expect(topBar).toContain('prefix: "/orders/new", title: "Neuer Auftrag", fallback: "/orders"');
    expect(topBar).toContain('prefix: "/settings/security", title: "Sicherheit", fallback: "/settings"');
    expect(topBar).toContain('prefix: "/materials/inventory", title: "Lagerbestand", fallback: "/materials"');
    expect(topBar).toContain('prefix: "/time-tracking/daily", title: "Tagesstunden", fallback: "/time-tracking"');
    expect(topBar).toContain('prefix: "/baustellen", title: "Baustellen", fallback: "/dashboard"');
    expect(topBar).toContain('prefix: "/berichte", title: "Berichte", fallback: "/dashboard"');
  });

  it("turns /mehr into a clear all-functions page instead of a confusing redirect", () => {
    const page = source("app/(app)/mehr/page.tsx");

    expect(page).toContain("Alle Funktionen");
    expect(page).toContain("Was möchtest du tun?");
    expect(page).toContain("Neuen Auftrag anlegen");
    expect(page).toContain("Arbeitszeit eintragen");
    expect(page).toContain("Material fehlt");
    expect(page).not.toContain("redirect(");
  });
});
