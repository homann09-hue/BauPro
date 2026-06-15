import Link from "next/link";
import { CalendarCheck, FileText, Plus, TriangleAlert, Truck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { requireAppContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, searchParamMessage } from "@/lib/utils";
import type { Vehicle } from "@/types/app";

export default async function VehiclesPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const { error, success } = searchParamMessage(await searchParams);

  if (!context.canManage) {
    return (
      <>
        <PageHeader title="Fahrzeuge" description="Fahrzeugverwaltung." />
        <MessageBox error={error} success={success} />
        <EmptyState
          icon={TriangleAlert}
          title="Kein Zugriff"
          description="Fahrzeuge werden von Admin oder Chef verwaltet."
        />
      </>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("vehicles").select("*").order("name", { ascending: true });
  const vehicles = (data ?? []) as Vehicle[];

  return (
    <>
      <PageHeader
        title="Fahrzeuge"
        description="Fahrzeugdaten, TÜV und Fahrzeuglager."
        actionHref="/fahrzeuge/neu"
        actionLabel="Fahrzeug anlegen"
        actionIcon={Plus}
      />
      <MessageBox error={error} success={success} />

      {vehicles.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Noch keine Fahrzeuge"
          description="Lege Transporter, Pritschen oder Servicefahrzeuge an."
          actionHref="/fahrzeuge/neu"
          actionLabel="Fahrzeug anlegen"
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {vehicles.map((vehicle) => (
            <Link
              href={`/fahrzeuge/${vehicle.id}/bearbeiten`}
              key={vehicle.id}
              className="interactive-surface block overflow-hidden p-0"
            >
              <div className="h-1.5 bg-gradient-to-r from-steel via-moss to-signal" />
              <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-ink">{vehicle.name}</h2>
                  <p className="mt-1 inline-flex rounded-md bg-ink px-2.5 py-1 text-sm font-bold text-white">
                    {vehicle.license_plate}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-mint text-moss">
                  <Truck className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-5 rounded-md bg-fog p-3">
                <p className="meta-label">TÜV</p>
                <p className="mt-1 flex items-center gap-2 font-bold text-ink">
                  <CalendarCheck className="h-4 w-4 text-moss" aria-hidden="true" />
                  {formatDate(vehicle.tuv_date)}
                </p>
              </div>
              {vehicle.notes ? (
                <p className="mt-3 line-clamp-2 flex gap-2 rounded-md border border-line bg-white p-3 text-sm text-slate-600">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-steel" aria-hidden="true" />
                  {vehicle.notes}
                </p>
              ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
