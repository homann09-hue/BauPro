-- BauPro AI features: settings, action proposals and usage logging.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.ai_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade unique,
  enabled boolean not null default true,
  default_model text not null default 'gpt-4.1-mini',
  allow_employee_ai boolean not null default true,
  allow_ai_daily_reports boolean not null default true,
  allow_ai_time_tracking boolean not null default true,
  allow_ai_material_matching boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  status text not null default 'success' check (status in ('success', 'disabled', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null,
  raw_input text not null,
  parsed_json jsonb not null default '{}'::jsonb,
  confidence numeric(4, 3) not null default 0 check (confidence >= 0 and confidence <= 1),
  status text not null default 'proposed' check (status in ('proposed', 'confirmed', 'rejected', 'executed')),
  linked_customer_id uuid,
  linked_job_id uuid,
  linked_time_entry_id uuid,
  linked_bring_list_id uuid,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

do $$
begin
  if to_regclass('public.customers') is not null then
    alter table public.ai_actions drop constraint if exists ai_actions_linked_customer_id_fkey;
    alter table public.ai_actions
    add constraint ai_actions_linked_customer_id_fkey
    foreign key (linked_customer_id) references public.customers(id) on delete set null;
  end if;

  if to_regclass('public.jobsites') is not null then
    alter table public.ai_actions drop constraint if exists ai_actions_linked_job_id_fkey;
    alter table public.ai_actions
    add constraint ai_actions_linked_job_id_fkey
    foreign key (linked_job_id) references public.jobsites(id) on delete set null;
  end if;

  if to_regclass('public.time_entries') is not null then
    alter table public.ai_actions drop constraint if exists ai_actions_linked_time_entry_id_fkey;
    alter table public.ai_actions
    add constraint ai_actions_linked_time_entry_id_fkey
    foreign key (linked_time_entry_id) references public.time_entries(id) on delete set null;
  end if;

  if to_regclass('public.bring_lists') is not null then
    alter table public.ai_actions drop constraint if exists ai_actions_linked_bring_list_id_fkey;
    alter table public.ai_actions
    add constraint ai_actions_linked_bring_list_id_fkey
    foreign key (linked_bring_list_id) references public.bring_lists(id) on delete set null;
  end if;
end $$;

create index if not exists ai_settings_company_idx on public.ai_settings(company_id);
create index if not exists ai_usage_logs_company_created_idx on public.ai_usage_logs(company_id, created_at desc);
create index if not exists ai_usage_logs_user_created_idx on public.ai_usage_logs(user_id, created_at desc);
create index if not exists ai_actions_company_status_idx on public.ai_actions(company_id, status, created_at desc);
create index if not exists ai_actions_user_status_idx on public.ai_actions(user_id, status, created_at desc);

drop trigger if exists set_ai_settings_updated_at on public.ai_settings;
create trigger set_ai_settings_updated_at
before update on public.ai_settings
for each row execute function public.set_updated_at();

alter table public.ai_settings enable row level security;
alter table public.ai_usage_logs enable row level security;
alter table public.ai_actions enable row level security;

grant select, insert, update on public.ai_settings to authenticated;
grant select, insert on public.ai_usage_logs to authenticated;
grant select, insert, update on public.ai_actions to authenticated;

drop policy if exists "company members read ai settings" on public.ai_settings;
create policy "company members read ai settings"
on public.ai_settings for select
to authenticated
using (company_id = public.current_company_id());

drop policy if exists "managers insert ai settings" on public.ai_settings;
create policy "managers insert ai settings"
on public.ai_settings for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update ai settings" on public.ai_settings;
create policy "managers update ai settings"
on public.ai_settings for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers read ai usage logs" on public.ai_usage_logs;
create policy "managers read ai usage logs"
on public.ai_usage_logs for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "company members create own ai usage logs" on public.ai_usage_logs;
create policy "company members create own ai usage logs"
on public.ai_usage_logs for insert
to authenticated
with check (company_id = public.current_company_id() and user_id = auth.uid());

drop policy if exists "read relevant ai actions" on public.ai_actions;
create policy "read relevant ai actions"
on public.ai_actions for select
to authenticated
using (company_id = public.current_company_id() and (public.can_manage_company() or user_id = auth.uid()));

drop policy if exists "create own ai actions" on public.ai_actions;
create policy "create own ai actions"
on public.ai_actions for insert
to authenticated
with check (company_id = public.current_company_id() and user_id = auth.uid());

drop policy if exists "update own proposed ai actions" on public.ai_actions;
create policy "update own proposed ai actions"
on public.ai_actions for update
to authenticated
using (company_id = public.current_company_id() and (public.can_manage_company() or user_id = auth.uid()))
with check (company_id = public.current_company_id() and (public.can_manage_company() or user_id = auth.uid()));

notify pgrst, 'reload schema';
