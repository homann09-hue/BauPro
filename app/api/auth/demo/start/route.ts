import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { AuthError, PostgrestError } from "@supabase/supabase-js";
import { ensureDemoModeData } from "@/lib/demo/demo-mode";
import { safeErrorMessage } from "@/lib/security/errors";
import { logServerWarning } from "@/lib/security/logging";
import { getClientIp } from "@/lib/security/origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { safeReturnPath } from "@/lib/security/redirects";
import { isQueryTimeoutError, withQueryTimeout, withRouteTiming } from "@/lib/performance/observability";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

function encodeMessage(message: string) {
  return encodeURIComponent(message);
}

function rateLimitKeyPart(value: string | null | undefined) {
  return (value || "unknown").replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 96) || "unknown";
}

function authTimeout(message: string) {
  return new AuthError(message, 504, "timeout");
}

function postgrestTimeout(message: string) {
  return {
    data: null,
    error: new PostgrestError({ message, details: "", hint: "", code: "timeout" }),
    count: null,
    status: 504,
    statusText: "Timeout",
    success: false as const
  };
}

function demoStartRateLimitKey(request: NextRequest) {
  const clientIp = getClientIp(request.headers);
  const userAgent = request.headers.get("user-agent");
  return `demo:start:${rateLimitKeyPart(clientIp)}:${rateLimitKeyPart(userAgent)}`;
}

const DEMO_PREP_TIMEOUT_MS = 15_000;
const DEMO_AUTH_TIMEOUT_MS = 10_000;
const DEMO_BOOTSTRAP_TIMEOUT_MS = 4_000;

function redirectWithCookies(request: NextRequest, path: string, cookiesToSet: CookieToSet[]) {
  const response = NextResponse.redirect(new URL(path, request.url), { status: 303 });
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}

function createAuthRouteClient(request: NextRequest, cookiesToSet: CookieToSet[]) {
  const url = getSupabaseUrl();
  const anonKey = getSupabasePublishableKey();

  if (!url || !anonKey) {
    throw new Error("Supabase Umgebungsvariablen fehlen.");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(newCookies) {
        cookiesToSet.push(...newCookies);
      }
    }
  });
}

async function signInDemoUser(
  supabase: ReturnType<typeof createAuthRouteClient>,
  demo: Awaited<ReturnType<typeof ensureDemoModeData>>
) {
  return supabase.auth.signInWithPassword({
    email: demo.chefEmail,
    password: demo.password
  });
}

export async function POST(request: NextRequest) {
  return withRouteTiming("api/auth/demo/start", "POST", async () => {
    const cookiesToSet: CookieToSet[] = [];
    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      formData = new FormData();
    }

    const returnTo = safeReturnPath(formData.get("return_to"), "/demo");

    if (process.env.NODE_ENV === "production") {
      try {
        await checkRateLimit(demoStartRateLimitKey(request), 30, 60_000);
      } catch (error) {
        const message = safeErrorMessage(error, "Demo-Schutz konnte nicht geprüft werden.");
        if (message.includes("Zu viele Anfragen")) {
          return redirectWithCookies(
            request,
            `${returnTo}?error=${encodeMessage("Demo wurde zu oft gestartet. Bitte warte kurz und versuche es erneut.")}`,
            cookiesToSet
          );
        }

        logServerWarning("demo-route-rate-limit-fallback", error, { message });
      }
    }

    let demo: Awaited<ReturnType<typeof ensureDemoModeData>>;
    try {
      demo = await withQueryTimeout(
        () => ensureDemoModeData(),
        {
          route: "api/auth/demo/start",
          action: "demo.ensureDemoModeData",
          timeoutMs: DEMO_PREP_TIMEOUT_MS,
          fallback: () => {
            throw new Error("Demo-Setup-Timeout");
          }
        }
      );
    } catch (error) {
      if (isQueryTimeoutError(error)) {
        logServerWarning("demo-start-timeout", error, {
          route: "api/auth/demo/start",
          action: "ensureDemoModeData"
        });
      }

      return redirectWithCookies(
        request,
        `${returnTo}?error=${encodeMessage(safeErrorMessage(error, "Demo-Modus konnte nicht vorbereitet werden."))}`,
        cookiesToSet
      );
    }

    let supabase: ReturnType<typeof createAuthRouteClient>;
    try {
      supabase = createAuthRouteClient(request, cookiesToSet);
    } catch {
      return redirectWithCookies(request, `${returnTo}?error=${encodeMessage("Supabase ist nicht konfiguriert.")}`, cookiesToSet);
    }

    let { data, error } = await withQueryTimeout(
      () => signInDemoUser(supabase, demo),
      {
        route: "api/auth/demo/start",
        action: "auth.signIn",
        timeoutMs: DEMO_AUTH_TIMEOUT_MS,
        fallback: () => ({ data: { user: null, session: null }, error: authTimeout("Demo-Anmeldung Timeout") })
      }
    );

    if (error || !data.user) {
      try {
        demo = await withQueryTimeout(
          () => ensureDemoModeData({ forceUserSync: true }),
          {
            route: "api/auth/demo/start",
            action: "demo.ensureDemoModeData.force",
            timeoutMs: DEMO_PREP_TIMEOUT_MS,
            fallback: () => {
              throw new Error("Demo-Setup-Timeout (force)");
            }
          }
        );
        ({ data, error } = await withQueryTimeout(
          () => signInDemoUser(supabase, demo),
          {
            route: "api/auth/demo/start",
            action: "auth.signIn.force",
            timeoutMs: DEMO_AUTH_TIMEOUT_MS,
            fallback: () => ({ data: { user: null, session: null }, error: authTimeout("Demo-Anmeldung Timeout") })
          }
        ));
      } catch (syncError) {
        logServerWarning("demo-mode-user-sync-failed", syncError);
      }
    }

    if (error || !data.user) {
      return redirectWithCookies(request, `${returnTo}?error=${encodeMessage("Demo-Login konnte nicht gestartet werden.")}`, cookiesToSet);
    }

    const bootstrapResult = await withQueryTimeout(
      () => supabase.rpc("bootstrap_my_profile"),
      {
        route: "api/auth/demo/start",
        action: "auth.bootstrap_my_profile",
        timeoutMs: DEMO_BOOTSTRAP_TIMEOUT_MS,
        fallback: () => postgrestTimeout("Bootstrap Timeout")
      }
    ).catch((bootstrapError) => {
      logServerWarning("demo-start-bootstrap-failed", bootstrapError, {
        route: "api/auth/demo/start",
        action: "auth.bootstrap_my_profile"
      });
      return null;
    });

    if (bootstrapResult?.error && String(bootstrapResult.error.message).includes("Bootstrap Timeout")) {
      logServerWarning("demo-start-bootstrap-timeout", {
        route: "api/auth/demo/start",
        action: "auth.bootstrap_my_profile",
        message: bootstrapResult.error.message
      });
    }

    return redirectWithCookies(
      request,
      "/dashboard?success=Demo-Modus gestartet. Du bist jetzt im Chef-Dashboard der Demo-Firma.",
      cookiesToSet
    );
  });
}
