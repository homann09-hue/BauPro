"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, ShieldCheck } from "lucide-react";
import { FormDraftAutosave } from "@/components/offline/form-draft-autosave";
import { SubmitButton } from "@/components/submit-button";
import { VoiceInputField } from "@/components/voice/VoiceInputField";
import { VoiceTextarea } from "@/components/voice/VoiceTextarea";
import { WeatherSuggestionField } from "@/components/weather/WeatherSuggestionField";
import {
  breakMinuteOptions,
  buildHalfHourTimeOptions,
  calculateTimeMinutes,
  cycleOption,
  formatMinutesAsHours
} from "@/lib/time-tracking";
import type { Jobsite, Profile, TimeEntry } from "@/types/app";

export function TimeEntryForm({
  action,
  entry,
  jobsites,
  employees,
  canManage,
  currentUserId,
  submitLabel,
  defaultDate,
  defaultJobsiteId,
  existingDailyNetMinutes = 0
}: {
  action: (formData: FormData) => Promise<void>;
  entry?: TimeEntry;
  jobsites: Jobsite[];
  employees: Profile[];
  canManage: boolean;
  currentUserId: string;
  submitLabel: string;
  defaultDate?: string;
  defaultJobsiteId?: string;
  existingDailyNetMinutes?: number;
}) {
  const selectedEmployeeId = entry?.employee_id ?? currentUserId;
  const initialJobId = entry?.job_id ?? defaultJobsiteId ?? "";
  const initialJobsite = jobsites.find((jobsite) => jobsite.id === initialJobId);
  const [jobId, setJobId] = useState(initialJobId);
  const [workLocation, setWorkLocation] = useState(entry?.work_location ?? initialJobsite?.name ?? "");
  const [workAddress, setWorkAddress] = useState(entry?.work_address ?? initialJobsite?.address ?? "");
  const [startTime, setStartTime] = useState(entry?.start_time?.slice(0, 5) ?? "07:00");
  const [endTime, setEndTime] = useState(entry?.end_time?.slice(0, 5) ?? "16:00");
  const [breakMinutes, setBreakMinutes] = useState(String(entry?.break_minutes ?? 30));
  const timeOptions = useMemo(() => buildHalfHourTimeOptions(), []);
  const pauseOptions = useMemo(() => breakMinuteOptions.map(String), []);
  const calculated = useMemo(() => {
    try {
      return calculateTimeMinutes({ startTime, endTime, breakMinutes: Number(breakMinutes) });
    } catch {
      return null;
    }
  }, [breakMinutes, endTime, startTime]);
  const dailyTotal = existingDailyNetMinutes + (calculated?.netMinutes ?? 0);

  function updateJobsite(nextJobId: string) {
    setJobId(nextJobId);
    const jobsite = jobsites.find((item) => item.id === nextJobId);
    setWorkLocation(jobsite?.name ?? "");
    setWorkAddress(jobsite?.address ?? "");
  }

  return (
    <form id="time-entry-form" action={action} className="space-y-4" data-testid="time-entry-form">
      {entry ? <input type="hidden" name="id" value={entry.id} /> : null}
      <input type="hidden" name="return_to" value={entry ? `/time-tracking/${entry.id}/edit` : "/time/new"} />
      <FormDraftAutosave
        formId="time-entry-form"
        storageKey={`baupro:time-entry:${entry?.id ?? "new"}:${currentUserId}`}
        offlineActionEndpoint="/api/offline/time-entry"
        description="Zeiten, Baustelle und Beschreibung werden auf diesem Gerät zwischengespeichert, falls der Empfang auf der Baustelle abreißt."
      />

      <section className="surface-strong construction-rail p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-white">
            <Clock3 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="section-kicker">Baustellen-Zeit</p>
            <h2 className="section-title">Schnell eintragen</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Große Felder, 30-Minuten-Schritte und Spracheingabe für wenig Tippen auf der Baustelle.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="field-label">Datum</span>
            <input className="field-input min-h-14 text-base" name="date" type="date" defaultValue={entry?.date ?? defaultDate ?? ""} required />
          </label>

          <div>
            <label className="field-label" htmlFor="employee_id">
              Mitarbeiter
            </label>
            {canManage ? (
              <select className="field-input min-h-14 text-base" id="employee_id" name="employee_id" defaultValue={selectedEmployeeId} required>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name || employee.email || "Mitarbeiter"}
                  </option>
                ))}
              </select>
            ) : (
              <div className="field-input min-h-14 bg-slate-50 text-base">
                <input type="hidden" name="employee_id" value={currentUserId} />
                {employees.find((employee) => employee.id === currentUserId)?.full_name ||
                  employees.find((employee) => employee.id === currentUserId)?.email ||
                  "Du"}
              </div>
            )}
          </div>

          <label className="sm:col-span-2">
            <span className="field-label">Baustelle / Auftrag</span>
            <select className="field-input min-h-14 text-base" name="job_id" value={jobId} onChange={(event) => updateJobsite(event.target.value)} required>
              <option value="">Baustelle auswählen</option>
              {jobsites.map((jobsite) => (
                <option key={jobsite.id} value={jobsite.id}>
                  {jobsite.name} - {jobsite.customer}
                </option>
              ))}
            </select>
            {defaultJobsiteId && !entry ? <p className="field-help">Vorauswahl aus deiner zugeordneten aktiven Baustelle.</p> : null}
          </label>
        </div>
      </section>

      <section className="surface p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="section-title">Arbeitszeit</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CyclicOptionField label="Beginn" name="start_time" options={timeOptions} value={startTime} onChange={setStartTime} />
          <CyclicOptionField label="Ende" name="end_time" options={timeOptions} value={endTime} onChange={setEndTime} />
          <CyclicOptionField
            label="Pause"
            name="break_minutes"
            options={pauseOptions}
            value={breakMinutes}
            onChange={setBreakMinutes}
            displayValue={(value) => `${value} Min.`}
            className="col-span-2 sm:col-span-1"
          />
          <label className="col-span-2 sm:col-span-1">
            <span className="field-label">Kilometer optional</span>
            <input className="field-input min-h-14 text-base" name="kilometers" inputMode="decimal" defaultValue={entry?.kilometers ?? ""} />
          </label>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <TimeMetric label="Bruttozeit" value={calculated ? formatMinutesAsHours(calculated.grossMinutes) : "prüfen"} />
          <TimeMetric label="Nettozeit" value={calculated ? formatMinutesAsHours(calculated.netMinutes) : "prüfen"} highlight />
          <TimeMetric label="Tagesgesamt" value={formatMinutesAsHours(dailyTotal)} />
        </div>
        {!calculated ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            Endzeit muss nach Startzeit liegen und die Pause darf nicht laenger als die Arbeitszeit sein.
          </p>
        ) : null}
      </section>

      <section className="surface p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="section-title">Ort und Beschreibung</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <VoiceInputField
            label="Ort / Baustellenname"
            name="work_location"
            value={workLocation}
            onValueChange={setWorkLocation}
            placeholder="Wird sonst aus der Baustelle übernommen"
          />
          <VoiceInputField
            label="Baustellenadresse"
            name="work_address"
            value={workAddress}
            onValueChange={setWorkAddress}
            placeholder="Wird sonst aus der Baustelle übernommen"
          />
          <VoiceInputField
            label="Aenderungsgrund"
            name="change_reason"
            defaultValue=""
            placeholder={entry ? "z. B. Uhrzeit korrigiert" : "Optional"}
          />
        </div>

        <div className="mt-4 grid gap-4">
          <VoiceTextarea
            label="Tätigkeit / Beschreibung"
            name="activity"
            defaultValue={entry?.activity ?? ""}
            rows={5}
            required
            placeholder="z. B. Unterspannbahn verlegt, Lattung entfernt, Ortgang vorbereitet"
          />
          <VoiceTextarea label="Notizen optional" name="notes" defaultValue={entry?.notes ?? ""} rows={4} placeholder="Hinweise für Chef, Material, Kunde oder morgen" />
        </div>
      </section>

      <WeatherSuggestionField
        jobFieldName="job_id"
        dateFieldName="date"
        canManage={canManage}
        defaultWeather={{
          summary: entry?.weather_summary ?? entry?.weather,
          temperatureC: entry?.weather_temperature_c,
          precipitationMm: entry?.weather_precipitation_mm,
          windKmh: entry?.weather_wind_kmh,
          source: entry?.weather_source,
          fetchedAt: entry?.weather_fetched_at,
          lat: entry?.weather_lat,
          lng: entry?.weather_lng
        }}
      />

      {canManage ? (
        <section className="surface p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="section-title">Chef-Status</h2>
          </div>
          <select className="field-input min-h-14 text-base" name="status" defaultValue={entry?.status ?? "submitted"}>
            <option value="draft">Entwurf</option>
            <option value="submitted">Eingereicht</option>
            <option value="approved">Freigegeben</option>
            <option value="rejected">Abgelehnt</option>
          </select>
          <div className="mt-4 flex justify-end">
            <SubmitButton className="w-full sm:w-auto">{submitLabel}</SubmitButton>
          </div>
        </section>
      ) : (
        <div className="sticky bottom-20 z-10 grid gap-2 rounded-lg border border-line bg-white/95 p-3 shadow-lift backdrop-blur sm:static sm:grid-cols-2 sm:bg-transparent sm:p-0 sm:shadow-none">
          <SubmitButton variant="secondary" className="w-full" name="status" value="draft">
            Als Entwurf speichern
          </SubmitButton>
          <SubmitButton className="w-full" name="status" value="submitted">
            Einreichen
          </SubmitButton>
        </div>
      )}
    </form>
  );
}

function TimeMetric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={highlight ? "rounded-md border border-primary/20 bg-mint p-3" : "rounded-md border border-line bg-white p-3"}>
      <p className="meta-label">{label}</p>
      <p className="mt-1 text-xl font-black text-ink">{value}</p>
    </div>
  );
}

function CyclicOptionField({
  label,
  name,
  options,
  value,
  onChange,
  displayValue = (current) => current,
  className
}: {
  label: string;
  name: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  displayValue?: (value: string) => string;
  className?: string;
}) {
  function change(direction: -1 | 1) {
    onChange(cycleOption(options, value, direction));
  }

  return (
    <div className={className}>
      <span className="field-label">{label}</span>
      <input type="hidden" name={name} value={value} />
      <div className="grid min-h-14 grid-cols-[48px_1fr_48px] overflow-hidden rounded-md border border-line bg-white shadow-sm">
        <button
          type="button"
          onClick={() => change(-1)}
          className="flex items-center justify-center border-r border-line bg-fog text-ink transition hover:bg-mint focus:outline-none focus:ring-4 focus:ring-primary/15"
          aria-label={`${label} niedriger`}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="flex items-center justify-center px-2 text-center text-lg font-black text-ink tabular-nums">
          {displayValue(value)}
        </div>
        <button
          type="button"
          onClick={() => change(1)}
          className="flex items-center justify-center border-l border-line bg-fog text-ink transition hover:bg-mint focus:outline-none focus:ring-4 focus:ring-primary/15"
          aria-label={`${label} hoeher`}
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
