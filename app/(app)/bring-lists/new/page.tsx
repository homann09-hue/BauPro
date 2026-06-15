import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { createBringListAction } from "@/lib/actions/bring-list-actions";
import { requireAppContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { Jobsite, Profile, Vehicle } from "@/types/app";

function tomorrowIsoDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default async function NewBringListPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const { error, success } = searchParamMessage(params);
  const selectedJobId = typeof params.job_id === "string" ? params.job_id : "";

  const [jobsitesResult, employeesResult, vehiclesResult] = await Promise.all([
    supabase.from("jobsites").select("*").order("name"),
    context.canManage ? supabase.from("profiles").select("*").eq("active", true).order("full_name") : Promise.resolve({ data: [] }),
    context.canManage ? supabase.from("vehicles").select("*").order("name") : Promise.resolve({ data: [] })
  ]);

  const jobsites = (jobsitesResult.data ?? []) as Jobsite[];
  const employees = (employeesResult.data ?? []) as Profile[];
  const vehicles = (vehiclesResult.data ?? []) as Vehicle[];

  return (
    <>
      <PageHeader title="Neue Mitbringliste" description="Material, Werkzeug, PSA und Dokumente fuer eine Baustelle vorbereiten." />
      <MessageBox error={error || jobsitesResult.error?.message} success={success} />
      <div className="mb-4">
        <Link href="/bring-lists" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurueck
        </Link>
      </div>

      <form action={createBringListAction} className="surface p-4 sm:p-5">
        <input type="hidden" name="return_to" value="/bring-lists/new" />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="job_id">
              Baustelle
            </label>
            <select className="field-input" id="job_id" name="job_id" defaultValue={selectedJobId} required>
              <option value="">Baustelle auswaehlen</option>
              {jobsites.map((jobsite) => (
                <option key={jobsite.id} value={jobsite.id}>
                  {jobsite.name} - {jobsite.customer}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="date">
              Datum
            </label>
            <input className="field-input" id="date" name="date" type="date" defaultValue={tomorrowIsoDate()} required />
          </div>
          <div>
            <label className="field-label" htmlFor="title">
              Titel
            </label>
            <input className="field-input" id="title" name="title" placeholder="Mitbringliste morgen" />
          </div>
          {context.canManage ? (
            <div>
              <label className="field-label" htmlFor="assigned_to">
                Mitarbeiter optional
              </label>
              <select className="field-input" id="assigned_to" name="assigned_to" defaultValue="">
                <option value="">Nicht zuweisen</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name || employee.email}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {context.canManage ? (
            <div>
              <label className="field-label" htmlFor="vehicle_id">
                Fahrzeug optional
              </label>
              <select className="field-input" id="vehicle_id" name="vehicle_id" defaultValue="">
                <option value="">Kein Fahrzeug</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name} - {vehicle.license_plate}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <label className="field-label" htmlFor="notes">
            Notizen
          </label>
          <textarea className="field-input min-h-20" id="notes" name="notes" />
        </div>

        <div className="mt-6">
          <h2 className="section-title mb-3">Positionen</h2>
          <div className="grid gap-3">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="grid gap-2 rounded-md border border-line bg-white p-3 md:grid-cols-[1fr_100px_120px_130px]">
                <input className="field-input" name="item_name" placeholder={index === 0 ? "z. B. Dachlatten" : "Position"} />
                <input className="field-input" name="item_quantity" type="number" min="0" step="0.01" placeholder="Menge" />
                <input className="field-input" name="item_unit" placeholder="Einheit" defaultValue={index === 0 ? "Stueck" : ""} />
                <select className="field-input" name="item_type" defaultValue="material">
                  <option value="material">Material</option>
                  <option value="tool">Werkzeug</option>
                  <option value="document">Dokument</option>
                  <option value="safety">PSA</option>
                  <option value="other">Sonstiges</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <SubmitButton>Mitbringliste speichern</SubmitButton>
        </div>
      </form>
    </>
  );
}
