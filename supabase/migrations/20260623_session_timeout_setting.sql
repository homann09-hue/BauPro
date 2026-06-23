-- 20260623_session_timeout_setting.sql
-- Firmenweite Inaktivitaets-Abmeldung fuer geteilte Geraete.

alter table public.companies
  add column if not exists session_timeout_minutes integer not null default 30;

alter table public.companies
  drop constraint if exists companies_session_timeout_minutes_check;

alter table public.companies
  add constraint companies_session_timeout_minutes_check
  check (session_timeout_minutes between 0 and 1440);

notify pgrst, 'reload schema';
