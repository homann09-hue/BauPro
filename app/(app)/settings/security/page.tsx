import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { MfaSettingsPanel } from "@/components/mfa-settings-panel";
import { PageHeader } from "@/components/page-header";
import { listMfaFactorsAction } from "@/lib/actions/mfa-actions";
import { requireAdmin } from "@/lib/auth";
import { searchParamMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { error, success } = searchParamMessage(await searchParams);
  const factors = await listMfaFactorsAction();

  return (
    <>
      <PageHeader
        title="Sicherheit"
        description="Schütze privilegierte BauPro-Zugänge zusätzlich mit Zwei-Faktor-Authentifizierung."
      />
      <MessageBox error={error} success={success} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/settings" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurück zu Einstellungen
        </Link>
        <div className="inline-flex min-h-12 items-center gap-2 rounded-md border border-moss/20 bg-mint px-4 py-2 text-sm font-black text-moss">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Optional, aber empfohlen
        </div>
      </div>

      <MfaSettingsPanel factors={factors} />
    </>
  );
}
