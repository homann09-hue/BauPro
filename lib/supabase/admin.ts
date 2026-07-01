import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type SupabaseAdminClientOptions = {
  reason: string;
  caller: string;
  companyId?: string | null;
  actorId?: string | null;
};

function assertAdminClientReason(options: SupabaseAdminClientOptions) {
  if (!options.caller.trim() || !options.reason.trim()) {
    throw new Error("Service-Role-Zugriffe brauchen caller und reason.");
  }
}

/**
 * Zentraler Einstieg fuer Service-Role-Zugriffe.
 *
 * Der Service-Role-Key umgeht Supabase RLS. Jede Nutzung muss deshalb einen
 * klaren technischen Grund nennen und in Reviews leicht auffindbar sein.
 * Fuer normale Nutzerabfragen immer createSupabaseServerClient() verwenden.
 */
export function createScopedSupabaseAdminClient(options: SupabaseAdminClientOptions): SupabaseAdminClient {
  assertAdminClientReason(options);
  return createSupabaseAdminClient();
}

export function tryCreateScopedSupabaseAdminClient(options: SupabaseAdminClientOptions): SupabaseAdminClient | null {
  assertAdminClientReason(options);
  try {
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}
