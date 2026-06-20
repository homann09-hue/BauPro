"use client";

import { useRef, useState } from "react";
import { CloudSun, LocateFixed, PencilLine, RefreshCw, X } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { WeatherSuggestion } from "@/lib/weather/open-meteo";

type WeatherDefaults = {
  summary?: string | null;
  temperatureC?: number | null;
  precipitationMm?: number | null;
  windKmh?: number | null;
  source?: string | null;
  fetchedAt?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type ApiResponse =
  | {
      ok: true;
      weather: WeatherSuggestion;
    }
  | {
      ok: false;
      message: string;
    };

function numberValue(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function stringValue(value?: string | null) {
  return value ?? "";
}

function fromDefaults(defaultWeather?: WeatherDefaults): WeatherSuggestion | null {
  if (!defaultWeather?.summary) return null;

  return {
    summary: defaultWeather.summary,
    temperatureC: defaultWeather.temperatureC ?? null,
    precipitationMm: defaultWeather.precipitationMm ?? null,
    windKmh: defaultWeather.windKmh ?? null,
    source: defaultWeather.source ?? "Manuell",
    fetchedAt: defaultWeather.fetchedAt ?? "",
    lat: defaultWeather.lat ?? Number.NaN,
    lng: defaultWeather.lng ?? Number.NaN,
    locationLabel: null
  };
}

export function WeatherSuggestionField({
  jobFieldName,
  dateFieldName,
  canManage,
  defaultWeather,
  compact = false
}: {
  jobFieldName: string;
  dateFieldName: string;
  canManage: boolean;
  defaultWeather?: WeatherDefaults;
  compact?: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [applied, setApplied] = useState<WeatherSuggestion | null>(() => fromDefaults(defaultWeather));
  const [pending, setPending] = useState<WeatherSuggestion | null>(null);
  const [manualMode, setManualMode] = useState(Boolean(defaultWeather?.summary));
  const [manualText, setManualText] = useState(defaultWeather?.summary ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const stored = applied
    ? {
        weather: applied.summary,
        summary: applied.summary,
        temperatureC: applied.temperatureC,
        precipitationMm: applied.precipitationMm,
        windKmh: applied.windKmh,
        source: applied.source,
        fetchedAt: applied.fetchedAt,
        lat: applied.lat,
        lng: applied.lng
      }
    : {
        weather: manualText,
        summary: manualText,
        temperatureC: null,
        precipitationMm: null,
        windKmh: null,
        source: manualText ? "Manuell" : null,
        fetchedAt: null,
        lat: null,
        lng: null
      };

  function readFormValues() {
    const form = wrapperRef.current?.closest("form");
    const formData = form ? new FormData(form) : new FormData();
    return {
      jobId: String(formData.get(jobFieldName) ?? "") || null,
      date: String(formData.get(dateFieldName) ?? "") || new Date().toISOString().slice(0, 10)
    };
  }

  async function requestWeather(coords?: GeolocationCoordinates) {
    setLoading(true);
    setMessage(null);
    setPending(null);

    try {
      const { jobId, date } = readFormValues();
      const response = await fetch("/api/weather/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          date,
          lat: coords?.latitude,
          lng: coords?.longitude,
          preferBrowserLocation: Boolean(coords)
        })
      });

      const payload = (await response.json()) as ApiResponse;
      if (!payload.ok) {
        setMessage(payload.message || "Keine Wetterdaten gefunden. Manuelle Eingabe bleibt möglich.");
        return;
      }

      setPending(payload.weather);
      setManualMode(false);
    } catch {
      setMessage("Wetter konnte gerade nicht automatisch ermittelt werden. Manuelle Eingabe bleibt möglich.");
    } finally {
      setLoading(false);
    }
  }

  function requestBrowserLocation() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setMessage("Browser-Standort wird hier nicht unterstuetzt. Manuelle Eingabe bleibt möglich.");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void requestWeather(position.coords);
      },
      () => {
        setLoading(false);
        setMessage("Standort nicht freigegeben. Wetter kann weiter per Baustelle oder manuell gespeichert werden.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 15 * 60 * 1000 }
    );
  }

  function applySuggestion(weather: WeatherSuggestion) {
    setApplied(weather);
    setManualText(weather.summary);
    setPending(null);
    setManualMode(false);
    setMessage("Wetter wurde für den Nachweis übernommen.");
  }

  function clearWeather() {
    setApplied(null);
    setPending(null);
    setManualText("");
    setManualMode(false);
    setMessage("Ohne Wetter speichern ist ausgewählt.");
  }

  function enableManual() {
    const source = pending ?? applied;
    setManualText(source?.summary ?? manualText);
    if (source) setApplied(source);
    setPending(null);
    setManualMode(true);
  }

  return (
    <div ref={wrapperRef} className={compact ? "rounded-md border border-line bg-fog p-3" : "rounded-lg border border-line bg-fog p-4"}>
      <input type="hidden" name="weather" value={stored.weather} />
      <input type="hidden" name="weather_summary" value={stored.summary} />
      <input type="hidden" name="weather_temperature_c" value={numberValue(stored.temperatureC)} />
      <input type="hidden" name="weather_precipitation_mm" value={numberValue(stored.precipitationMm)} />
      <input type="hidden" name="weather_wind_kmh" value={numberValue(stored.windKmh)} />
      <input type="hidden" name="weather_source" value={stringValue(stored.source)} />
      <input type="hidden" name="weather_fetched_at" value={stringValue(stored.fetchedAt)} />
      <input type="hidden" name="weather_lat" value={numberValue(stored.lat)} />
      <input type="hidden" name="weather_lng" value={numberValue(stored.lng)} />

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <CloudSun className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="section-kicker">Wetter beim Abschluss</p>
          <h3 className="text-base font-black text-ink">Wetter automatisch erkennen</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Optional für Nachweis und Tagesbericht. Du kannst den Vorschlag übernehmen, ändern oder ohne Wetter speichern.
          </p>
        </div>
      </div>

      {pending ? (
        <div className="mt-3 rounded-md border border-primary/20 bg-white p-3">
          <p className="meta-label">Vorschlag</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-ink">{pending.summary}</p>
          {canManage ? <WeatherDetails weather={pending} /> : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button type="button" className="btn-primary" onClick={() => applySuggestion(pending)}>
              Übernehmen
            </button>
            <button type="button" className="btn-secondary" onClick={enableManual}>
              <PencilLine className="h-4 w-4" aria-hidden="true" />
              Manuell ändern
            </button>
            <button type="button" className="btn-secondary" onClick={clearWeather}>
              Ohne Wetter speichern
            </button>
          </div>
        </div>
      ) : null}

      {applied && !pending ? (
        <div className="mt-3 rounded-md border border-primary/20 bg-white p-3">
          <p className="meta-label">Gespeichertes Wetter</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-ink">{applied.summary}</p>
          {canManage ? <WeatherDetails weather={applied} /> : null}
        </div>
      ) : null}

      {manualMode ? (
        <label className="mt-3 block">
          <span className="field-label">Wetter manuell</span>
          <textarea
            className="field-input min-h-24 text-base"
            value={manualText}
            onChange={(event) => {
              setApplied(null);
              setManualText(event.target.value);
            }}
            placeholder="z. B. Trocken, 18 °C, leichter Wind - passt als Nachweis."
          />
        </label>
      ) : null}

      {message ? (
        <p className="mt-3 rounded-md border border-line bg-white p-3 text-sm font-semibold text-slate-700" aria-live="polite">
          {message}
        </p>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button type="button" className="btn-secondary" onClick={() => requestWeather()} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
          {loading ? "Suche Wetter..." : "Aus Baustelle holen"}
        </button>
        <button type="button" className="btn-secondary" onClick={requestBrowserLocation} disabled={loading}>
          <LocateFixed className="h-4 w-4" aria-hidden="true" />
          Standort nutzen
        </button>
        <button type="button" className="btn-secondary" onClick={manualMode ? clearWeather : enableManual}>
          {manualMode ? <X className="h-4 w-4" aria-hidden="true" /> : <PencilLine className="h-4 w-4" aria-hidden="true" />}
          {manualMode ? "Ohne Wetter" : "Manuell"}
        </button>
      </div>
    </div>
  );
}

function WeatherDetails({ weather }: { weather: WeatherSuggestion }) {
  return (
    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <Detail label="Temperatur" value={weather.temperatureC === null ? "-" : `${weather.temperatureC} °C`} />
      <Detail label="Niederschlag" value={weather.precipitationMm === null ? "-" : `${weather.precipitationMm} mm`} />
      <Detail label="Wind" value={weather.windKmh === null ? "-" : `${weather.windKmh} km/h`} />
      <Detail label="Quelle" value={weather.source || "-"} />
      <Detail label="Abrufzeit" value={weather.fetchedAt ? formatDateTime(weather.fetchedAt) : "-"} />
      <Detail label="Ort" value={weather.locationLabel || "Koordinaten"} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-fog p-3">
      <p className="meta-label">{label}</p>
      <p className="mt-1 font-bold text-ink">{value}</p>
    </div>
  );
}
