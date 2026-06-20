alter table public.materials add column if not exists archived_at timestamptz;
alter table public.vehicles add column if not exists archived_at timestamptz;
alter table public.tasks add column if not exists archived_at timestamptz;

create index if not exists materials_archived_idx on public.materials(company_id, archived_at);
create index if not exists vehicles_archived_idx on public.vehicles(company_id, archived_at);
create index if not exists tasks_archived_idx on public.tasks(company_id, archived_at);

select pg_notify('pgrst', 'reload schema');
