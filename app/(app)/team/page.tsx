import { ShieldCheck, Users } from "lucide-react";
import { FormSection, ResponsiveTableCard, StatCard } from "@/components/construction-ui";
import { PasswordInputWithStrength } from "@/components/forms/password-strength-indicator";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { EmployeePermissionsMenu } from "@/components/team/employee-permissions-menu";
import { createEmployeeAction, updateEmployeeAction } from "@/lib/actions/auth-actions";
import { requireAdmin } from "@/lib/auth";
import { teamProfileSelect } from "@/lib/data/selects";
import { searchOrFilter } from "@/lib/data/shared";
import { effectivePermissionKeys, normalizePermissionKeys, type PermissionKey } from "@/lib/permissions";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { Profile } from "@/types/app";

type CompanyOption = {
  id: string;
  name: string;
};

const roleLabels = {
  admin: "Systemadmin",
  chef: "Chef",
  vorarbeiter: "Vorarbeiter",
  mitarbeiter: "Mitarbeiter",
  kunde: "Kunde"
} as const;

const companyOptionLimit = 200;
const profileListLimit = 120;

function stringParam(params: Record<string, string | string[] | undefined> | undefined, key: string) {
  const value = params?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function RoleOptions() {
  return (
    <>
      <option value="mitarbeiter">Mitarbeiter</option>
      <option value="vorarbeiter">Vorarbeiter</option>
      <option value="chef">Chef</option>
      <option value="admin">Systemadmin</option>
      <option value="kunde">Kunde</option>
    </>
  );
}

export default async function TeamPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const resolvedSearchParams = await searchParams;
  const { error, success } = searchParamMessage(resolvedSearchParams);
  const query = stringParam(resolvedSearchParams, "q").slice(0, 80);
  const companyFilter = stringParam(resolvedSearchParams, "company_id");

  let profilesQuery = supabase.from("profiles").select(teamProfileSelect).order("created_at", { ascending: true }).limit(profileListLimit);
  if (companyFilter) profilesQuery = profilesQuery.eq("company_id", companyFilter);
  if (query) profilesQuery = profilesQuery.or(searchOrFilter(["full_name", "email"], query));

  const [companiesResult, profilesResult] = await Promise.all([
    supabase.from("companies").select("id, name").order("name", { ascending: true }).limit(companyOptionLimit),
    profilesQuery
  ]);
  const companies = (companiesResult.data ?? []) as CompanyOption[];
  const companyNameById = new Map(companies.map((company) => [company.id, company.name]));
  const data = profilesResult.data;
  const profilesError = profilesResult.error;
  const profiles = (data ?? []) as Profile[];
  const permissionsResult =
    profiles.length > 0
      ? await supabase.from("employee_permissions").select("profile_id, permission_key, granted").in(
          "profile_id",
          profiles.map((profile) => profile.id)
        )
      : { data: [], error: null };
  const permissionsByProfile = new Map<string, PermissionKey[]>();

  if (!permissionsResult.error) {
    for (const row of permissionsResult.data ?? []) {
      const typedRow = row as { profile_id?: string; permission_key?: string; granted?: boolean };
      if (!typedRow.profile_id || !typedRow.granted) continue;
      const current = permissionsByProfile.get(typedRow.profile_id) ?? [];
      permissionsByProfile.set(typedRow.profile_id, normalizePermissionKeys([...current, String(typedRow.permission_key ?? "")]));
    }
  }

  const permissionsError = permissionsResult.error
    ? isMissingSchemaError(permissionsResult.error)
      ? "Datenbank-Update fehlt: Bitte supabase/migrations/20260622_employee_permissions.sql ausführen."
      : "Rechte konnten nicht geladen werden."
    : null;
  const teamError = safeQueryErrorMessage(companiesResult.error) || safeQueryErrorMessage(profilesError) || permissionsError;
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const activeProfiles = profiles.filter((profile) => profile.active).length;
  const foremen = profiles.filter((profile) => profile.role === "vorarbeiter").length;
  const employees = profiles.filter((profile) => profile.role === "mitarbeiter").length;

  return (
    <>
      <PageHeader title="Benutzer und Rollen" description="Zugänge, Rollen und Rechte verwalten. Dieser Bereich ist Systemadmins vorbehalten." />
      <MessageBox error={error || teamError} success={success} />

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
                <h2 className="font-semibold text-ink">Systemadmin-Konsole</h2>
                <p className="text-sm text-slate-500">
                  {companies.length} Firmen · deine Rolle: {roleLabels[context.profile.role]}
                </p>
              </div>
            </div>
          </div>

          <FormSection title="Mitarbeiter anlegen" description="Zugang mit Rolle erstellen. Nur Systemadmins verwalten Benutzer und Rechte.">
            {!hasServiceRole ? (
              <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                SUPABASE_SERVICE_ROLE_KEY fehlt. Trage ihn in .env.local ein, damit Mitarbeiter serverseitig
                angelegt werden können.
              </p>
            ) : null}
            <form action={createEmployeeAction} className="space-y-3">
              <div>
                <label className="field-label" htmlFor="company_id">
                  Zielfirma
                </label>
                <select className="field-input" id="company_id" name="company_id" defaultValue={context.companyId} required>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
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
                <PasswordInputWithStrength
                  id="password"
                  label="Startpasswort"
                  helpText="Mindestens 8 Zeichen. Wird vor dem Anlegen auf bekannte Datenlecks geprüft."
                />
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

          <form className="mb-4 grid gap-3 md:grid-cols-[1fr_220px_auto]" action="/team">
            <label>
              <span className="field-label">Suche</span>
              <input className="field-input" name="q" defaultValue={query} placeholder="Name oder E-Mail" />
            </label>
            <label>
              <span className="field-label">Firma</span>
              <select className="field-input" name="company_id" defaultValue={companyFilter}>
                <option value="">Alle geladenen Firmen</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn-primary self-end" type="submit">
              Filtern
            </button>
          </form>

          {profiles.length >= profileListLimit ? (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              Es werden maximal {profileListLimit} Benutzer angezeigt. Nutze Suche oder Firmenfilter für große Mandanten.
            </p>
          ) : null}

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
                  meta={`${companyNameById.get(profile.company_id) ?? "Unbekannte Firma"} · ${profile.email || "Keine E-Mail"} · ${roleLabels[profile.role]}`}
                >
                  <div className="mb-3">
                    <EmployeePermissionsMenu
                      employeeId={profile.id}
                      employeeCompanyId={profile.company_id}
                      employeeName={profile.full_name || profile.email || "Ohne Namen"}
                      employeeRole={profile.role}
                      grantedPermissions={effectivePermissionKeys(profile.role, permissionsByProfile.get(profile.id) ?? [])}
                      disabledReason={
                        profile.id === context.userId
                          ? "Du kannst deine eigenen Rechte nicht bearbeiten."
                          : profile.role === "admin" || profile.role === "chef"
                            ? "Systemadmin und Chef werden über ihre Rolle gesteuert. Einzelrechte gelten nur für operative Nutzer."
                            : undefined
                      }
                    />
                  </div>
                  <form action={updateEmployeeAction}>
                    <input type="hidden" name="id" value={profile.id} />
                    <input type="hidden" name="company_id" value={profile.company_id} />
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
