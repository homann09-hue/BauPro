/**
 * Connection-Strategie:
 * NEXT_PUBLIC_SUPABASE_URL ist in diesem Projekt die normale Supabase-Projekt-URL
 * (https://<project-ref>.supabase.co), kein direkter Postgres-Connection-String.
 * supabase-js spricht damit Auth, Storage und Datenbankabfragen ueber die Supabase
 * HTTP-APIs/PostgREST an. Das eigentliche Datenbank-Connection-Pooling wird dadurch
 * serverseitig von Supabase/PostgREST/Supavisor gemanagt und nicht von Next.js.
 */
export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function getSupabasePublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}
