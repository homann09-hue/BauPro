import { ShieldCheck, UserRound } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { updateOwnProfileAction } from "@/lib/actions/auth-actions";
import { requireAppContext } from "@/lib/auth";
import { searchParamMessage } from "@/lib/utils";

const roleLabels = {
  admin: "Admin",
  chef: "Chef",
  vorarbeiter: "Vorarbeiter",
  mitarbeiter: "Mitarbeiter",
  kunde: "Kunde"
};

export default async function ProfilePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const { error, success } = searchParamMessage(await searchParams);

  return (
    <>
      <PageHeader title="Profil" description="Dein Zugang, deine Rolle und sichtbare App-Bereiche." />
      <MessageBox error={error} success={success} />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <section className="surface p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-mint text-moss">
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="meta-label">Benutzerkonto</p>
              <h2 className="section-title">{context.email}</h2>
            </div>
          </div>
          <form action={updateOwnProfileAction} className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input type="hidden" name="return_to" value="/profile" />
            <label>
              <span className="field-label">Name</span>
              <input className="field-input" name="full_name" defaultValue={context.profile.full_name ?? ""} required />
            </label>
            <button className="btn-primary self-end" type="submit">
              Speichern
            </button>
          </form>
        </section>

        <aside className="surface p-4 sm:p-5">
          <ShieldCheck className="mb-3 h-5 w-5 text-moss" aria-hidden="true" />
          <p className="meta-label">Rolle</p>
          <p className="mt-1 text-2xl font-black text-ink">{roleLabels[context.profile.role]}</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {context.canManage
              ? "Du kannst Betrieb, Team, Preise, Material, Aufträge und Exporte verwalten."
              : context.profile.role === "vorarbeiter"
                ? "Du koordinierst deine zugeordneten Baustellen, Zeiten, Tagesberichte, Mitbringlisten und Materialmeldungen. Preise bleiben ausgeblendet."
              : "Du siehst deine Baustellen, Zeiten, Tagesberichte, Mitbringlisten und Materialmeldungen. Preise bleiben ausgeblendet."}
          </p>
        </aside>
      </div>
    </>
  );
}
