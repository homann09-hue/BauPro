import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";
import { authTimeoutError, withQueryTimeout } from "@/lib/performance/observability";
import { logServerWarning } from "@/lib/security/logging";

const UPDATE_SESSION_GETUSER_TIMEOUT_MS = 2_500;

export async function updateSession(request: NextRequest, requestHeaders = request.headers) {
  const url = getSupabaseUrl();
  const anonKey = getSupabasePublishableKey();

  if (!url || !anonKey) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  try {
    const { error } = await withQueryTimeout(() => supabase.auth.getUser(), {
      route: "auth",
      action: "auth.getUser middleware",
      timeoutMs: UPDATE_SESSION_GETUSER_TIMEOUT_MS,
      fallback: () => ({
        data: { user: null },
        error: authTimeoutError("auth.getUser timeout")
      })
    });

    if (error?.message?.toLowerCase().includes("timeout")) {
      logServerWarning("auth-middleware-get-user-timeout", error, {
        path: request.nextUrl.pathname
      });
    }

    if (error) {
      logServerWarning("auth-middleware-get-user-failed", error, {
        path: request.nextUrl.pathname
      });
    }
  } catch (error) {
    logServerWarning("auth-middleware-get-user-unexpected", error, {
      path: request.nextUrl.pathname
    });
  }
  return response;
}
