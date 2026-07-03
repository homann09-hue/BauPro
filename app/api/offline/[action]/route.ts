import { NextRequest, NextResponse } from "next/server";
import { reportMaterialNeedAction } from "@/lib/actions/material-alert-actions";
import { createReportAction, updateReportAction } from "@/lib/actions/report-actions";
import { createTimeEntryAction, updateTimeEntryAction } from "@/lib/actions/time-tracking-actions";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/origin";
import { getOptionalAppContext } from "@/lib/auth";

type OfflineAction = (formData: FormData) => Promise<void>;

type OfflineActionParams = {
  action: string;
};

type OfflineRouteContext = {
  params: Promise<OfflineActionParams>;
};

const OFFLINE_ACTION_ALIASES: Record<string, OfflineAction> = {
  "material-need": reportMaterialNeedAction,
  "material-melden": reportMaterialNeedAction,
  "report-material-need": reportMaterialNeedAction,
  reportMaterialNeedAction: reportMaterialNeedAction,
  reportmaterialneedaction: reportMaterialNeedAction,
  createReportAction: createReportAction,
  updateReportAction: updateReportAction,
  createTimeEntryAction: createTimeEntryAction,
  updateTimeEntryAction: updateTimeEntryAction,
  createreportaction: createReportAction,
  updatereportaction: updateReportAction,
  createtimeentryaction: createTimeEntryAction,
  updatetimeentryaction: updateTimeEntryAction
};

function actionForToken(token: string): OfflineAction | null {
  const normalizedToken = token.toLowerCase();
  if (OFFLINE_ACTION_ALIASES[normalizedToken]) {
    return OFFLINE_ACTION_ALIASES[normalizedToken];
  }

  if (normalizedToken === "time-entry") {
    return async (formData: FormData) => {
      if (formData.get("id")) {
        await updateTimeEntryAction(formData);
        return;
      }

      await createTimeEntryAction(formData);
    };
  }

  if (normalizedToken === "time-entry-form") {
    return async (formData: FormData) => {
      if (formData.get("id")) {
        await updateTimeEntryAction(formData);
        return;
      }

      await createTimeEntryAction(formData);
    };
  }

  if (normalizedToken === "report") {
    return async (formData: FormData) => {
      if (formData.get("id")) {
        await updateReportAction(formData);
        return;
      }

      await createReportAction(formData);
    };
  }

  if (normalizedToken === "report-form") {
    return async (formData: FormData) => {
      if (formData.get("id")) {
        await updateReportAction(formData);
        return;
      }

      await createReportAction(formData);
    };
  }

  return null;
}

function redirectResponseToJson(error: unknown) {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return null;
  }

  const digest = (error as { digest?: string }).digest;
  if (typeof digest !== "string") {
    return null;
  }

  const parts = digest.split(";");
  if (parts.length < 4 || parts[0] !== "NEXT_REDIRECT") {
    return null;
  }

  const type = parts[1];
  if (type !== "push" && type !== "replace") {
    return null;
  }

  const status = Number(parts.at(-1));
  if (!Number.isInteger(status) || !Number.isFinite(status)) {
    return null;
  }

  const location = parts.slice(2, -1).join(";") || "/dashboard";
  const isAuthRedirect = location.includes("/login") || location.includes("/mfa-challenge") || status === 303;
  const isPermissionError = location.includes("error=Keine%20Berechtigung") || location.includes("error=Keine+Berechtigung");

  const code = isAuthRedirect ? 401 : isPermissionError ? 403 : 500;
  const message = isAuthRedirect
    ? "Nicht angemeldet. Bitte melde dich erneut an."
    : isPermissionError
      ? "Keine Berechtigung für diese Offline-Aktion."
      : "Offline Aktion konnte nicht verarbeitet werden.";

  return NextResponse.json(
    {
      ok: false,
      error: message,
      code,
      location
    },
    { status: code }
  );
}

export async function POST(request: NextRequest, { params }: OfflineRouteContext) {
  const context = await getOptionalAppContext();
  if (!context) {
    return NextResponse.json({ ok: false, error: "Nicht angemeldet." }, { status: 401 });
  }

  try {
    await checkRateLimit(`offline-action:${context.companyId}:${context.userId}:${getClientIp(request.headers)}`, 80, 60_000);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Zu viele Offline-Anfragen.",
      },
      { status: 429 }
    );
  }

  const resolvedParams = await params;
  let actionName = resolvedParams.action || "";

  try {
    actionName = decodeURIComponent(actionName);
  } catch {
    // Keep the raw segment value.
  }

  const action = actionForToken(actionName);
  if (!action) {
    return NextResponse.json(
      {
        ok: false,
        error: `Unbekannte Offline-Aktion: ${actionName}`
      },
      { status: 404 }
    );
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Formulardaten koennen nicht gelesen werden."
      },
      { status: 400 }
    );
  }

  try {
    await action(formData);
  } catch (error) {
    const redirectResponse = redirectResponseToJson(error);
    if (redirectResponse) {
      return redirectResponse;
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Offline Aktion fehlgeschlagen."
      },
      { status: 500 }
    );
  }

  return new Response(null, { status: 204 });
}
