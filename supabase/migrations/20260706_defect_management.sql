-- Mängelmanagement: Mängel, Schäden und offene Punkte mit Nachweis, Frist und Kundenfreigabe.

create table if not exists public.defects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'mittel' check (priority in ('niedrig', 'mittel', 'hoch', 'kritisch')),
  status text not null default 'offen' check (status in ('offen', 'in_arbeit', 'wartet_auf_kunde', 'erledigt', 'abgenommen')),
  assigned_to uuid references public.profiles(id) on delete set null,
  due_date date,
  visible_to_customer boolean not null default false,
  customer_released_at timestamptz,
  customer_released_by uuid references public.profiles(id) on delete set null,
  source_type text not null default 'manual' check (source_type in ('manual', 'photo', 'report', 'checklist', 'customer_message')),
  source_report_id uuid references public.reports(id) on delete set null,
  source_report_photo_id uuid references public.report_photos(id) on delete set null,
  source_checklist_id uuid references public.jobsite_checklists(id) on delete set null,
  source_checklist_item_id uuid references public.jobsite_checklist_items(id) on delete set null,
  source_customer_message_id uuid references public.customer_portal_messages(id) on delete set null,
  source_task_id uuid references public.tasks(id) on delete set null,
  closed_at timestamptz,
  accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.defect_photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  defect_id uuid not null references public.defects(id) on delete cascade,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  visible_to_customer boolean not null default false,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.defect_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  defect_id uuid not null references public.defects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  notification_type text not null check (notification_type in ('due_soon', 'overdue', 'status_changed')),
  title text not null,
  body text,
  due_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists defects_company_status_idx
  on public.defects(company_id, status, priority, due_date, archived_at, created_at desc);
create index if not exists defects_jobsite_idx
  on public.defects(company_id, jobsite_id, status, archived_at, created_at desc);
create index if not exists defects_assigned_idx
  on public.defects(company_id, assigned_to, status, due_date)
  where archived_at is null;
create index if not exists defects_customer_visible_idx
  on public.defects(company_id, jobsite_id, visible_to_customer, status, created_at desc)
  where archived_at is null;
create unique index if not exists defects_checklist_item_once_idx
  on public.defects(company_id, source_checklist_item_id)
  where source_checklist_item_id is not null and archived_at is null;
create index if not exists defect_photos_defect_idx
  on public.defect_photos(company_id, defect_id, archived_at, created_at desc);
create index if not exists defect_notifications_company_idx
  on public.defect_notifications(company_id, read_at, created_at desc)
  where archived_at is null;
create unique index if not exists defect_notifications_once_idx
  on public.defect_notifications(defect_id, notification_type, due_at)
  where archived_at is null;

alter table public.defects enable row level security;
alter table public.defect_photos enable row level security;
alter table public.defect_notifications enable row level security;
alter table public.defects force row level security;
alter table public.defect_photos force row level security;
alter table public.defect_notifications force row level security;

grant select, insert, update on public.defects to authenticated;
grant select, insert, update on public.defect_photos to authenticated;
grant select, insert, update on public.defect_notifications to authenticated;

drop policy if exists "members read relevant defects" on public.defects;
create policy "members read relevant defects"
on public.defects for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and exists (
    select 1
    from public.jobsites j
    where j.id = jobsite_id
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or assigned_to = auth.uid()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "members insert assigned jobsite defects" on public.defects;
create policy "members insert assigned jobsite defects"
on public.defects for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and exists (
    select 1
    from public.jobsites j
    where j.id = jobsite_id
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "members update relevant defects" on public.defects;
create policy "members update relevant defects"
on public.defects for update
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and exists (
    select 1
    from public.jobsites j
    where j.id = jobsite_id
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or assigned_to = auth.uid()
        or (public.current_role() = 'vorarbeiter' and auth.uid() = any(j.assigned_employee_ids))
      )
  )
)
with check (
  company_id = public.current_company_id()
  and exists (
    select 1
    from public.jobsites j
    where j.id = jobsite_id
      and j.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or assigned_to = auth.uid()
        or (public.current_role() = 'vorarbeiter' and auth.uid() = any(j.assigned_employee_ids))
      )
  )
);

drop policy if exists "members read relevant defect photos" on public.defect_photos;
create policy "members read relevant defect photos"
on public.defect_photos for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and exists (
    select 1 from public.defects d
    join public.jobsites j on j.id = d.jobsite_id
    where d.id = defect_id
      and d.company_id = public.current_company_id()
      and d.archived_at is null
      and (
        public.can_manage_company()
        or d.assigned_to = auth.uid()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "members insert relevant defect photos" on public.defect_photos;
create policy "members insert relevant defect photos"
on public.defect_photos for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and exists (
    select 1 from public.defects d
    join public.jobsites j on j.id = d.jobsite_id
    where d.id = defect_id
      and d.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or d.assigned_to = auth.uid()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "managers update defect photos" on public.defect_photos;
create policy "managers update defect photos"
on public.defect_photos for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "members read relevant defect notifications" on public.defect_notifications;
create policy "members read relevant defect notifications"
on public.defect_notifications for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and (
    public.can_manage_company()
    or user_id = auth.uid()
    or exists (
      select 1 from public.defects d
      where d.id = defect_id
        and d.company_id = public.current_company_id()
        and d.assigned_to = auth.uid()
    )
  )
);

drop policy if exists "members update own defect notifications" on public.defect_notifications;
create policy "members update own defect notifications"
on public.defect_notifications for update
to authenticated
using (company_id = public.current_company_id() and (public.can_manage_company() or user_id = auth.uid()))
with check (company_id = public.current_company_id() and (public.can_manage_company() or user_id = auth.uid()));

create or replace function public.validate_defect_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  defect_company uuid;
  defect_jobsite uuid;
begin
  if tg_table_name = 'defects' then
    if not exists (
      select 1 from public.jobsites j
      where j.id = new.jobsite_id
        and j.company_id = new.company_id
        and j.archived_at is null
    ) then
      raise exception 'defect_jobsite_not_found';
    end if;

    if new.assigned_to is not null and not exists (
      select 1 from public.profiles p
      where p.id = new.assigned_to
        and p.company_id = new.company_id
        and p.active
        and p.role in ('vorarbeiter', 'mitarbeiter')
    ) then
      raise exception 'defect_assignee_not_found';
    end if;

    if new.source_report_id is not null and not exists (
      select 1 from public.reports r
      where r.id = new.source_report_id
        and r.company_id = new.company_id
        and r.jobsite_id = new.jobsite_id
        and r.archived_at is null
    ) then
      raise exception 'defect_report_source_invalid';
    end if;

    if new.source_report_photo_id is not null and not exists (
      select 1 from public.report_photos rp
      where rp.id = new.source_report_photo_id
        and rp.company_id = new.company_id
        and rp.jobsite_id = new.jobsite_id
        and rp.archived_at is null
    ) then
      raise exception 'defect_report_photo_source_invalid';
    end if;

    if new.source_checklist_id is not null and not exists (
      select 1 from public.jobsite_checklists c
      where c.id = new.source_checklist_id
        and c.company_id = new.company_id
        and c.jobsite_id = new.jobsite_id
        and c.archived_at is null
    ) then
      raise exception 'defect_checklist_source_invalid';
    end if;

    if new.source_checklist_item_id is not null and not exists (
      select 1 from public.jobsite_checklist_items ci
      where ci.id = new.source_checklist_item_id
        and ci.company_id = new.company_id
        and ci.jobsite_id = new.jobsite_id
        and ci.archived_at is null
    ) then
      raise exception 'defect_checklist_item_source_invalid';
    end if;

    if new.source_customer_message_id is not null and not exists (
      select 1 from public.customer_portal_messages m
      where m.id = new.source_customer_message_id
        and m.company_id = new.company_id
        and m.jobsite_id = new.jobsite_id
    ) then
      raise exception 'defect_customer_message_source_invalid';
    end if;

    if not public.can_manage_company() then
      if tg_op = 'UPDATE' and (
        new.jobsite_id is distinct from old.jobsite_id
        or new.assigned_to is distinct from old.assigned_to
        or new.due_date is distinct from old.due_date
        or new.visible_to_customer is distinct from old.visible_to_customer
        or new.customer_released_at is distinct from old.customer_released_at
        or new.customer_released_by is distinct from old.customer_released_by
        or new.source_report_id is distinct from old.source_report_id
        or new.source_report_photo_id is distinct from old.source_report_photo_id
        or new.source_checklist_id is distinct from old.source_checklist_id
        or new.source_checklist_item_id is distinct from old.source_checklist_item_id
        or new.source_customer_message_id is distinct from old.source_customer_message_id
      ) then
        raise exception 'restricted_defect_update';
      end if;
    end if;

    if new.status in ('erledigt', 'abgenommen') then
      if tg_op = 'INSERT' or old.status is distinct from new.status then
        new.closed_at := coalesce(new.closed_at, now());
      end if;
    end if;
    if new.status = 'abgenommen' then
      if tg_op = 'INSERT' or old.status is distinct from 'abgenommen' then
        new.accepted_at := coalesce(new.accepted_at, now());
      end if;
    end if;
  elsif tg_table_name = 'defect_photos' then
    select company_id, jobsite_id into defect_company, defect_jobsite
    from public.defects
    where id = new.defect_id;
    if not found then
      raise exception 'defect_not_found';
    end if;
    if defect_company <> new.company_id or defect_jobsite <> new.jobsite_id then
      raise exception 'defect_photo_company_mismatch';
    end if;
    if not public.can_manage_company() and tg_op = 'UPDATE' and new.visible_to_customer is distinct from old.visible_to_customer then
      raise exception 'restricted_defect_photo_update';
    end if;
  elsif tg_table_name = 'defect_notifications' then
    select company_id into defect_company
    from public.defects
    where id = new.defect_id;
    if not found then
      raise exception 'defect_not_found';
    end if;
    if defect_company <> new.company_id then
      raise exception 'defect_notification_company_mismatch';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_defects_tenant on public.defects;
create trigger validate_defects_tenant
before insert or update on public.defects
for each row execute function public.validate_defect_tenant();

drop trigger if exists validate_defect_photos_tenant on public.defect_photos;
create trigger validate_defect_photos_tenant
before insert or update on public.defect_photos
for each row execute function public.validate_defect_tenant();

drop trigger if exists validate_defect_notifications_tenant on public.defect_notifications;
create trigger validate_defect_notifications_tenant
before insert or update on public.defect_notifications
for each row execute function public.validate_defect_tenant();

drop trigger if exists set_defects_updated_at on public.defects;
create trigger set_defects_updated_at
before update on public.defects
for each row execute function public.set_updated_at();

create or replace function public.create_defect_due_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_kind text;
  notification_title text;
begin
  if new.archived_at is not null or new.status in ('erledigt', 'abgenommen') or new.due_date is null then
    return new;
  end if;

  if new.due_date < current_date then
    notification_kind := 'overdue';
    notification_title := 'Mangel-Frist ueberfaellig';
  elsif new.due_date <= current_date + 1 then
    notification_kind := 'due_soon';
    notification_title := 'Mangel-Frist naht';
  else
    return new;
  end if;

  insert into public.defect_notifications (
    company_id,
    defect_id,
    user_id,
    notification_type,
    title,
    body,
    due_at
  )
  values (
    new.company_id,
    new.id,
    new.assigned_to,
    notification_kind,
    notification_title,
    new.title,
    new.due_date::timestamptz
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists create_defect_due_notification on public.defects;
create trigger create_defect_due_notification
after insert or update of due_date, status, assigned_to, archived_at on public.defects
for each row execute function public.create_defect_due_notification();

create or replace function public.create_defect_from_checklist_problem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'problem' or new.archived_at is not null then
    return new;
  end if;

  insert into public.defects (
    company_id,
    jobsite_id,
    title,
    description,
    priority,
    status,
    assigned_to,
    due_date,
    source_type,
    source_checklist_id,
    source_checklist_item_id,
    source_task_id,
    created_by
  )
  values (
    new.company_id,
    new.jobsite_id,
    left(concat('Mangel: ', new.label), 180),
    nullif(concat_ws(E'\n', new.problem_description, new.notes, concat('Aus Checklistenpunkt: ', new.label)), ''),
    'hoch',
    'offen',
    null,
    current_date + 3,
    'checklist',
    new.checklist_id,
    new.id,
    new.resolved_task_id,
    auth.uid()
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists create_defect_from_checklist_problem on public.jobsite_checklist_items;
create trigger create_defect_from_checklist_problem
after update on public.jobsite_checklist_items
for each row
when (new.status = 'problem')
execute function public.create_defect_from_checklist_problem();

insert into storage.buckets (id, name, public)
values ('defect-photos', 'defect-photos', false)
on conflict (id) do nothing;

drop policy if exists "members read defect photos storage" on storage.objects;
create policy "members read defect photos storage"
on storage.objects for select
to authenticated
using (
  bucket_id = 'defect-photos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'defects'
);

drop policy if exists "members upload defect photos storage" on storage.objects;
create policy "members upload defect photos storage"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'defect-photos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'defects'
);

drop policy if exists "managers delete defect photos storage" on storage.objects;
create policy "managers delete defect photos storage"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'defect-photos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and public.can_manage_company()
);

-- Protected business data: no hard delete fallback for defects.
drop policy if exists "redteam managers delete fallback" on public.defects;
drop policy if exists "redteam managers delete fallback" on public.defect_photos;
drop policy if exists "redteam managers delete fallback" on public.defect_notifications;

select pg_notify('pgrst', 'reload schema');
