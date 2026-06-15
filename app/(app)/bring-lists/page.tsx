import Link from "next/link";
import { CalendarDays, ListChecks, MapPin, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireAppContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, searchParamMessage } from "@/lib/utils";
import type { BringList } from "@/types/app";

const statusLabels = {
  draft: "Entwurf",
  ready: "Bereit",
  packed: "Gepackt",
  delivered: "Geliefert"
};

function inSevenDaysIsoDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

export default async function BringListsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const resolvedSearchParams = await searchParams;
  const { error, success } = searchParamMessage(resolvedSearchParams);
  const selectedDate = typeof resolvedSearchParams?.date === "string" ? resolvedSearchParams.date : null;
  const today = new Date().toISOString().slice(0, 10);
  const dateFrom = selectedDate || today;
  const dateTo = selectedDate || inSevenDaysIsoDate();

  const { data, error: queryError } = await supabase
    .from("bring_lists")
    .select("*, jobsites(id, name, customer, address), profiles!bring_lists_assigned_to_fkey(id, full_name, email), vehicles(id, name, license_plate)")
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date", { ascending: true });

  const lists = (data ?? []) as BringList[];

  return (
    <>
      <PageHeader
        title="Mitbringlisten"
        description="Material, Werkzeug, PSA und Dokumente fuer die naechsten Baustellen."
        actionHref="/bring-lists/new"
        actionLabel="Neue Mitbringliste"
        actionIcon={Plus}
      />
      <MessageBox error={error || queryError?.message} success={success} />

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/bring-lists/new" className="btn-primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Neue Mitbringliste
        </Link>
        {selectedDate ? (
          <Link href="/bring-lists" className="btn-secondary">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Alle nächsten Tage
          </Link>
        ) : null}
        <Link href="/bring-lists/tomorrow" className="btn-secondary">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          Morgen
        </Link>
      </div>

      {lists.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Keine Mitbringlisten"
          description="Erstelle eine Liste per Diktat, manuell oder direkt aus einem Auftrag."
          actionHref="/bring-lists/new"
          actionLabel="Mitbringliste erstellen"
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {lists.map((list) => (
            <Link key={list.id} href={`/bring-lists/${list.id}`} className="interactive-surface block overflow-hidden p-0">
              <div className="h-1.5 bg-gradient-to-r from-moss via-steel to-signal" />
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="meta-label">{formatDate(list.date)}</p>
                    <h2 className="mt-1 text-lg font-black text-ink">{list.title}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-600">{list.jobsites?.name ?? "Baustelle"}</p>
                  </div>
                  <StatusBadge value={list.status} label={statusLabels[list.status]} />
                </div>
                <p className="mt-4 flex items-start gap-2 rounded-md bg-fog p-3 text-sm text-slate-600">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-moss" aria-hidden="true" />
                  {list.jobsites?.address ?? "Keine Adresse"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
