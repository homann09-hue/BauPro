import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const callbackError =
    requestUrl.searchParams.get("error_description") ?? requestUrl.searchParams.get("error");

  if (callbackError) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(callbackError)}`, request.url)
    );
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
      );
    }

    await supabase.rpc("bootstrap_my_profile");
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
