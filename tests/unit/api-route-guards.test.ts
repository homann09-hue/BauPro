import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

type ApiContext = {
  userId: string;
  companyId: string;
  companyName: string;
  profile: {
    id: string;
    role: "admin" | "chef" | "vorarbeiter" | "mitarbeiter" | "kunde";
  };
  permissions: string[];
  canManage: boolean;
};

async function loadRoute(route: string, mockedContext: unknown) {
  vi.resetModules();
  vi.clearAllMocks();

  vi.doMock("@/lib/auth", () => ({
    getOptionalAppContext: vi.fn().mockResolvedValue(mockedContext)
  }));

  return import(route);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("API-Routen liefern bei fehlender Berechtigung korrekte JSON-Fehler", () => {
  it("planning assignments route: ohne Login -> 401", async () => {
    const route = await loadRoute("@/app/api/planning/assignments/route.ts", null);
    const response = await route.POST(new NextRequest("https://baupro.example/api/planning/assignments", { method: "POST", body: "{}" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Nicht angemeldet." });
  });

  it("planning assignments route: ohne Managerrechte -> 403", async () => {
    const context = {
      userId: "u1",
      companyId: "c1",
      companyName: "Demo",
      profile: { id: "u1", role: "chef" },
      permissions: [],
      canManage: false
    } as ApiContext;

    const route = await loadRoute("@/app/api/planning/assignments/route.ts", context);
    const response = await route.POST(new NextRequest("https://baupro.example/api/planning/assignments", { method: "POST", body: "{}" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "Keine Berechtigung." });
  });

  it("planning resources route: ohne Login -> 401", async () => {
    const route = await loadRoute("@/app/api/planning/resources/route.ts", null);
    const response = await route.POST(new NextRequest("https://baupro.example/api/planning/resources", { method: "POST", body: "{}" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Nicht angemeldet." });
  });

  it("planning resources route: ohne Berechtigung -> 403", async () => {
    const context = {
      userId: "u1",
      companyId: "c1",
      companyName: "Demo",
      profile: { id: "u1", role: "mitarbeiter" },
      permissions: [],
      canManage: false
    } as ApiContext;

    const route = await loadRoute("@/app/api/planning/resources/route.ts", context);
    const response = await route.POST(new NextRequest("https://baupro.example/api/planning/resources", { method: "POST", body: "{}" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "Keine Berechtigung." });
  });

  it("customer portal work-order create route: ohne Login -> 401", async () => {
    const route = await loadRoute("@/app/api/customer-portal/work-orders/route.ts", null);
    const response = await route.POST(
      new NextRequest("https://baupro.example/api/customer-portal/work-orders", {
        method: "POST",
        body: JSON.stringify({ orderId: "o1", title: "Auftrag", scopeOfWork: "Leistung" })
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Nicht angemeldet." });
  });

  it("customer portal link route: ohne Login -> 401", async () => {
    const route = await loadRoute("@/app/api/customer-portal/links/route.ts", null);
    const response = await route.POST(new NextRequest("https://baupro.example/api/customer-portal/links", { method: "POST", body: "{}" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Nicht angemeldet." });
  });
});
