import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadRouteWithMocks(mockedContext: unknown, mockedReportAction: () => Promise<void>) {
  vi.resetModules();
  vi.clearAllMocks();

  vi.doMock("@/lib/auth", () => ({
    getOptionalAppContext: vi.fn().mockResolvedValue(mockedContext)
  }));

  vi.doMock("@/lib/actions/report-actions", () => ({
    createReportAction: mockedReportAction,
    updateReportAction: mockedReportAction
  }));

  const route = await import("@/app/api/offline/[action]/route");
  return route;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("offline API route hardening", () => {
  it("liefert bei fehlender Session eine 401-Fehlerantwort statt Redirect", async () => {
    const route = await loadRouteWithMocks(null, async () => {
      throw new Error("unexpected");
    });

    const request = new NextRequest("https://baupro.example/api/offline/createReportAction", {
      method: "POST",
      body: ""
    });
    const response = await route.POST(request, {
      params: Promise.resolve({ action: "createReportAction" })
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "Nicht angemeldet." });
  });

  it("wandelt Next-Redirects bei nicht angemeldeten Nutzer in 401 JSON responses", async () => {
    const loginRedirectError = new Error("Login required");
    (loginRedirectError as { digest?: string }).digest = "NEXT_REDIRECT;replace;/login?error=Not+found;303";

    const route = await loadRouteWithMocks(
      {
        userId: "u1",
        email: "chef@example.com",
        profile: { id: "u1", role: "chef", company_id: "c1", email: "chef@example.com", full_name: "Chef", active: true },
        company: { id: "c1", name: "Demo GmbH", session_timeout_minutes: 30, onboarding_completed_at: null },
        companyId: "c1",
        companyName: "Demo GmbH",
        canManage: true,
        canOperate: true,
        isAdmin: false,
        isChef: true,
        permissions: [],
        mfaEnabled: false
      } as never,
      async () => {
        throw loginRedirectError;
      }
    );

    const formData = new FormData();
    formData.set("id", "report-id");

    const request = new NextRequest("https://baupro.example/api/offline/report", {
      method: "POST",
      body: formData
    });
    const response = await route.POST(request, {
      params: Promise.resolve({ action: "report" })
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, code: 401 });
  });
});
