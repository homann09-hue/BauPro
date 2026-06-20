alter table public.time_entries
  add column if not exists weather_summary text,
  add column if not exists weather_temperature_c numeric,
  add column if not exists weather_precipitation_mm numeric,
  add column if not exists weather_wind_kmh numeric,
  add column if not exists weather_source text,
  add column if not exists weather_fetched_at timestamptz,
  add column if not exists weather_lat numeric,
  add column if not exists weather_lng numeric;

alter table public.reports
  add column if not exists weather_summary text,
  add column if not exists weather_temperature_c numeric,
  add column if not exists weather_precipitation_mm numeric,
  add column if not exists weather_wind_kmh numeric,
  add column if not exists weather_source text,
  add column if not exists weather_fetched_at timestamptz,
  add column if not exists weather_lat numeric,
  add column if not exists weather_lng numeric;
