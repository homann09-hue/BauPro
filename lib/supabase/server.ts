import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

export async function createSupabaseServerClient() {
  const url = getSupabaseUrl();
  const anonKey = getSupabasePublishableKey();

  if (!url || !anonKey) {
    throw new Error("Supabase Umgebungsvariablen fehlen.");
  }

  const cookieStore = await cookies();

  /**
   * Skalierungsnotiz:
   * Dieser Client nutzt die Supabase-Projekt-URL aus NEXT_PUBLIC_SUPABASE_URL,
   * also die HTTP/PostgREST-Schicht von Supabase. Er baut keinen direkten
   * Postgres-Socket aus der Serverless Function auf. Connection Pooling und
   * Datenbankverbindungen werden dadurch auf Supabase-Seite verwaltet.
   */
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. Middleware refreshes the session.
        }
      }
    }
  });
}

export function createSupabaseAdminClient() {
  const url = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY fehlt.");
  }

  /**
   * Service-Role-Client sparsam einsetzen:
   * Auch dieser Client verwendet die Supabase-HTTP-API, laeuft aber ohne
   * Nutzerkontext und umgeht RLS. In Serverless sollte er nur fuer Webhooks,
   * interne Jobs und klar begrenzte Admin-Flows genutzt werden, weil viele
   * parallele privilegierte Requests schwerere Datenbankarbeit ausloesen koennen.
   */
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
