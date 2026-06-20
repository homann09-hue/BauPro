import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

function isUnsafeMethod(method: string) {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

function buildContentSecurityPolicy(nonce: string) {
  const scriptSources = [`'self'`, `'nonce-${nonce}'`];

  if (process.env.NODE_ENV === "development") {
    // Next/React Fast Refresh braucht im lokalen Dev-Server eval. In Production bleibt unsafe-eval verboten.
    scriptSources.push("'unsafe-eval'");
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "manifest-src 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSources.join(" ")}`,
    "connect-src 'self' https://*.supabase.co https://*.sentry.io https://api.openai.com https://api.open-meteo.com https://geocoding-api.open-meteo.com https://nominatim.openstreetmap.org",
    "worker-src 'self' blob:"
  ].join("; ");
}

function applySecurityHeaders(response: NextResponse, csp: string, nonce: string) {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);
  return response;
}

export async function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID();
  const csp = buildContentSecurityPolicy(nonce);

  if (isUnsafeMethod(request.method)) {
    const origin = request.headers.get("origin");
    const expectedOrigin = new URL(request.url).origin;

    if (origin && origin !== expectedOrigin) {
      return applySecurityHeaders(new NextResponse("Anfrage abgelehnt.", { status: 403 }), csp, nonce);
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = await updateSession(request, requestHeaders);
  return applySecurityHeaders(response, csp, nonce);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
