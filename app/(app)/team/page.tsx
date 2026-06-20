import { ShieldCheck, Users } from "lucide-react";
import { FormSection, ResponsiveTableCard, StatCard } from "@/components/construction-ui";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { createEmployeeAction, updateEmployeeAction } from "@/lib/actions/auth-actions";
import { requireManager } from "@/lib/auth";
import { teamProfileSelect } from "@/lib/data/selects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { Profile } from "@/types/app";

const roleLabels = {
  admin: "Admin",
  chef: "Chef",
  vorarbeiter: "Vorarbeiter",
  mitarbeiter: "Mitarbeiter",
  kunde: "Kunde"
} as const;

function RoleOptions() {
  return (
    <>
      <option value="mitarbeiter">Mitarbeiter</option>
      <option value="vorarbeiter">Vorarbeiter</option>
      <option value="chef">Chef</option>
      <option value="admin">Admin</option>
      <option value="kunde">Kunde</option>
    </>
  );
}

export default async function TeamPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);

  const { data } = await supabase
    .from("profiles")
    .select(teamProfileSelect)
    .eq("company_id", context.companyId)
    .order("created_at", { ascending: true });
  const profiles = (data ?? []) as Profile[];
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const activeProfiles = profiles.filter((profile) => profile.active).length;
  const foremen = profiles.filter((profile) => profile.role === "vorarbeiter").length;
  const employees = profiles.filter((profile) => profile.role === "mitarbeiter").length;

  return (
    <>
      <PageHeader title="Team" description="Mitarbeiter, Rollen und Zugänge direkt verwalten." />
      <MessageBox error={error} success={success} />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard icon={ShieldCheck} label="Aktive Zugänge" value={activeProfiles} tone="green" />
        <StatCard icon={Users} label="Vorarbeiter" value={foremen} tone="info" />
        <StatCard icon={Users} label="Mitarbeiter" value={employees} tone="neutral" />
      </section>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-4">
          <div className="dashboard-band">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-moss/10 text-moss">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-semibold text-ink">{context.companyName}</h2>
                <p className="text-sm text-slate-500">Deine Rolle: {roleLabels[context.profile.role]}</p>
              </div>
            </div>
          </div>

          <FormSection title="Mitarbeiter anlegen" description="Zugang mit Rolle erstellen. Chef/Admin behalten die Teamverwaltung.">
            {!hasServiceRole ? (
              <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                SUPABASE_SERVICE_ROLE_KEY fehlt. Trage ihn in .env.local ein, damit Mitarbeiter serverseitig
                angelegt werden können.
              </p>
            ) : null}
            <form action={createEmployeeAction} className="space-y-3">
              <div>
                <label className="field-label" htmlFor="full_name">
                  Name
                </label>
                <input className="field-input" id="full_name" name="full_name" required />
              </div>
              <div>
                <label className="field-label" htmlFor="email">
                  E-Mail
                </label>
                <input className="field-input" id="email" name="email" type="email" required />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="password">
                    Startpasswort
                  </label>
                  <input className="field-input" id="password" name="password" type="password" minLength={8} required />
                </div>
                <div>
                  <label className="field-label" htmlFor="role">
                    Rolle
                  </label>
                  <select className="field-input" id="role" name="role" defaultValue="mitarbeiter">
                    <RoleOptions />
                  </select>
                </div>
              </div>
              <SubmitButton className="w-full">Mitarbeiter anlegen</SubmitButton>
            </form>
          </FormSection>
        </section>

        <section className="dashboard-band">
          <div className="mb-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-moss" aria-hidden="true" />
            <div>
              <p className="section-kicker">Rollenverwaltung</p>
              <h2 className="text-lg font-black text-ink">Team und Rollen</h2>
            </div>
          </div>

          {profiles.length === 0 ? (
            <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-600">
              Nach der Registrierung erscheint hier dein Team.
            </p>
          ) : (
            <div className="space-y-3">
              {profiles.map((profile) => (
                <ResponsiveTableCard
                  key={profile.id}
                  title={profile.full_name || profile.email || "Ohne Namen"}
                  meta={`${profile.email || "Keine E-Mail"} · ${roleLabels[profile.role]}`}
                >
                  <form action={updateEmployeeAction}>
                    <input type="hidden" name="id" value={profile.id} />
                    <div className="grid gap-3 md:grid-cols-[1fr_170px_110px_auto] md:items-end">
                      <div>
                        <label className="field-label" htmlFor={`full-name-${profile.id}`}>
                          Name
                        </label>
                        <input
                          className="field-input"
                          id={`full-name-${profile.id}`}
                          name="full_name"
                          defaultValue={profile.full_name ?? ""}
                        />
                        <p className="field-help">{profile.email}</p>
                      </div>
                      <div>
                        <label className="field-label" htmlFor={`role-${profile.id}`}>
                          Rolle
                        </label>
                        <select className="field-input" id={`role-${profile.id}`} name="role" defaultValue={profile.role}>
                          <RoleOptions />
                        </select>
                      </div>
                      <label className="flex min-h-12 items-center gap-2 rounded-md border border-line bg-fog px-3 py-2.5 text-sm font-bold text-ink">
                        <input
                          type="checkbox"
                          name="active"
                          defaultChecked={profile.active}
                          className="h-4 w-4 rounded border-line text-primary"
                        />
                        Aktiv
                      </label>
                      <SubmitButton variant="secondary">Speichern</SubmitButton>
                    </div>
                  </form>
                </ResponsiveTableCard>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
