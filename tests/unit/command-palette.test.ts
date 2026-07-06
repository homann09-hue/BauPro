import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("globaler Schnellzugriff", () => {
  it("bietet Tastatur- und Mobile-Bedienung ohne externe Bibliothek", () => {
    const palette = source("components/command-palette.tsx");

    expect(palette).toContain("metaKey || event.ctrlKey");
    expect(palette).toContain("ArrowDown");
    expect(palette).toContain("ArrowUp");
    expect(palette).toContain("Escape");
    expect(palette).toContain("Was möchtest du tun?");
    expect(palette).toContain("Schnellzugriff öffnen");
    expect(palette).toContain("Aktion, Baustelle, Material, Zeit suchen");
  });

  it("merkt zuletzt geoeffnete Aktionen nur als erlaubte lokale Hrefs", () => {
    const palette = source("components/command-palette.tsx");

    expect(palette).toContain("RECENT_COMMANDS_STORAGE_KEY");
    expect(palette).toContain("baupro:recent-command-hrefs:v1");
    expect(palette).toContain("MAX_RECENT_COMMANDS = 5");
    expect(palette).toContain("window.localStorage");
    expect(palette).toContain("actionByHref.has(entry.href)");
    expect(palette).toContain("Zuletzt geöffnet");
    expect(palette).not.toContain("full_name");
    expect(palette).not.toContain("company_id");
    expect(palette).not.toContain("purchase_price");
  });

  it("wird rollenbasiert aus der AppShell gefuettert", () => {
    const shell = source("components/app-shell.tsx");

    expect(shell).toContain("getCommandPaletteActions");
    expect(shell).toContain("context.isAdmin");
    expect(shell).toContain("context.isChef");
    expect(shell).toContain("<CommandPalette");
    expect(shell).toContain("Neuen Auftrag erstellen");
    expect(shell).toContain("Arbeitszeit eintragen");
    expect(shell).toContain("Material fehlt melden");
  });

  it("haelt Mitarbeiter-Schnellaktionen frei von Preis- und Systembereichen", () => {
    const shell = source("components/app-shell.tsx");
    const employeeStart = shell.lastIndexOf("return uniqueCommandActions([");
    const employeeEnd = shell.indexOf("]);\n}", employeeStart);
    const employeeReturn = shell.slice(employeeStart, employeeEnd);

    expect(employeeStart).toBeGreaterThanOrEqual(0);
    expect(employeeEnd).toBeGreaterThan(employeeStart);
    expect(employeeReturn).toContain("Arbeitszeit eintragen");
    expect(employeeReturn).toContain("Tagesbericht schreiben");
    expect(employeeReturn).toContain("Material fehlt melden");
    expect(employeeReturn).not.toContain("Lieferantenpreise");
    expect(employeeReturn).not.toContain("Lizenz und Abrechnung");
    expect(employeeReturn).not.toContain("Systemstatus öffnen");
    expect(employeeReturn).not.toContain("Benutzer und Rollen verwalten");
  });
});
