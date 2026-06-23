import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("Premium UI/UX Designsystem", () => {
  it("defines mobile-first BauPro tokens and reusable UI primitives", () => {
    const css = source("app/globals.css");

    expect(css).toContain("--bp-touch: 56px");
    expect(css).toContain(".filter-bar");
    expect(css).toContain(".filter-chip");
    expect(css).toContain(".mobile-action-dock");
    expect(css).toContain(".native-topbar");
    expect(css).toContain(".form-step-card");
  });

  it("keeps the Stitch-inspired dark mode with an optional white mode", () => {
    const css = source("app/globals.css");
    const tailwind = source("tailwind.config.ts");
    const toggle = source("components/theme/theme-toggle.tsx");

    expect(css).toContain("color-scheme: dark");
    expect(css).toContain('[data-theme="light"]');
    expect(css).toContain("--color-primary: 46 125 50");
    expect(css).toContain("--color-primary: 27 67 50");
    expect(tailwind).toContain('primary: colorVar("--color-primary")');
    expect(toggle).toContain("baupro-theme");
    expect(toggle).toContain("White Mode aktivieren");
    expect(toggle).toContain("Dark Mode aktivieren");
  });

  it("keeps one consistent app chrome with top bar, sidebar and bottom navigation", () => {
    const shell = source("components/app-shell.tsx");
    const topBar = source("components/app-top-bar.tsx");

    expect(shell).toContain("mobile-action-dock");
    expect(shell).toContain("lg:ml-72");
    expect(shell).toContain("PredictivePrefetch");
    expect(topBar).toContain("native-topbar");
    expect(topBar).toContain("<ThemeToggle");
    expect(topBar).toContain("Möchtest du dich wirklich abmelden?");
  });

  it("uses the premium PageHeader instead of scattered page title patterns", () => {
    const pageHeader = source("components/page-header.tsx");

    expect(pageHeader).toContain("app-hero-subtle");
    expect(pageHeader).toContain("construction-rail");
    expect(pageHeader).toContain("btn-primary");
  });
});
