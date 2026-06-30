import { NextRequest, NextResponse } from "next/server";
import { reportMaterialNeedAction } from "@/lib/actions/material-alert-actions";
import { createReportAction, updateReportAction } from "@/lib/actions/report-actions";
import { createTimeEntryAction, updateTimeEntryAction } from "@/lib/actions/time-tracking-actions";

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

function actionResponseFromRedirect(error: unknown, request: NextRequest) {
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

  return NextResponse.redirect(new URL(location, request.url), {
    status
  });
}

export async function POST(request: NextRequest, { params }: OfflineRouteContext) {
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
    const redirectResponse = actionResponseFromRedirect(error, request);
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
