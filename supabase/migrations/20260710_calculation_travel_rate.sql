-- Ergaenzt die Auftragskalkulation um einen Standard-Kilometerpreis.
-- Die Datei ist bewusst robust: Bei aelteren Datenbanken wird
-- calculation_settings bei Bedarf zuerst angelegt.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.calculation_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade unique,
  default_waste_percent numeric(7, 2) not null default 20,
  default_vat_rate numeric(7, 2) not null default 19,
  default_labor_rate_net numeric(12, 2) not null default 65,
  default_internal_hourly_cost numeric(12, 2) not null default 38,
  default_profit_markup_percent numeric(7, 2) not null default 10,
  default_overhead_percent numeric(7, 2) not null default 12,
  default_travel_rate_per_km numeric(12, 2) not null default 0.75,
  default_travel_flat_rate numeric(12, 2) not null default 0,
  allow_ai_job_creation boolean not null default true,
  require_admin_confirmation boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calculation_settings
add column if not exists default_travel_rate_per_km numeric(12, 2) not null default 0.75;

create index if not exists calculation_settings_company_idx
on public.calculation_settings(company_id);

drop trigger if exists set_calculation_settings_updated_at on public.calculation_settings;
create trigger set_calculation_settings_updated_at
before update on public.calculation_settings
for each row execute function public.set_updated_at();

alter table public.calculation_settings enable row level security;

grant select, insert, update on public.calculation_settings to authenticated;

drop policy if exists "managers read calculation settings" on public.calculation_settings;
create policy "managers read calculation settings"
on public.calculation_settings for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers manage calculation settings" on public.calculation_settings;
create policy "managers manage calculation settings"
on public.calculation_settings for all
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

notify pgrst, 'reload schema';
