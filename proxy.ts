import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

function isUnsafeMethod(method: string) {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

export async function proxy(request: NextRequest) {
  if (isUnsafeMethod(request.method)) {
    const origin = request.headers.get("origin");
    const expectedOrigin = new URL(request.url).origin;
    if (origin && origin !== expectedOrigin) {
      return new NextResponse("Anfrage abgelehnt.", { status: 403 });
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
