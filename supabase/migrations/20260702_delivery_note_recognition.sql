-- Lieferschein-Erkennung per Foto mit bestaetigungspflichtigem Wareneingang.
-- Preisfelder liegen getrennt in einer Manager-only Tabelle, damit Vorarbeiter keine EK-Preise sehen.

insert into storage.buckets (id, name, public)
values ('delivery-notes', 'delivery-notes', false)
on conflict (id) do update set public = false;

create table if not exists public.delivery_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text,
  document_date date,
  status text not null default 'uploaded' check (status in ('uploaded', 'recognized', 'confirmed', 'rejected')),
  storage_path text not null unique,
  file_name text not null,
  content_type text not null,
  recognition_model text,
  recognition_confidence numeric(5, 2),
  recognized_json jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_note_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  delivery_note_id uuid not null references public.delivery_notes(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  supplier_article_number text,
  article_name text not null,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit text not null default 'Stueck',
  target_location_id uuid references public.inventory_locations(id) on delete set null,
  recognition_confidence numeric(5, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_note_item_prices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  delivery_note_item_id uuid not null unique references public.delivery_note_items(id) on delete cascade,
  unit_price numeric(12, 2),
  total_price numeric(12, 2),
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists delivery_notes_company_created_idx on public.delivery_notes(company_id, created_at desc);
create index if not exists delivery_notes_status_idx on public.delivery_notes(company_id, status, created_at desc);
create index if not exists delivery_note_items_note_idx on public.delivery_note_items(delivery_note_id);
create index if not exists delivery_note_items_inventory_idx on public.delivery_note_items(inventory_item_id);
create index if not exists delivery_note_item_prices_item_idx on public.delivery_note_item_prices(delivery_note_item_id);

drop trigger if exists set_delivery_notes_updated_at on public.delivery_notes;
create trigger set_delivery_notes_updated_at
before update on public.delivery_notes
for each row execute function public.set_updated_at();

drop trigger if exists set_delivery_note_items_updated_at on public.delivery_note_items;
create trigger set_delivery_note_items_updated_at
before update on public.delivery_note_items
for each row execute function public.set_updated_at();

drop trigger if exists set_delivery_note_item_prices_updated_at on public.delivery_note_item_prices;
create trigger set_delivery_note_item_prices_updated_at
before update on public.delivery_note_item_prices
for each row execute function public.set_updated_at();

alter table public.delivery_notes enable row level security;
alter table public.delivery_notes force row level security;
alter table public.delivery_note_items enable row level security;
alter table public.delivery_note_items force row level security;
alter table public.delivery_note_item_prices enable row level security;
alter table public.delivery_note_item_prices force row level security;

grant select, insert, update on public.delivery_notes to authenticated;
grant select, insert, update on public.delivery_note_items to authenticated;
grant select, insert, update on public.delivery_note_item_prices to authenticated;

drop policy if exists "operators read delivery notes" on public.delivery_notes;
create policy "operators read delivery notes"
on public.delivery_notes for select
to authenticated
using (company_id = public.current_company_id() and public.current_role() in ('admin', 'chef', 'vorarbeiter'));

drop policy if exists "operators create delivery notes" on public.delivery_notes;
create policy "operators create delivery notes"
on public.delivery_notes for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and created_by = auth.uid()
  and public.current_role() in ('admin', 'chef', 'vorarbeiter')
);

drop policy if exists "operators update delivery notes" on public.delivery_notes;
create policy "operators update delivery notes"
on public.delivery_notes for update
to authenticated
using (company_id = public.current_company_id() and public.current_role() in ('admin', 'chef', 'vorarbeiter'))
with check (company_id = public.current_company_id() and public.current_role() in ('admin', 'chef', 'vorarbeiter'));

drop policy if exists "operators read delivery note items" on public.delivery_note_items;
create policy "operators read delivery note items"
on public.delivery_note_items for select
to authenticated
using (company_id = public.current_company_id() and public.current_role() in ('admin', 'chef', 'vorarbeiter'));

drop policy if exists "operators create delivery note items" on public.delivery_note_items;
create policy "operators create delivery note items"
on public.delivery_note_items for insert
to authenticated
with check (company_id = public.current_company_id() and public.current_role() in ('admin', 'chef', 'vorarbeiter'));

drop policy if exists "operators update delivery note items" on public.delivery_note_items;
create policy "operators update delivery note items"
on public.delivery_note_items for update
to authenticated
using (company_id = public.current_company_id() and public.current_role() in ('admin', 'chef', 'vorarbeiter'))
with check (company_id = public.current_company_id() and public.current_role() in ('admin', 'chef', 'vorarbeiter'));

drop policy if exists "managers read delivery note item prices" on public.delivery_note_item_prices;
create policy "managers read delivery note item prices"
on public.delivery_note_item_prices for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers create delivery note item prices" on public.delivery_note_item_prices;
create policy "managers create delivery note item prices"
on public.delivery_note_item_prices for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update delivery note item prices" on public.delivery_note_item_prices;
create policy "managers update delivery note item prices"
on public.delivery_note_item_prices for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "operators read delivery note storage" on storage.objects;
create policy "operators read delivery note storage"
on storage.objects for select
to authenticated
using (
  bucket_id = 'delivery-notes'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'delivery-notes'
  and public.current_role() in ('admin', 'chef', 'vorarbeiter')
);

drop policy if exists "operators upload delivery note storage" on storage.objects;
create policy "operators upload delivery note storage"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'delivery-notes'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'delivery-notes'
  and public.current_role() in ('admin', 'chef', 'vorarbeiter')
);

create or replace function public.confirm_delivery_note(
  p_company_id uuid,
  p_delivery_note_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
set search_path = public
as $$
declare
  note_row public.delivery_notes%rowtype;
  item_row public.delivery_note_items%rowtype;
  current_stock numeric;
begin
  if p_company_id <> public.current_company_id()
    or public.current_role() not in ('admin', 'chef', 'vorarbeiter')
  then
    raise exception 'not_authorized';
  end if;

  if p_actor_id is distinct from auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  select *
  into note_row
  from public.delivery_notes
  where id = p_delivery_note_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'delivery_note_not_found';
  end if;

  if note_row.status = 'confirmed' then
    raise exception 'delivery_note_already_confirmed';
  end if;

  for item_row in
    select *
    from public.delivery_note_items
    where delivery_note_id = p_delivery_note_id
      and company_id = p_company_id
    order by created_at
  loop
    if item_row.inventory_item_id is null then
      raise exception 'delivery_note_item_missing_inventory';
    end if;

    select stock
    into current_stock
    from public.inventory_items
    where id = item_row.inventory_item_id
      and company_id = p_company_id
    for update;

    if not found then
      raise exception 'inventory_item_not_found';
    end if;

    update public.inventory_items
    set stock = current_stock + item_row.quantity,
        updated_at = now()
    where id = item_row.inventory_item_id
      and company_id = p_company_id;

    insert into public.material_movements (
      company_id,
      inventory_item_id,
      to_location_id,
      quantity,
      unit,
      movement_type,
      created_by,
      notes
    )
    values (
      p_company_id,
      item_row.inventory_item_id,
      item_row.target_location_id,
      item_row.quantity,
      item_row.unit,
      'purchase',
      p_actor_id,
      concat('Lieferschein ', coalesce(note_row.supplier_name, 'ohne Lieferant'), ' vom ', coalesce(note_row.document_date::text, 'ohne Datum'))
    );
  end loop;

  update public.delivery_notes
  set status = 'confirmed',
      confirmed_by = p_actor_id,
      confirmed_at = now()
  where id = p_delivery_note_id
    and company_id = p_company_id;

  insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, new_values)
  values (
    p_company_id,
    p_actor_id,
    'delivery_note',
    p_delivery_note_id,
    'delivery_note_confirmed',
    jsonb_build_object('status', 'confirmed')
  );
end;
$$;

grant execute on function public.confirm_delivery_note(uuid, uuid, uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
