import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { ensureDemoModeData } from "@/lib/demo/demo-mode";
import { safeErrorMessage } from "@/lib/security/errors";
import { getClientIp } from "@/lib/security/origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { safeReturnPath } from "@/lib/security/redirects";
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

function demoStartRateLimitKey(request: NextRequest) {
  const clientIp = getClientIp(request.headers);
  const userAgent = request.headers.get("user-agent");
  return `demo:start:${rateLimitKeyPart(clientIp)}:${rateLimitKeyPart(userAgent)}`;
}

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

export async function POST(request: NextRequest) {
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
    } catch {
      return redirectWithCookies(
        request,
        `${returnTo}?error=${encodeMessage("Demo wurde zu oft gestartet. Bitte warte kurz und versuche es erneut.")}`,
        cookiesToSet
      );
    }
  }

  let demo: Awaited<ReturnType<typeof ensureDemoModeData>>;
  try {
    demo = await ensureDemoModeData();
  } catch (error) {
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

  const { data, error } = await supabase.auth.signInWithPassword({
    email: demo.chefEmail,
    password: demo.password
  });

  if (error || !data.user) {
    return redirectWithCookies(request, `${returnTo}?error=${encodeMessage("Demo-Login konnte nicht gestartet werden.")}`, cookiesToSet);
  }

  await supabase.rpc("bootstrap_my_profile");

  return redirectWithCookies(
    request,
    "/demo-tour?success=Demo-Modus gestartet. Folge den Karten von oben nach unten.",
    cookiesToSet
  );
}
