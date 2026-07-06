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
