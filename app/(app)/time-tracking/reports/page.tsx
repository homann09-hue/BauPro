import Link from "next/link";
import { ArrowLeft, CalendarDays, FileText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { createTimeReportAction } from "@/lib/actions/time-tracking-actions";
import { requireManager } from "@/lib/auth";
import { profileOptionSelect, timeReportListSelect } from "@/lib/data/selects";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { monthName, timeReportStatusLabels } from "@/lib/time-tracking";
import { formatDateTime, searchParamMessage } from "@/lib/utils";
import type { Profile, TimeReport } from "@/types/app";

const currentYear = new Date().getFullYear();

export default async function TimeReportsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);

  const [employeesResult, reportsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(profileOptionSelect)
      .eq("company_id", context.companyId)
      .eq("active", true)
      .in("role", ["mitarbeiter", "vorarbeiter"])
      .order("full_name"),
    supabase
      .from("time_reports")
      .select(timeReportListSelect)
      .eq("company_id", context.companyId)
      .order("generated_at", { ascending: false })
      .limit(40)
  ]);

  const employees = (employeesResult.data ?? []) as Profile[];
  const reports = (reportsResult.data ?? []) as unknown as TimeReport[];

  return (
    <>
      <PageHeader
        title="Stundenzettel"
        description="Monatsübersicht aus eingereichten oder freigegebenen Zeiten erstellen und exportieren."
      />
      <MessageBox
        error={error || safeQueryErrorMessage(employeesResult.error) || safeQueryErrorMessage(reportsResult.error)}
        success={success}
      />

      <div className="mb-4">
        <Link href="/time-tracking" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zu den Zeiten
        </Link>
      </div>

      <section className="surface mb-5 p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-moss" aria-hidden="true" />
          <h2 className="text-lg font-black text-ink">Monatsbericht erzeugen</h2>
        </div>
        <form action={createTimeReportAction} className="grid gap-3 md:grid-cols-[1fr_160px_160px_auto] md:items-end">
          <div>
            <label className="field-label" htmlFor="employee_id">
              Mitarbeiter
            </label>
            <select className="field-input" id="employee_id" name="employee_id" required>
              <option value="">Mitarbeiter auswählen</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name || employee.email || "Mitarbeiter"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="month">
              Monat
            </label>
            <select className="field-input" id="month" name="month" defaultValue={String(new Date().getMonth() + 1)}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={month}>
                  {monthName(month)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="year">
              Jahr
            </label>
            <input className="field-input" id="year" name="year" type="number" min="2000" max="2100" defaultValue={currentYear} />
          </div>
          <SubmitButton>Stundenzettel erstellen</SubmitButton>
        </form>
      </section>

      {reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Noch keine Stundenzettel"
          description="Erstelle den ersten Monatsbericht aus eingereichten oder freigegebenen Zeiten."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {reports.map((report) => (
            <Link key={report.id} href={`/time-tracking/reports/${report.id}`} className="interactive-surface block p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="meta-label">{formatDateTime(report.generated_at)}</p>
                  <h2 className="mt-1 text-lg font-black text-ink">
                    {report.profiles?.full_name || report.profiles?.email || "Mitarbeiter"}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {monthName(report.month)} {report.year}
                  </p>
                </div>
                <StatusBadge value={report.status} label={timeReportStatusLabels[report.status]} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
