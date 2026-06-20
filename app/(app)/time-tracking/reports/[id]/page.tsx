import Link from "next/link";
import { ArrowLeft, Download, FileSpreadsheet, FileText } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireManager } from "@/lib/auth";
import { loadTimeReportExportData } from "@/lib/time-report-export";
import { formatMinutesAsHours, formatTime, monthName, sumNetMinutes, timeReportStatusLabels } from "@/lib/time-tracking";
import { formatDate, formatDateTime, searchParamMessage } from "@/lib/utils";

export default async function TimeReportDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const { id } = await params;
  const { error, success } = searchParamMessage(await searchParams);
  const data = await loadTimeReportExportData(id, context.companyId);
  const totalMinutes = sumNetMinutes(data.entries);

  return (
    <>
      <PageHeader
        title="Stundenzettel"
        description={`${data.employee?.full_name || data.employee?.email || "Mitarbeiter"} · ${monthName(data.report.month)} ${data.report.year}`}
      />
      <MessageBox error={error} success={success} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/time-tracking/reports" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurück
        </Link>
        <a href={`/time-tracking/reports/${id}/pdf`} className="btn-primary">
          <Download className="h-4 w-4" aria-hidden="true" />
          PDF herunterladen
        </a>
        <a href={`/time-tracking/reports/${id}/csv`} className="btn-secondary">
          <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
          CSV herunterladen
        </a>
      </div>

      <section className="surface mb-5 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <p className="meta-label">Firma</p>
            <p className="mt-1 font-black text-ink">{data.company.name}</p>
          </div>
          <div>
            <p className="meta-label">Zeitraum</p>
            <p className="mt-1 font-black text-ink">
              {formatDate(data.report.date_from)} - {formatDate(data.report.date_to)}
            </p>
          </div>
          <div>
            <p className="meta-label">Summe</p>
            <p className="mt-1 font-black text-ink">{formatMinutesAsHours(totalMinutes)}</p>
          </div>
          <div>
            <p className="meta-label">Status</p>
            <div className="mt-1">
              <StatusBadge value={data.report.status} label={timeReportStatusLabels[data.report.status]} />
            </div>
          </div>
        </div>
        <p className="mt-4 rounded-md border border-line bg-fog p-3 text-sm text-slate-600">
          Automatisch erzeugter Stundenzettel aus digitaler Zeiterfassung. Keine Rechtsberatung.
          Erstellt am {formatDateTime(data.report.generated_at)} durch{" "}
          {data.generatedBy?.full_name || data.generatedBy?.email || "Chef/Admin"}.
        </p>
      </section>

      <section className="surface overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-line p-4">
          <FileText className="h-5 w-5 text-moss" aria-hidden="true" />
          <h2 className="text-lg font-black text-ink">Einträge</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-fog text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Baustelle</th>
                <th className="px-4 py-3">Ort</th>
                <th className="px-4 py-3">Beginn</th>
                <th className="px-4 py-3">Ende</th>
                <th className="px-4 py-3">Pause</th>
                <th className="px-4 py-3">Netto</th>
                <th className="px-4 py-3">Tätigkeit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.entries.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="px-4 py-3 font-semibold text-ink">{formatDate(entry.date)}</td>
                  <td className="px-4 py-3">{entry.jobsites?.name ?? entry.work_location}</td>
                  <td className="px-4 py-3">{entry.work_address}</td>
                  <td className="px-4 py-3">{formatTime(entry.start_time)}</td>
                  <td className="px-4 py-3">{formatTime(entry.end_time)}</td>
                  <td className="px-4 py-3">{entry.break_minutes} Min.</td>
                  <td className="px-4 py-3 font-black text-ink">{formatMinutesAsHours(entry.net_minutes)}</td>
                  <td className="px-4 py-3 max-w-sm">{entry.activity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
