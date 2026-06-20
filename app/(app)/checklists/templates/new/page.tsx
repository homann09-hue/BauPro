import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ChecklistTemplateForm } from "@/components/forms/checklist-template-form";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { requireManager } from "@/lib/auth";
import { searchParamMessage } from "@/lib/utils";

export default async function NewChecklistTemplatePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManager();
  const { error, success } = searchParamMessage(await searchParams);

  return (
    <>
      <PageHeader
        title="Checklistenvorlage"
        description="Erstelle wiederverwendbare Vorlagen für Sicherheit, Baustart, Tagesabschluss, Abnahme, Material und Dacharbeiten."
      />
      <MessageBox error={error} success={success} />
      <div className="mb-4">
        <Link href="/checklists" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurück
        </Link>
      </div>
      <ChecklistTemplateForm />
    </>
  );
}
