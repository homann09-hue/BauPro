import { AlertTriangle, CheckCircle2, Database, KeyRound, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProbeResult = {
  table: string;
  ok: boolean;
  rows: number;
  message: string | null;
};

const importantTables = [
  "companies",
  "profiles",
  "customers",
  "jobsites",
  "orders",
  "inventory_items",
  "inventory_locations",
  "materials",
  "time_entries",
  "reports",
  "tasks",
  "employee_permissions",
  "company_pricing_settings",
  "calculation_settings"
] as const;

const tableProbeColumns: Partial<Record<(typeof importantTables)[number], string>> = {
  company_pricing_settings: "company_id",
  calculation_settings: "company_id"
};

function envStatus() {
  return [
    { label: "NEXT_PUBLIC_SUPABASE_URL", ok: Boolean(getSupabaseUrl()) },
    { label: "NEXT_PUBLIC_SUPABASE_ANON_KEY / PUBLISHABLE_KEY", ok: Boolean(getSupabasePublishableKey()) },
    { label: "SUPABASE_SERVICE_ROLE_KEY", ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
    { label: "Redis/KV Rate-Limit", ok: Boolean(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) }
  ];
}

async function withTimeout<T>(promise: PromiseLike<T>, ms = 4500): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function probeTable(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  table: string,
  companyId: string
): Promise<ProbeResult> {
  try {
    let query = supabase.from(table).select(tableProbeColumns[table as (typeof importantTables)[number]] ?? "id").limit(1);

    if (!["companies"].includes(table)) {
      query = query.eq("company_id", companyId);
    } else {
      query = query.eq("id", companyId);
    }

    const { data, error } = await withTimeout(query);
    const message = safeQueryErrorMessage(error);

    return {
      table,
      ok: !error,
      rows: data?.length ?? 0,
      message
    };
  } catch (error) {
    return {
      table,
      ok: false,
      rows: 0,
      message: error instanceof Error && error.message === "timeout"
        ? "Supabase-Query hat zu lange gedauert. Bitte Netzwerk, RLS oder Tabellenindizes prüfen."
        : "Supabase-Test konnte nicht ausgeführt werden."
    };
  }
}

function StatusPill({ ok }: { ok: boolean }) {
  return (
    <span
      className={
        ok
          ? "inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-800 ring-1 ring-emerald-200"
          : "inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-black text-red-800 ring-1 ring-red-200"
      }
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
      {ok ? "OK" : "Fehler"}
    </span>
  );
}

export default async function SystemDebugPage() {
  const context = await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const timestamp = new Date().toLocaleString("de-DE", { dateStyle: "short", timeStyle: "medium" });

  const [{ data: userData, error: userError }, profileCheck, companyCheck, ...tableChecks] = await Promise.all([
    supabase.auth.getUser(),
    withTimeout(
      supabase
        .from("profiles")
        .select("id, company_id, role, active")
        .eq("id", context.userId)
        .eq("company_id", context.companyId)
        .maybeSingle()
    ).catch((error) => ({ data: null, error })),
    withTimeout(
      supabase
        .from("companies")
        .select("id, name")
        .eq("id", context.companyId)
        .maybeSingle()
    ).catch((error) => ({ data: null, error })),
    ...importantTables.map((table) => probeTable(supabase, table, context.companyId))
  ]);

  const authRows = [
    { label: "Eingeloggter User geladen", ok: Boolean(userData.user) && !userError, message: safeQueryErrorMessage(userError) },
    { label: "Profil geladen", ok: Boolean(profileCheck.data) && !profileCheck.error, message: safeQueryErrorMessage(profileCheck.error) },
    { label: "Firma geladen", ok: Boolean(companyCheck.data) && !companyCheck.error, message: safeQueryErrorMessage(companyCheck.error) }
  ];

  const failedTables = tableChecks.filter((result) => !result.ok);

  return (
    <>
      <PageHeader
        title="System-Debug"
        description="Supabase, Auth, Firmenkontext und Tabellenstatus prüfen. Es werden keine Secrets angezeigt."
      />
      <MessageBox
        error={failedTables.length ? `${failedTables.length} Tabellen-/Migrationsprüfungen melden ein Problem.` : null}
        success={failedTables.length ? null : "Systemprüfung abgeschlossen. Keine Tabellenfehler in den Testabfragen."}
      />

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-slate-500">Geprüft am {timestamp}</p>
        <Link href="/debug/system" className="btn-secondary">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Erneut prüfen
        </Link>
      </div>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="surface p-4">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="font-black text-ink">Umgebung</h2>
          </div>
          <div className="space-y-2">
            {envStatus().map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border border-line bg-fog p-3">
                <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                <StatusPill ok={item.ok} />
              </div>
            ))}
          </div>
        </div>

        <div className="surface p-4">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="font-black text-ink">Auth-Kontext</h2>
          </div>
          <div className="space-y-2">
            {authRows.map((item) => (
              <div key={item.label} className="rounded-md border border-line bg-fog p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                  <StatusPill ok={item.ok} />
                </div>
                {item.message ? <p className="mt-2 text-xs font-semibold text-red-700">{item.message}</p> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="surface p-4">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />
            <h2 className="font-black text-ink">Hinweise</h2>
          </div>
          <p className="text-sm leading-6 text-slate-600">
            Wenn Tabellen fehlen, bitte die aktuellen Dateien aus <code>supabase/migrations</code> im Supabase SQL-Editor
            einspielen. Wenn RLS eigene Daten blockiert, zeigen die Tabellenprüfungen meist „Daten konnten nicht geladen
            werden“ trotz vorhandener Tabelle.
          </p>
        </div>
      </section>

      <section className="mt-5 surface p-4">
        <div className="mb-4 flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="font-black text-ink">Tabellen- und Migrationscheck</h2>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {tableChecks.map((result) => (
            <div key={result.table} className="rounded-md border border-line bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black text-ink">{result.table}</p>
                  <p className="text-xs font-semibold text-slate-500">Testzeilen sichtbar: {result.rows}</p>
                </div>
                <StatusPill ok={result.ok} />
              </div>
              {result.message ? <p className="mt-2 text-sm font-semibold text-red-700">{result.message}</p> : null}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
