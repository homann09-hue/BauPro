-- Flexible Checklisten fuer Baustellen, Arbeitssicherheit, Abnahmen und Material.

create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  category text not null check (category in ('arbeitssicherheit', 'baustart', 'tagesabschluss', 'abnahme', 'material', 'geruest', 'dacharbeiten')),
  description text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  label text not null,
  help_text text,
  required boolean not null default false,
  photo_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.jobsite_checklists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  template_id uuid references public.checklist_templates(id) on delete set null,
  title text not null,
  category text not null check (category in ('arbeitssicherheit', 'baustart', 'tagesabschluss', 'abnahme', 'material', 'geruest', 'dacharbeiten')),
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'completed', 'archived')),
  due_date date,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  signature_name text,
  signature_data_url text,
  signature_role text check (signature_role in ('kunde', 'mitarbeiter', 'vorarbeiter', 'chef', 'admin')),
  signature_signed_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.jobsite_checklist_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  checklist_id uuid not null references public.jobsite_checklists(id) on delete cascade,
  template_item_id uuid references public.checklist_template_items(id) on delete set null,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  label text not null,
  help_text text,
  required boolean not null default false,
  photo_required boolean not null default false,
  status text not null default 'offen' check (status in ('offen', 'erledigt', 'nicht_zutreffend', 'problem')),
  notes text,
  problem_description text,
  resolved_task_id uuid references public.tasks(id) on delete set null,
  checked_by uuid references auth.users(id) on delete set null,
  checked_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.checklist_item_photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  checklist_id uuid not null references public.jobsite_checklists(id) on delete cascade,
  checklist_item_id uuid not null references public.jobsite_checklist_items(id) on delete cascade,
  jobsite_id uuid not null references public.jobsites(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists checklist_templates_company_idx
  on public.checklist_templates(company_id, category, active, archived_at, name);
create index if not exists checklist_template_items_template_idx
  on public.checklist_template_items(template_id, archived_at, sort_order);
create index if not exists jobsite_checklists_company_jobsite_idx
  on public.jobsite_checklists(company_id, jobsite_id, status, archived_at, created_at desc);
create index if not exists jobsite_checklist_items_checklist_idx
  on public.jobsite_checklist_items(company_id, checklist_id, archived_at, sort_order);
create index if not exists jobsite_checklist_items_problem_idx
  on public.jobsite_checklist_items(company_id, status, resolved_task_id)
  where archived_at is null and status = 'problem';
create index if not exists checklist_item_photos_item_idx
  on public.checklist_item_photos(company_id, checklist_item_id, archived_at, created_at desc);

alter table public.checklist_templates enable row level security;
alter table public.checklist_template_items enable row level security;
alter table public.jobsite_checklists enable row level security;
alter table public.jobsite_checklist_items enable row level security;
alter table public.checklist_item_photos enable row level security;
alter table public.checklist_templates force row level security;
alter table public.checklist_template_items force row level security;
alter table public.jobsite_checklists force row level security;
alter table public.jobsite_checklist_items force row level security;
alter table public.checklist_item_photos force row level security;

drop policy if exists "members read checklist templates" on public.checklist_templates;
create policy "members read checklist templates"
on public.checklist_templates for select
to authenticated
using (
  archived_at is null
  and active
  and (company_id is null or company_id = public.current_company_id())
);

drop policy if exists "managers insert checklist templates" on public.checklist_templates;
create policy "managers insert checklist templates"
on public.checklist_templates for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update checklist templates" on public.checklist_templates;
create policy "managers update checklist templates"
on public.checklist_templates for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "members read checklist template items" on public.checklist_template_items;
create policy "members read checklist template items"
on public.checklist_template_items for select
to authenticated
using (
  archived_at is null
  and exists (
    select 1 from public.checklist_templates t
    where t.id = template_id
      and t.archived_at is null
      and t.active
      and (t.company_id is null or t.company_id = public.current_company_id())
  )
);

drop policy if exists "managers insert checklist template items" on public.checklist_template_items;
create policy "managers insert checklist template items"
on public.checklist_template_items for insert
to authenticated
with check (
  public.can_manage_company()
  and company_id = public.current_company_id()
  and exists (
    select 1 from public.checklist_templates t
    where t.id = template_id
      and t.company_id = public.current_company_id()
  )
);

drop policy if exists "managers update checklist template items" on public.checklist_template_items;
create policy "managers update checklist template items"
on public.checklist_template_items for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "members read jobsite checklists" on public.jobsite_checklists;
create policy "members read jobsite checklists"
on public.jobsite_checklists for select
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
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "operators insert jobsite checklists" on public.jobsite_checklists;
create policy "operators insert jobsite checklists"
on public.jobsite_checklists for insert
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
        or (public.current_role() = 'vorarbeiter' and auth.uid() = any(j.assigned_employee_ids))
      )
  )
);

drop policy if exists "operators update jobsite checklists" on public.jobsite_checklists;
create policy "operators update jobsite checklists"
on public.jobsite_checklists for update
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
        or (public.current_role() = 'vorarbeiter' and auth.uid() = any(j.assigned_employee_ids))
      )
  )
);

drop policy if exists "members read jobsite checklist items" on public.jobsite_checklist_items;
create policy "members read jobsite checklist items"
on public.jobsite_checklist_items for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and exists (
    select 1
    from public.jobsite_checklists c
    join public.jobsites j on j.id = c.jobsite_id
    where c.id = checklist_id
      and c.company_id = public.current_company_id()
      and c.archived_at is null
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "operators insert jobsite checklist items" on public.jobsite_checklist_items;
create policy "operators insert jobsite checklist items"
on public.jobsite_checklist_items for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and exists (
    select 1
    from public.jobsite_checklists c
    join public.jobsites j on j.id = c.jobsite_id
    where c.id = checklist_id
      and c.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or (public.current_role() = 'vorarbeiter' and auth.uid() = any(j.assigned_employee_ids))
      )
  )
);

drop policy if exists "operators update jobsite checklist items" on public.jobsite_checklist_items;
create policy "operators update jobsite checklist items"
on public.jobsite_checklist_items for update
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and exists (
    select 1
    from public.jobsite_checklists c
    join public.jobsites j on j.id = c.jobsite_id
    where c.id = checklist_id
      and c.company_id = public.current_company_id()
      and c.archived_at is null
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
)
with check (
  company_id = public.current_company_id()
  and exists (
    select 1
    from public.jobsite_checklists c
    join public.jobsites j on j.id = c.jobsite_id
    where c.id = checklist_id
      and c.company_id = public.current_company_id()
      and c.archived_at is null
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "members read checklist item photos" on public.checklist_item_photos;
create policy "members read checklist item photos"
on public.checklist_item_photos for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and exists (
    select 1
    from public.jobsite_checklists c
    join public.jobsites j on j.id = c.jobsite_id
    where c.id = checklist_id
      and c.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "members insert checklist item photos" on public.checklist_item_photos;
create policy "members insert checklist item photos"
on public.checklist_item_photos for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and exists (
    select 1
    from public.jobsite_checklists c
    join public.jobsites j on j.id = c.jobsite_id
    where c.id = checklist_id
      and c.company_id = public.current_company_id()
      and (
        public.can_manage_company()
        or auth.uid() = any(j.assigned_employee_ids)
      )
  )
);

drop policy if exists "managers update checklist item photos" on public.checklist_item_photos;
create policy "managers update checklist item photos"
on public.checklist_item_photos for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

create or replace function public.validate_checklist_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  template_company uuid;
  checklist_company uuid;
  checklist_jobsite uuid;
begin
  if tg_table_name = 'checklist_template_items' then
    select company_id into template_company from public.checklist_templates where id = new.template_id;
    if not found then
      raise exception 'checklist_template_not_found';
    end if;
    if template_company is distinct from new.company_id then
      raise exception 'checklist_template_company_mismatch';
    end if;
  elsif tg_table_name = 'jobsite_checklists' then
    if not exists (
      select 1 from public.jobsites j
      where j.id = new.jobsite_id
        and j.company_id = new.company_id
        and j.archived_at is null
    ) then
      raise exception 'jobsite_not_found';
    end if;
    if new.template_id is not null and not exists (
      select 1 from public.checklist_templates t
      where t.id = new.template_id
        and t.archived_at is null
        and t.active
        and (t.company_id is null or t.company_id = new.company_id)
    ) then
      raise exception 'checklist_template_not_found';
    end if;
  elsif tg_table_name = 'jobsite_checklist_items' then
    select company_id, jobsite_id into checklist_company, checklist_jobsite
    from public.jobsite_checklists
    where id = new.checklist_id;
    if not found then
      raise exception 'jobsite_checklist_not_found';
    end if;
    if checklist_company <> new.company_id or checklist_jobsite <> new.jobsite_id then
      raise exception 'jobsite_checklist_company_mismatch';
    end if;
  elsif tg_table_name = 'checklist_item_photos' then
    select company_id, jobsite_id into checklist_company, checklist_jobsite
    from public.jobsite_checklists
    where id = new.checklist_id;
    if not found then
      raise exception 'jobsite_checklist_not_found';
    end if;
    if checklist_company <> new.company_id or checklist_jobsite <> new.jobsite_id then
      raise exception 'checklist_photo_company_mismatch';
    end if;
    if not exists (
      select 1 from public.jobsite_checklist_items i
      where i.id = new.checklist_item_id
        and i.checklist_id = new.checklist_id
        and i.company_id = new.company_id
        and i.jobsite_id = new.jobsite_id
        and i.archived_at is null
    ) then
      raise exception 'checklist_item_not_found';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_checklist_template_item_tenant on public.checklist_template_items;
create trigger validate_checklist_template_item_tenant
before insert or update on public.checklist_template_items
for each row execute function public.validate_checklist_tenant();

drop trigger if exists validate_jobsite_checklist_tenant on public.jobsite_checklists;
create trigger validate_jobsite_checklist_tenant
before insert or update on public.jobsite_checklists
for each row execute function public.validate_checklist_tenant();

drop trigger if exists validate_jobsite_checklist_item_tenant on public.jobsite_checklist_items;
create trigger validate_jobsite_checklist_item_tenant
before insert or update on public.jobsite_checklist_items
for each row execute function public.validate_checklist_tenant();

drop trigger if exists validate_checklist_item_photo_tenant on public.checklist_item_photos;
create trigger validate_checklist_item_photo_tenant
before insert or update on public.checklist_item_photos
for each row execute function public.validate_checklist_tenant();

create or replace function public.create_task_for_checklist_problem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  task_id uuid;
begin
  if new.status <> 'problem' or new.resolved_task_id is not null or new.archived_at is not null then
    return new;
  end if;

  insert into public.tasks (
    company_id,
    jobsite_id,
    title,
    description,
    due_date,
    status,
    created_by
  )
  values (
    new.company_id,
    new.jobsite_id,
    concat('Mangel/Problem: ', left(new.label, 120)),
    nullif(concat_ws(E'\n', new.problem_description, new.notes, concat('Aus Checklistenpunkt: ', new.label)), ''),
    current_date,
    'offen',
    auth.uid()
  )
  returning id into task_id;

  new.resolved_task_id := task_id;
  return new;
end;
$$;

drop trigger if exists create_task_for_checklist_problem on public.jobsite_checklist_items;
create trigger create_task_for_checklist_problem
before update on public.jobsite_checklist_items
for each row
when (new.status = 'problem' and new.resolved_task_id is null)
execute function public.create_task_for_checklist_problem();

drop trigger if exists set_checklist_templates_updated_at on public.checklist_templates;
create trigger set_checklist_templates_updated_at
before update on public.checklist_templates
for each row execute function public.set_updated_at();

drop trigger if exists set_checklist_template_items_updated_at on public.checklist_template_items;
create trigger set_checklist_template_items_updated_at
before update on public.checklist_template_items
for each row execute function public.set_updated_at();

drop trigger if exists set_jobsite_checklists_updated_at on public.jobsite_checklists;
create trigger set_jobsite_checklists_updated_at
before update on public.jobsite_checklists
for each row execute function public.set_updated_at();

drop trigger if exists set_jobsite_checklist_items_updated_at on public.jobsite_checklist_items;
create trigger set_jobsite_checklist_items_updated_at
before update on public.jobsite_checklist_items
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('checklist-photos', 'checklist-photos', false)
on conflict (id) do nothing;

drop policy if exists "members read checklist photos storage" on storage.objects;
create policy "members read checklist photos storage"
on storage.objects for select
to authenticated
using (
  bucket_id = 'checklist-photos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'checklists'
);

drop policy if exists "members upload checklist photos storage" on storage.objects;
create policy "members upload checklist photos storage"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'checklist-photos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'checklists'
);

drop policy if exists "managers delete checklist photos storage" on storage.objects;
create policy "managers delete checklist photos storage"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'checklist-photos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and public.can_manage_company()
);

-- Praxisnahe Standardvorlagen fuer neue Firmen, sichtbar fuer alle Mandanten.
with templates(name, category, description) as (
  values
    ('Arbeitssicherheit Dacharbeiten', 'arbeitssicherheit', 'Kurzer Sicherheitscheck vor Dacharbeiten.'),
    ('Baustart Standard', 'baustart', 'Vorbereitung beim Start einer Baustelle.'),
    ('Tagesabschluss Baustelle', 'tagesabschluss', 'Schneller Abschlusscheck zum Feierabend.'),
    ('Abnahme Dacharbeiten', 'abnahme', 'Nachweisorientierte Abnahme vor Uebergabe.'),
    ('Material Vollstaendigkeit', 'material', 'Material und Werkzeug fuer den Einsatz pruefen.'),
    ('Geruest / Leiter Pruefung', 'geruest', 'Sichtpruefung fuer Geruest, Leiter und Zugang.'),
    ('Dacharbeiten Qualitaet', 'dacharbeiten', 'Qualitaetscheck fuer typische Dacharbeiten.')
),
inserted as (
  insert into public.checklist_templates (company_id, name, category, description, active)
  select null, name, category, description, true
  from templates t
  where not exists (
    select 1 from public.checklist_templates existing
    where existing.company_id is null and existing.name = t.name and existing.category = t.category
  )
  returning id, name
)
insert into public.checklist_template_items (template_id, company_id, label, help_text, required, photo_required, sort_order)
select inserted.id, null, item.label, item.help_text, item.required, item.photo_required, item.sort_order
from inserted
join lateral (
  values
    ('Arbeitssicherheit Dacharbeiten', 'PSA vorhanden und getragen', 'Helm, Schuhe, Handschuhe, Absturzsicherung pruefen.', true, false, 10),
    ('Arbeitssicherheit Dacharbeiten', 'Absturzsicherung geprueft', 'Anschlagpunkte, Geruest, Seitenschutz oder Auffanggurt dokumentieren.', true, true, 20),
    ('Arbeitssicherheit Dacharbeiten', 'Wetter und Wind fuer Dacharbeiten passend', 'Bei Wind/Regen/Frost Problem markieren.', true, false, 30),
    ('Baustart Standard', 'Baustelle eingerichtet', 'Zugang, Absperrung und Lagerflaeche geklaert.', true, false, 10),
    ('Baustart Standard', 'Kunde/Ansprechpartner informiert', 'Start, Ablauf und Besonderheiten kurz abstimmen.', false, false, 20),
    ('Baustart Standard', 'Fotos vom Ausgangszustand erstellt', 'Vorher-Fotos als Nachweis speichern.', true, true, 30),
    ('Tagesabschluss Baustelle', 'Baustelle wetterfest gesichert', 'Folien, offene Flaechen, Material und Werkzeug sichern.', true, true, 10),
    ('Tagesabschluss Baustelle', 'Werkzeug und Material mitgenommen', 'Nichts offen liegen lassen.', true, false, 20),
    ('Tagesabschluss Baustelle', 'Tagesbericht/Zeiten vorbereitet', 'Fehlende Angaben sofort notieren.', false, false, 30),
    ('Abnahme Dacharbeiten', 'Leistung fachlich geprueft', 'Sichtpruefung, Anschluesse, Ortgang, First, Entwaesserung.', true, false, 10),
    ('Abnahme Dacharbeiten', 'Maengel dokumentiert oder ausgeschlossen', 'Problem markieren, wenn etwas offen ist.', true, true, 20),
    ('Abnahme Dacharbeiten', 'Kunde/Vertreter kann unterschreiben', 'Optional digitale Unterschrift erfassen.', false, false, 30),
    ('Material Vollstaendigkeit', 'Hauptmaterial vollstaendig', 'Ziegel/Bahn/Daemmung/Blech passend zur Planung.', true, false, 10),
    ('Material Vollstaendigkeit', 'Zubehoer vorhanden', 'Schrauben, Klammern, Dichtstoffe, Baender.', true, false, 20),
    ('Material Vollstaendigkeit', 'Fehlmaterial gemeldet', 'Problem markieren, wenn Bestand fehlt.', false, false, 30),
    ('Geruest / Leiter Pruefung', 'Stand sicher und frei', 'Untergrund, Sicherung, Zugang pruefen.', true, true, 10),
    ('Geruest / Leiter Pruefung', 'Sichtbare Schaeden ausgeschlossen', 'Defekte Leiter/Geruestteile sofort als Problem markieren.', true, true, 20),
    ('Dacharbeiten Qualitaet', 'Untergrund vorbereitet', 'Alte Lattung/Bahn/Anschluesse geprueft.', true, false, 10),
    ('Dacharbeiten Qualitaet', 'Anschluesse sauber ausgefuehrt', 'Wand, Kamin, Kehlbereich, Durchdringungen pruefen.', true, true, 20),
    ('Dacharbeiten Qualitaet', 'Fotos der fertigen Bereiche erstellt', 'Nachweisfotos direkt am Punkt speichern.', true, true, 30)
) as item(template_name, label, help_text, required, photo_required, sort_order)
on item.template_name = inserted.name;

select pg_notify('pgrst', 'reload schema');

-- Final hard-delete deny-list for checklist business data.
drop policy if exists "redteam managers delete fallback" on public.checklist_templates;
drop policy if exists "redteam managers delete fallback" on public.checklist_template_items;
drop policy if exists "redteam managers delete fallback" on public.jobsite_checklists;
drop policy if exists "redteam managers delete fallback" on public.jobsite_checklist_items;
drop policy if exists "redteam managers delete fallback" on public.checklist_item_photos;

select pg_notify('pgrst', 'reload schema');
