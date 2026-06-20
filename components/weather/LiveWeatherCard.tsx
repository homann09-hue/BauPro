/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { CloudRain, CloudSun, ExternalLink, LocateFixed, MapPin, Navigation, Wind } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { geocodeJobsiteWeatherLocationAction } from "@/lib/actions/weather-actions";
import { cn, formatDateTime } from "@/lib/utils";
import {
  buildRadarTileSet,
  rainViewerMapUrl,
  type ActiveJobsiteDecision,
  type LiveWeatherData,
  type RadarFrame,
  type WeatherRiskLevel
} from "@/lib/weather/live-weather";

function weatherValue(value: number | null, suffix: string) {
  return value === null ? "-" : `${value}${suffix}`;
}

const riskStyles: Record<WeatherRiskLevel, { label: string; className: string; dot: string }> = {
  green: {
    label: "Alles okay",
    className: "bg-primary/10 text-primary-dark ring-primary/20",
    dot: "bg-primary"
  },
  yellow: {
    label: "Aufpassen",
    className: "bg-warning/15 text-amber-900 ring-warning/30",
    dot: "bg-warning"
  },
  red: {
    label: "Kritisch",
    className: "bg-red-50 text-danger ring-red-200",
    dot: "bg-danger"
  }
};

export function LiveWeatherCard({
  decision,
  weather,
  radarFrames,
  error
}: {
  decision: ActiveJobsiteDecision;
  weather: LiveWeatherData | null;
  radarFrames: RadarFrame[];
  error?: string | null;
}) {
  const jobsite = decision.jobsite;
  const lat = jobsite?.latitude;
  const lng = jobsite?.longitude;
  const hasCoordinates = typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng);
  const radarFrame = radarFrames[0] ?? null;
  const tileSet = hasCoordinates ? buildRadarTileSet({ lat, lng, frame: radarFrame }) : null;
  const risk = weather ? riskStyles[weather.riskLevel] : null;

  return (
    <section className="dashboard-band overflow-hidden p-0">
      <div className="border-b border-line bg-anthracite p-4 text-white sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="section-kicker text-warning">Chef-Zentrale</p>
            <h2 className="mt-1 flex items-center gap-2 text-xl font-black text-white">
              <CloudSun className="h-5 w-5 text-warning" aria-hidden="true" />
              Live-Wetter aktive Baustelle
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Fokus: Kann heute gearbeitet werden und kommt Regen rein?
            </p>
          </div>
          {risk ? (
            <span className={cn("inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-black ring-1", risk.className)}>
              <span className={cn("h-2 w-2 rounded-full", risk.dot)} aria-hidden="true" />
              {risk.label}
            </span>
          ) : null}
        </div>
      </div>

      {!jobsite ? (
        <div className="p-4 sm:p-5">
          <p className="rounded-md border border-dashed border-line bg-white p-4 text-sm text-slate-600">
            Keine aktive Baustelle für Live-Wetter gefunden.
          </p>
        </div>
      ) : (
        <div className="grid gap-0 xl:grid-cols-[1fr_0.9fr]">
          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-black text-ink">{jobsite.name}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-600">{jobsite.address}</p>
                {decision.reasons.length > 0 ? (
                  <p className="mt-2 text-xs font-bold text-slate-500">Auswahl: {decision.reasons.slice(0, 3).join(" · ")}</p>
                ) : null}
              </div>
            </div>

            {!hasCoordinates ? (
              <div className="mt-4 rounded-lg border border-warning/30 bg-amber-50 p-4">
                <p className="font-black text-amber-950">Koordinaten für Baustelle fehlen</p>
                <p className="mt-1 text-sm leading-6 text-amber-900">
                  Für Live-Wetter und Radar braucht BauPro gespeicherte Baustellenkoordinaten. Die Adresse kann automatisch geocodiert werden.
                </p>
                <form action={geocodeJobsiteWeatherLocationAction} className="mt-3">
                  <input type="hidden" name="jobsite_id" value={jobsite.id} />
                  <SubmitButton className="w-full sm:w-auto">
                    <LocateFixed className="h-4 w-4" aria-hidden="true" />
                    Koordinaten aus Adresse ermitteln
                  </SubmitButton>
                </form>
                <form action={geocodeJobsiteWeatherLocationAction} className="mt-4 rounded-md border border-amber-200 bg-white p-3">
                  <input type="hidden" name="jobsite_id" value={jobsite.id} />
                  <p className="text-sm font-black text-amber-950">Falls die Adresse nicht gefunden wird</p>
                  <p className="mt-1 text-xs font-semibold text-amber-900">
                    Koordinaten aus Google/Apple Maps kopieren, z. B. 50.93836, 6.95997.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <label>
                      <span className="field-label">Breitengrad</span>
                      <input className="field-input" name="manual_latitude" inputMode="decimal" placeholder="50.93836" />
                    </label>
                    <label>
                      <span className="field-label">Laengengrad</span>
                      <input className="field-input" name="manual_longitude" inputMode="decimal" placeholder="6.95997" />
                    </label>
                    <SubmitButton className="self-end">
                      <LocateFixed className="h-4 w-4" aria-hidden="true" />
                      Speichern
                    </SubmitButton>
                  </div>
                </form>
              </div>
            ) : weather ? (
              <>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <WeatherMetric icon={CloudSun} label="Temperatur" value={weatherValue(weather.temperatureC, " °C")} />
                  <WeatherMetric icon={CloudRain} label="Regen" value={(weather.precipitationMm ?? 0) > 0 ? "Ja" : "Nein"} />
                  <WeatherMetric icon={CloudRain} label="Chance" value={weatherValue(weather.precipitationProbability, " %")} />
                  <WeatherMetric icon={Wind} label="Wind" value={weatherValue(weather.windKmh, " km/h")} />
                </div>

                <div className="mt-4 rounded-lg border border-line bg-fog p-4">
                  <p className="meta-label">Einschaetzung</p>
                  <p className="mt-1 text-base font-black text-ink">{weather.summary}</p>
                  <p className="mt-2 text-sm text-slate-600">
                    {weather.weatherLabel} · aktualisiert {formatDateTime(weather.fetchedAt)} · {weather.source}
                  </p>
                </div>
              </>
            ) : (
              <p className="mt-4 rounded-md border border-dashed border-line bg-white p-4 text-sm text-slate-600">
                Live-Wetter konnte gerade nicht abgerufen werden. Die App bleibt nutzbar; bitte später erneut prüfen.
              </p>
            )}
          </div>

          <div className="border-t border-line bg-slate-50 p-4 sm:p-5 xl:border-l xl:border-t-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="meta-label">Regenradar</p>
                <h3 className="font-black text-ink">Jetzt / +30 / +60</h3>
              </div>
              {hasCoordinates ? (
                <Link href={rainViewerMapUrl(lat, lng)} target="_blank" rel="noreferrer" className="btn-secondary h-10 px-3 text-xs">
                  Radar öffnen
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : null}
            </div>

            {tileSet ? (
              <div className="overflow-hidden rounded-lg border border-line bg-slate-200">
                <div className="relative grid aspect-[4/3] grid-cols-3">
                  {tileSet.tiles.map((tile) => (
                    <div key={`${tile.x}-${tile.y}`} className="relative overflow-hidden bg-slate-200">
                      <img src={tile.baseUrl} alt="" className="h-full w-full object-cover opacity-95" loading="lazy" decoding="async" />
                      {tile.radarUrl ? (
                        <img
                          src={tile.radarUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover opacity-70 mix-blend-multiply"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : null}
                    </div>
                  ))}
                  <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center">
                    <Navigation className="h-7 w-7 fill-danger text-danger drop-shadow" aria-hidden="true" />
                    <span className="mt-1 rounded bg-white/95 px-2 py-1 text-[11px] font-black text-ink shadow">Baustelle</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 border-t border-line bg-white">
                  {radarFrames.map((frame) => (
                    <div key={frame.label} className="border-r border-line px-3 py-2 last:border-r-0">
                      <p className="text-xs font-black text-ink">{frame.label}</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{frame.path ? frame.source : "nicht verfuegbar"}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-line bg-white p-4 text-sm text-slate-600">
                {hasCoordinates ? "Radar-Tiles sind gerade nicht verfuegbar." : "Radar wird nach gespeicherten Koordinaten angezeigt."}
              </p>
            )}

            {error ? <p className="mt-3 text-xs font-semibold text-amber-800">{error}</p> : null}
          </div>
        </div>
      )}
    </section>
  );
}

function WeatherMetric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof CloudSun;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-line bg-white p-3">
      <div className="flex items-center gap-2 text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <p className="meta-label">{label}</p>
      </div>
      <p className="mt-2 text-xl font-black text-ink">{value}</p>
    </div>
  );
}
