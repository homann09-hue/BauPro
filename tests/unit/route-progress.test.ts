import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("globaler Navigationsfortschritt", () => {
  it("reagiert nur auf echte interne Seitenwechsel", () => {
    const component = source("components/route-progress.tsx");

    expect(component).toContain('document.addEventListener("click"');
    expect(component).toContain("target.closest<HTMLAnchorElement>(\"a[href]\")");
    expect(component).toContain("url.origin !== window.location.origin");
    expect(component).toContain("anchor.hasAttribute(\"download\")");
    expect(component).toContain("event.metaKey || event.ctrlKey");
    expect(component).toContain("MAX_NAVIGATION_MS = 10_000");
  });

  it("zeigt langsame Navigation freundlich statt endloser Spinner", () => {
    const component = source("components/route-progress.tsx");

    expect(component).toContain("SLOW_NAVIGATION_MS = 700");
    expect(component).toContain("Bereich wird geöffnet");
    expect(component).toContain("role=\"status\"");
    expect(component).toContain("aria-live=\"polite\"");
  });

  it("ist im Root-Layout für öffentliche und eingeloggte Seiten aktiv", () => {
    const layout = source("app/layout.tsx");

    expect(layout).toContain("import { RouteProgress }");
    expect(layout).toContain("<RouteProgress />");
  });
});
