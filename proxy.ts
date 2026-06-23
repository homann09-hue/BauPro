import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

function isUnsafeMethod(method: string) {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

function createNonce() {
  return crypto.randomUUID();
}

function buildContentSecurityPolicy(nonce: string) {
  const scriptSources = ["'self'", `'nonce-${nonce}'`, "https://va.vercel-scripts.com"];
  if (process.env.NODE_ENV === "development") {
    // Next.js Dev-Server nutzt eval-basierte Source-Maps/Overlays. In Production bleibt unsafe-eval aus der CSP draußen.
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
    "connect-src 'self' https://*.supabase.co https://*.sentry.io https://api.openai.com https://api.open-meteo.com https://geocoding-api.open-meteo.com https://nominatim.openstreetmap.org https://vitals.vercel-insights.com",
    "worker-src 'self' blob:"
  ].join("; ");
}

function applySecurityHeaders(response: NextResponse, csp: string, nonce: string) {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);
  return response;
}

export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildContentSecurityPolicy(nonce);

  if (isUnsafeMethod(request.method)) {
    const origin = request.headers.get("origin");
    const expectedOrigin = new URL(request.url).origin;

    if (origin && origin !== expectedOrigin) {
      return applySecurityHeaders(new NextResponse("Anfrage abgelehnt.", { status: 403 }), csp, nonce);
    }
  }

  const requestHeaders = new Headers(request.headers);
  // Next.js liest den Nonce aus dem CSP-Request-Header und versieht eigene Runtime-Skripte damit.
  // App-eigene Inline-Skripte muessen zusaetzlich den `x-nonce` Header aus `headers()` verwenden.
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = await updateSession(request, requestHeaders);
  return applySecurityHeaders(response, csp, nonce);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|map|json|txt|xml|webmanifest)$).*)"]
};
