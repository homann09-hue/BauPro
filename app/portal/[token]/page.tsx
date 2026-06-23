/* eslint-disable @next/next/no-img-element */
import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardList,
  CloudSun,
  Download,
  FileSignature,
  FileText,
  LockKeyhole,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  ShieldCheck,
  UserRound,
  XCircle
} from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { PortalAssetPrefetch } from "@/components/performance/PortalAssetPrefetch";
import { SignaturePad } from "@/components/signature/signature-pad";
import { sendCustomerPortalMessageAction, signWorkOrderFromPortalAction } from "@/lib/actions/customer-portal-actions";
import {
  loadCustomerPortalData,
  type PortalCommercialDocument,
  type PortalDefect,
  type PortalOrder,
  type PortalReport,
  type PortalWorkOrder
} from "@/lib/customer-portal/tokens";
import { customerDisplayName } from "@/lib/order-labels";
import { defectPriorityLabels, defectStatusLabels } from "@/lib/defects";
import { SafeActionError } from "@/lib/security/errors";
import { logServerWarning } from "@/lib/security/logging";
import { getClientIp } from "@/lib/security/origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { formatDate, formatDateTime, formatMoney, searchParamMessage } from "@/lib/utils";

const workOrderStatusLabels = {
  draft: "Entwurf",
  sent: "Gesendet",
  viewed: "Gesehen",
  signed: "Unterschrieben",
  rejected: "Abgelehnt"
} as const;

const orderStatusLabels: Record<string, string> = {
  anfrage: "Anfrage",
  angebot: "Angebot",
  geplant: "Geplant",
  in_arbeit: "In Arbeit",
  fertig: "Fertig",
  abgerechnet: "Abgerechnet"
};

const commercialDocumentTypeLabels: Record<string, string> = {
  quote: "Angebot",
  invoice: "Rechnung"
};

export default async function CustomerPortalPage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const { error, success } = searchParamMessage(await searchParams);
  const clientIp = getClientIp(await headers());
  let portal = null;

  try {
    await checkRateLimit(`portal-view:${clientIp}`, 30, 60_000);
  } catch (rateLimitError) {
    if (rateLimitError instanceof SafeActionError) return <PortalAccessUnavailable />;
    throw rateLimitError;
  }

  try {
    portal = await loadCustomerPortalData(token);
  } catch (loadError) {
    logServerWarning("customer-portal-load-failed", loadError);
  }

  if (!portal) return <PortalAccessUnavailable />;

  const customerName = customerDisplayName(portal.customer);
  const prefetchAssetUrls = [
    ...portal.photos.map((photo) => photo.signedUrl).filter((url): url is string => Boolean(url)),
    ...portal.documents.map((document) => document.signedUrl).filter((url): url is string => Boolean(url)),
    ...portal.jobsiteDocuments.map((document) => document.signedUrl).filter((url): url is string => Boolean(url))
  ];
  const signedOrOpenWorkOrders = portal.workOrders.filter((workOrder) => workOrder.status !== "draft");
  const nextAppointment = portal.appointments[0] ?? null;
  const latestUpdate = portal.events[0] ?? null;

  return (
    <main className="min-h-screen bg-fog text-ink">
      <PortalAssetPrefetch urls={prefetchAssetUrls} />
      <section className="border-b border-slate-800 bg-anthracite text-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-black text-white">
                <Building2 className="h-4 w-4 text-mint" aria-hidden="true" />
                {portal.company.name}
              </div>
              <p className="text-sm font-bold uppercase tracking-normal text-mint">Sicherer Kundenbereich</p>
              <h1 className="mt-2 text-3xl font-black tracking-normal sm:text-4xl">{portal.jobsite?.name ?? "Ihr Auftrag"}</h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/75">
                Hallo {customerName}, hier sehen Sie den freigegebenen Projektstand, Termine, Fotos, Dokumente und offene Freigaben.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 p-4 lg:min-w-80">
              <p className="text-xs font-black uppercase tracking-normal text-white/60">Projektstatus</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-3xl font-black">{portal.progressPercent}%</p>
                <span className="rounded-md bg-mint px-2.5 py-1 text-xs font-black text-primary-dark">
                  {portal.jobsite?.status ?? "in Bearbeitung"}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-mint" style={{ width: `${portal.progressPercent}%` }} />
              </div>
              <p className="mt-3 flex gap-2 text-sm font-semibold text-white/80">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-mint" aria-hidden="true" />
                {portal.jobsite?.address ?? "Adresse wird vom Betrieb gepflegt"}
              </p>
              {nextAppointment ? (
                <p className="mt-2 flex gap-2 text-sm font-semibold text-white/80">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-mint" aria-hidden="true" />
                  Nächster Termin: {nextAppointment.title}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <MessageBox error={error} success={success} />

        <PortalQuickNav />

        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Fortschritt" value={`${portal.progressPercent}%`} icon={<ShieldCheck className="h-5 w-5" />} />
          <MetricCard label="Freigegebene Fotos" value={String(portal.photos.length)} icon={<Camera className="h-5 w-5" />} />
          <MetricCard label="Dokumente" value={String(portal.documents.length + portal.jobsiteDocuments.length)} icon={<FileText className="h-5 w-5" />} />
          <MetricCard label="Bautagesberichte" value={String(portal.reports.length)} icon={<ClipboardList className="h-5 w-5" />} />
        </div>

        <section className="mb-5 rounded-lg border border-primary/20 bg-mint p-4 text-primary-dark shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white text-primary shadow-sm">
                <LockKeyhole className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-black">Nur freigegebene Informationen</p>
                <p className="mt-1 text-sm leading-6 text-primary-dark/80">
                  Interne Notizen, Lagerdaten, EK-/VK-Preise und Mitarbeiterdetails bleiben im Betrieb.
                  Dieses Portal zeigt nur Inhalte, die bewusst für Kunden freigegeben wurden.
                </p>
              </div>
            </div>
            {latestUpdate ? (
              <div className="rounded-md bg-white/70 p-3 text-sm font-semibold text-primary-dark lg:min-w-72">
                <span className="text-xs font-black uppercase tracking-normal text-primary/70">Letztes Update</span>
                <p className="mt-1">{latestUpdate.title}</p>
              </div>
            ) : null}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <section className="space-y-5">
            <section id="freigaben" className="surface p-4 sm:p-5">
              <SectionTitle
                icon={<FileSignature className="h-6 w-6 text-primary" aria-hidden="true" />}
                title="Arbeitsaufträge unterschreiben"
                description="Bitte prüfen und bestätigen Sie nur, wenn alles passt."
              />
              {signedOrOpenWorkOrders.length === 0 ? (
                <EmptyText text="Aktuell liegt kein Arbeitsauftrag zur Freigabe vor." />
              ) : (
                <div className="space-y-4">
                  {signedOrOpenWorkOrders.map((workOrder) => (
                    <WorkOrderCard key={workOrder.id} token={token} workOrder={workOrder} />
                  ))}
                </div>
              )}
            </section>

            <section id="berichte" className="surface p-4 sm:p-5">
              <SectionTitle
                icon={<ClipboardList className="h-6 w-6 text-primary" aria-hidden="true" />}
                title="Freigegebene Bautagesberichte"
                description="Nur geprüfte und für Kunden freigegebene Berichte erscheinen hier."
              />
              {portal.reports.length === 0 ? (
                <EmptyText text="Noch kein Bautagesbericht für den Kundenbereich freigegeben." />
              ) : (
                <div className="grid gap-3">
                  {portal.reports.map((report) => (
                    <ReportCard key={report.id} report={report} />
                  ))}
                </div>
              )}
            </section>

            <section id="maengel" className="surface p-4 sm:p-5">
              <SectionTitle
                icon={<AlertTriangle className="h-6 w-6 text-primary" aria-hidden="true" />}
                title="Freigegebene Mängel und offene Punkte"
                description="Nur vom Betrieb freigegebene Punkte erscheinen im Kundenbereich."
              />
              {portal.defects.length === 0 ? (
                <EmptyText text="Aktuell sind keine Mängel für den Kundenbereich freigegeben." />
              ) : (
                <div className="grid gap-3">
                  {portal.defects.map((defect) => (
                    <PortalDefectCard key={defect.id} defect={defect} />
                  ))}
                </div>
              )}
            </section>

            <section id="fotos" className="surface p-4 sm:p-5">
              <SectionTitle
                icon={<Camera className="h-6 w-6 text-primary" aria-hidden="true" />}
                title="Freigegebene Fotos"
                description="Der Betrieb gibt Bilder einzeln für den Kundenbereich frei."
              />
              {portal.photos.length === 0 ? (
                <EmptyText text="Noch keine Fotos für den Kundenbereich freigegeben." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {portal.photos.map((photo) => (
                    <a key={photo.id} href={photo.signedUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-line bg-white">
                      {photo.signedUrl ? (
                        <img
                          src={photo.signedUrl}
                          alt={photo.customer_caption || "Baustellenfoto"}
                          className="h-52 w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : null}
                      <div className="p-3">
                        <p className="text-sm font-black text-ink">{photo.customer_caption || "Baustellenfoto"}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">Freigegeben am {formatDateTime(photo.approved_at)}</p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </section>

            <section id="auftraege" className="surface p-4 sm:p-5">
              <SectionTitle
                icon={<BriefcaseBusiness className="h-6 w-6 text-primary" aria-hidden="true" />}
                title="Aufträge, Angebote und Rechnungen"
                description="Kundensicht auf freigegebene Auftrags- und Dokumentdaten."
              />
              {portal.orders.length === 0 && portal.commercialDocuments.length === 0 ? (
                <EmptyText text="Noch keine freigegebenen Auftrags- oder Rechnungsdaten." />
              ) : (
                <div className="grid gap-3">
                  {portal.orders.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                  {portal.commercialDocuments.map((document) => (
                    <CommercialDocumentCard key={document.id} document={document} />
                  ))}
                </div>
              )}
            </section>
          </section>

          <aside className="space-y-5">
            <section id="termine" className="surface p-4 sm:p-5">
              <p className="meta-label">Projekt</p>
              <h2 className="mt-1 text-xl font-black text-ink">{portal.jobsite?.name ?? "Auftrag"}</h2>
              <div className="mt-4 space-y-3 text-sm font-semibold text-slate-700">
                <p className="flex gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  {portal.jobsite?.address ?? "Keine Adresse hinterlegt"}
                </p>
                <p>Start: {formatDate(portal.jobsite?.start_date)}</p>
                <p>Kunde: {customerName}</p>
              </div>
            </section>

            <section id="updates" className="surface p-4 sm:p-5">
              <SectionTitle
                icon={<UserRound className="h-5 w-5 text-primary" aria-hidden="true" />}
                title="Ansprechpartner"
                description="Bei Fragen direkt den Betrieb kontaktieren."
              />
              <div className="mt-3 grid gap-2">
                {portal.company.phone ? (
                  <a href={`tel:${portal.company.phone}`} className="btn-secondary w-full justify-start">
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    {portal.company.phone}
                  </a>
                ) : null}
                {portal.company.contact_email ? (
                  <a href={`mailto:${portal.company.contact_email}`} className="btn-secondary w-full justify-start">
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    {portal.company.contact_email}
                  </a>
                ) : null}
                {!portal.company.phone && !portal.company.contact_email ? <EmptyText text="Kontakt wird vom Betrieb gepflegt." /> : null}
              </div>
            </section>

            <section className="surface p-4 sm:p-5">
              <SectionTitle
                icon={<CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />}
                title="Termine"
                description="Vom Betrieb freigegebene Terminupdates."
              />
              {portal.appointments.length === 0 ? (
                <EmptyText text="Keine Termine im Kundenportal hinterlegt." />
              ) : (
                <Timeline events={portal.appointments} />
              )}
            </section>

            <section className="surface p-4 sm:p-5">
              <SectionTitle
                icon={<CloudSun className="h-5 w-5 text-primary" aria-hidden="true" />}
                title="Wetterhinweise"
                description="Relevante Hinweise zu Wetter und Verzögerungen."
              />
              {portal.weatherDelays.length === 0 ? (
                <EmptyText text="Keine wetterbedingten Hinweise hinterlegt." />
              ) : (
                <div className="mt-3 space-y-2">
                  {portal.weatherDelays.map((entry) => (
                    <div key={entry.id} className="rounded-md border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-black text-amber-900">{entry.title}</p>
                      {entry.body ? <p className="mt-1 text-sm text-amber-900/80">{entry.body}</p> : null}
                      <p className="mt-2 text-xs font-semibold text-amber-800">{formatDateTime(entry.date)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="surface p-4 sm:p-5">
              <h2 className="section-title">Updates</h2>
              {portal.events.length === 0 ? <EmptyText text="Noch keine freigegebenen Updates." /> : <Timeline events={portal.events} />}
            </section>

            <DocumentSection
              customerDocuments={portal.documents}
              jobsiteDocuments={portal.jobsiteDocuments}
            />

            <section id="fragen" className="surface p-4 sm:p-5">
              <SectionTitle
                icon={<MessageSquareText className="h-5 w-5 text-primary" aria-hidden="true" />}
                title="Fragen & Antworten"
                description="Ihre Nachricht geht direkt an den Betrieb und bleibt beim Projekt."
              />
              <form action={sendCustomerPortalMessageAction} className="mt-4 grid gap-3">
                <input type="hidden" name="token" value={token} />
                <label>
                  <span className="field-label">Ihr Name</span>
                  <input className="field-input" name="sender_name" required maxLength={120} defaultValue={customerName} />
                </label>
                <label>
                  <span className="field-label">E-Mail optional</span>
                  <input className="field-input" name="sender_email" type="email" maxLength={180} defaultValue={portal.customer.email ?? ""} />
                </label>
                <label>
                  <span className="field-label">Nachricht</span>
                  <textarea
                    className="field-input min-h-28"
                    name="message"
                    required
                    maxLength={2000}
                    placeholder="Ihre Frage zur Baustelle, zum Termin oder zum Dokument..."
                  />
                </label>
                <label className="flex items-start gap-2 rounded-md border border-line bg-fog p-3 text-xs font-semibold text-slate-600">
                  <input className="mt-0.5 h-4 w-4 rounded border-line text-primary" name="privacy_ack" type="checkbox" required />
                  Ich bin einverstanden, dass diese Nachricht zur Bearbeitung meines Bauprojekts gespeichert wird.
                </label>
                <button className="btn-primary" type="submit">
                  <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                  Nachricht senden
                </button>
              </form>
              {portal.messages.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <p className="meta-label">Gesendete Fragen</p>
                  {portal.messages.slice(0, 4).map((message) => (
                    <div key={message.id} className="rounded-md border border-line bg-fog p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-ink">{message.message}</p>
                        <span className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-black text-slate-600">
                          {message.status === "answered" ? "Beantwortet" : "Offen"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        Gesendet am {formatDateTime(message.created_at)}
                        {message.answered_at ? ` · beantwortet am ${formatDateTime(message.answered_at)}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function PortalAccessUnavailable() {
  return (
    <main className="min-h-screen bg-fog px-4 py-10 text-ink">
      <section className="mx-auto max-w-xl rounded-lg border border-line bg-white p-6 shadow-soft">
        <p className="section-kicker">Kundenportal</p>
        <h1 className="mt-2 text-2xl font-black">Portal-Link ist abgelaufen oder ungültig.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Bitte warte einen Moment und versuche es erneut. Wenn das Problem bleibt, fordere beim Handwerksbetrieb einen neuen Link an.
        </p>
        <Link href="/login" className="btn-secondary mt-5">
          Zur Anmeldung
        </Link>
      </section>
    </main>
  );
}

function PortalQuickNav() {
  const links = [
    { href: "#freigaben", label: "Freigaben" },
    { href: "#termine", label: "Termine" },
    { href: "#berichte", label: "Berichte" },
    { href: "#fotos", label: "Fotos" },
    { href: "#fragen", label: "Frage senden" }
  ];

  return (
    <nav className="mb-5 overflow-x-auto rounded-lg border border-line bg-white p-2 shadow-sm" aria-label="Kundenportal Bereiche">
      <div className="flex min-w-max gap-2">
        {links.map((link) => (
          <a key={link.href} href={link.href} className="rounded-md bg-fog px-3 py-2 text-sm font-black text-slate-700 hover:bg-mint hover:text-primary">
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="meta-label">{label}</p>
          <p className="mt-1 text-2xl font-black text-ink">{value}</p>
        </div>
        <div className="rounded-md bg-mint p-2 text-primary">{icon}</div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <h2 className="section-title">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="mt-3 rounded-md border border-dashed border-line p-4 text-sm font-semibold text-slate-600">{text}</p>;
}

function Timeline({ events }: { events: Array<{ id: string; title: string; body: string | null; event_date: string }> }) {
  return (
    <div className="mt-4 space-y-3">
      {events.map((event) => (
        <div key={event.id} className="rounded-md border border-line bg-fog p-3">
          <p className="text-sm font-black text-ink">{event.title}</p>
          {event.body ? <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{event.body}</p> : null}
          <p className="mt-2 text-xs font-semibold text-slate-500">{formatDateTime(event.event_date)}</p>
        </div>
      ))}
    </div>
  );
}

function ReportCard({ report }: { report: PortalReport }) {
  return (
    <article className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black text-ink">Bautagesbericht vom {formatDate(report.report_date)}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Freigegeben am {formatDateTime(report.customer_released_at)}</p>
        </div>
        <span className="rounded-md bg-mint px-2.5 py-1 text-xs font-black text-primary">Freigegeben</span>
      </div>
      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
        {report.customer_summary || report.activities}
      </p>
      {report.weather_summary ? (
        <div className="mt-3 rounded-md border border-primary/20 bg-mint p-3 text-sm font-semibold text-primary-dark">
          <CloudSun className="mr-2 inline h-4 w-4" aria-hidden="true" />
          {report.weather_summary}
        </div>
      ) : null}
      {report.material_usage ? <p className="mt-3 text-sm text-slate-600">Material: {report.material_usage}</p> : null}
      {report.machine_usage ? <p className="mt-1 text-sm text-slate-600">Maschinen/Fahrzeuge: {report.machine_usage}</p> : null}
    </article>
  );
}

function PortalDefectCard({ defect }: { defect: PortalDefect }) {
  return (
    <article className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black text-ink">{defect.title}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Freigegeben am {formatDateTime(defect.customer_released_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md bg-fog px-2.5 py-1 text-xs font-black text-slate-700">
            {defectStatusLabels[defect.status]}
          </span>
          <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">
            {defectPriorityLabels[defect.priority]}
          </span>
        </div>
      </div>
      {defect.description ? <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{defect.description}</p> : null}
      {defect.due_date ? <p className="mt-3 text-xs font-semibold text-slate-500">Geplante Klärung bis {formatDate(defect.due_date)}</p> : null}
    </article>
  );
}

function OrderCard({ order }: { order: PortalOrder }) {
  return (
    <article className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black text-ink">{order.title}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Auftrag {order.order_number}</p>
        </div>
        <span className="rounded-md bg-fog px-2.5 py-1 text-xs font-black text-slate-700">
          {orderStatusLabels[order.status] ?? order.status}
        </span>
      </div>
      {order.description ? <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{order.description}</p> : null}
      <p className="mt-3 text-xs font-semibold text-slate-500">
        Zeitraum: {formatDate(order.start_date)} - {formatDate(order.end_date)}
      </p>
    </article>
  );
}

function CommercialDocumentCard({ document }: { document: PortalCommercialDocument }) {
  return (
    <article className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black text-ink">{document.subject}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {commercialDocumentTypeLabels[document.document_type] ?? "Dokument"} {document.document_number}
          </p>
        </div>
        <span className="rounded-md bg-mint px-2.5 py-1 text-xs font-black text-primary-dark">
          {formatMoney(document.total_gross)}
        </span>
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-500">
        Datum: {formatDate(document.issue_date)}
        {document.valid_until ? ` · Gültig bis ${formatDate(document.valid_until)}` : ""}
      </p>
    </article>
  );
}

function DocumentSection({
  customerDocuments,
  jobsiteDocuments
}: {
  customerDocuments: Array<{ id: string; title: string; signedUrl?: string }>;
  jobsiteDocuments: Array<{ id: string; title: string; signedUrl?: string }>;
}) {
  const hasDocuments = customerDocuments.length > 0 || jobsiteDocuments.length > 0;

  if (!hasDocuments) return null;

  return (
    <section className="surface p-4 sm:p-5">
      <h2 className="section-title">Dokumente</h2>
      <div className="mt-3 space-y-2">
        {customerDocuments.map((document) => (
          <a key={document.id} href={document.signedUrl} target="_blank" rel="noreferrer" className="btn-secondary w-full justify-start">
            <Download className="h-4 w-4" aria-hidden="true" />
            {document.title}
          </a>
        ))}
        {jobsiteDocuments.map((document) => (
          <a key={document.id} href={document.signedUrl} target="_blank" rel="noreferrer" className="btn-secondary w-full justify-start">
            <Download className="h-4 w-4" aria-hidden="true" />
            {document.title}
          </a>
        ))}
      </div>
    </section>
  );
}

function WorkOrderCard({ token, workOrder }: { token: string; workOrder: PortalWorkOrder }) {
  const isOpen = workOrder.status === "sent" || workOrder.status === "viewed";
  return (
    <article className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-lg font-black text-ink">{workOrder.title}</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Version {workOrder.version} · {workOrderStatusLabels[workOrder.status]}
          </p>
        </div>
        <span className={`rounded-md px-2 py-1 text-xs font-black ${workOrder.status === "signed" ? "bg-mint text-primary" : workOrder.status === "rejected" ? "bg-red-50 text-red-700" : "bg-fog text-slate-700"}`}>
          {workOrderStatusLabels[workOrder.status]}
        </span>
      </div>
      {workOrder.description ? <p className="mt-3 text-sm font-semibold text-slate-700">{workOrder.description}</p> : null}
      <div className="mt-3 whitespace-pre-line rounded-md bg-fog p-3 text-sm leading-6 text-slate-700">{workOrder.scope_of_work}</div>
      {workOrder.price_note ? (
        <p className="mt-3 rounded-md border border-line bg-white p-3 text-sm font-semibold text-slate-700">{workOrder.price_note}</p>
      ) : null}

      {workOrder.status === "signed" ? (
        <div className="mt-4 rounded-md bg-mint p-3 text-sm font-semibold text-primary">
          <CheckCircle2 className="mr-2 inline h-4 w-4" aria-hidden="true" />
          Unterschrieben von {workOrder.signer_name || "Kunde"} am {formatDateTime(workOrder.signed_at)}.
          {workOrder.signature_data_url ? (
            <img
              src={workOrder.signature_data_url}
              alt="Gespeicherte Unterschrift"
              className="mt-3 h-20 max-w-xs rounded-md border border-primary/20 bg-white object-contain p-2"
              loading="lazy"
              decoding="async"
            />
          ) : null}
          <Link href={`/portal/${encodeURIComponent(token)}/work-orders/${workOrder.id}/pdf`} className="mt-3 inline-flex font-black underline">
            PDF herunterladen
          </Link>
        </div>
      ) : null}

      {workOrder.status === "rejected" ? (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">
          <XCircle className="mr-2 inline h-4 w-4" aria-hidden="true" />
          Abgelehnt: {workOrder.rejection_reason || "Keine Begründung angegeben."}
        </div>
      ) : null}

      {isOpen ? (
        <form action={signWorkOrderFromPortalAction} className="mt-4 grid gap-3 rounded-lg border border-line bg-fog p-3" data-testid="portal-work-order-sign-form">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="work_order_id" value={workOrder.id} />
          <label>
            <span className="field-label">Ihr Name</span>
            <input className="field-input" name="signer_name" required maxLength={120} placeholder="Vor- und Nachname" />
          </label>
          <SignaturePad label="Unterschrift für Bestätigung" required />
          <label>
            <span className="field-label">Rückmeldung bei Ablehnung</span>
            <textarea
              className="field-input min-h-20"
              name="rejection_reason"
              maxLength={1000}
              placeholder="Bei Ablehnung bitte kurz angeben, was der Betrieb anpassen soll."
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button className="btn-primary" type="submit" name="decision" value="sign">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Auftrag bestätigen
            </button>
            <button className="btn-secondary" type="submit" name="decision" value="reject">
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Ablehnen
            </button>
          </div>
        </form>
      ) : null}
    </article>
  );
}
