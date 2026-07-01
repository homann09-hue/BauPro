-- BauPro: Auftragsanlage atomar machen.
-- Ziel: Auftragsnummern duerfen bei parallelen Klicks nicht kollidieren und
-- Baustelle + Auftrag werden in einer Transaktion erstellt.

create or replace function public.generate_order_number(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_year text := to_char(now(), 'YYYY');
  prefix text := 'AU-' || current_year || '-';
  last_number integer;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.';
  end if;

  if p_company_id is null or p_company_id <> public.current_company_id() then
    raise exception 'Keine Berechtigung fuer diese Firma.';
  end if;

  if not public.has_employee_permission('orders.create') then
    raise exception 'Keine Berechtigung zum Erstellen von Auftraegen.';
  end if;

  perform pg_advisory_xact_lock(hashtext('baupro-order-number:' || p_company_id::text || ':' || current_year));

  select coalesce(max(nullif(regexp_replace(order_number, '^' || prefix, ''), '')::integer), 0)
    into last_number
  from public.orders
  where company_id = p_company_id
    and order_number ~ ('^' || prefix || '[0-9]+$');

  return prefix || lpad((last_number + 1)::text, 4, '0');
end;
$$;

grant execute on function public.generate_order_number(uuid) to authenticated;

create or replace function public.create_order_with_jobsite(
  p_company_id uuid,
  p_customer_id uuid,
  p_title text,
  p_order_type text,
  p_status text,
  p_priority text,
  p_jobsite_address text,
  p_start_date date,
  p_end_date date,
  p_description text,
  p_internal_notes text,
  p_assigned_employee_ids uuid[],
  p_has_dimensions boolean,
  p_created_by uuid
)
returns table(order_id uuid, jobsite_id uuid, order_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_assigned_employee_ids uuid[] := coalesce(p_assigned_employee_ids, '{}'::uuid[]);
  resolved_customer_name text;
  generated_order_number text;
  created_jobsite_id uuid;
  created_order_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.';
  end if;

  if p_company_id is null or p_company_id <> public.current_company_id() then
    raise exception 'Keine Berechtigung fuer diese Firma.';
  end if;

  if p_created_by is distinct from auth.uid() then
    raise exception 'Auftrag kann nur fuer den angemeldeten Nutzer erstellt werden.';
  end if;

  if not public.has_employee_permission('orders.create') then
    raise exception 'Keine Berechtigung zum Erstellen von Auftraegen.';
  end if;

  if coalesce(length(trim(p_title)), 0) = 0 then
    raise exception 'Auftragstitel fehlt.';
  end if;

  if coalesce(length(trim(p_jobsite_address)), 0) = 0 then
    raise exception 'Baustellenadresse fehlt.';
  end if;

  if coalesce(length(trim(p_description)), 0) = 0 then
    raise exception 'Beschreibung fehlt.';
  end if;

  if p_order_type not in ('steildach', 'flachdach', 'reparatur', 'dachrinne', 'blech', 'wartung', 'sonstiges') then
    raise exception 'Ungueltige Auftragsart.';
  end if;

  if p_status not in ('anfrage', 'angebot', 'geplant', 'in_arbeit', 'fertig', 'abgerechnet') then
    raise exception 'Ungueltiger Auftragsstatus.';
  end if;

  if p_priority not in ('niedrig', 'normal', 'hoch') then
    raise exception 'Ungueltige Prioritaet.';
  end if;

  select coalesce(nullif(company, ''), nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), contact_person, email, 'Kunde')
    into resolved_customer_name
  from public.customers
  where id = p_customer_id
    and company_id = p_company_id
    and archived_at is null;

  if resolved_customer_name is null then
    raise exception 'Kunde wurde nicht gefunden.';
  end if;

  if exists (
    select 1
    from unnest(safe_assigned_employee_ids) as assigned(profile_id)
    left join public.profiles p
      on p.id = assigned.profile_id
     and p.company_id = p_company_id
     and p.active = true
     and p.role in ('mitarbeiter', 'vorarbeiter')
    where p.id is null
  ) then
    raise exception 'Nur aktive Mitarbeiter oder Vorarbeiter dieser Firma duerfen zugeordnet werden.';
  end if;

  generated_order_number := public.generate_order_number(p_company_id);

  insert into public.jobsites (
    company_id,
    name,
    customer,
    address,
    start_date,
    status,
    notes,
    assigned_employee_ids,
    created_by
  )
  values (
    p_company_id,
    trim(p_title),
    resolved_customer_name,
    trim(p_jobsite_address),
    p_start_date,
    case
      when p_status = 'in_arbeit' then 'aktiv'
      when p_status in ('fertig', 'abgerechnet') then 'abgeschlossen'
      else 'geplant'
    end,
    p_description,
    safe_assigned_employee_ids,
    p_created_by
  )
  returning id into created_jobsite_id;

  insert into public.orders (
    company_id,
    customer_id,
    jobsite_id,
    order_number,
    title,
    order_type,
    status,
    priority,
    jobsite_address,
    start_date,
    end_date,
    description,
    internal_notes,
    assigned_employee_ids,
    has_dimensions,
    created_by
  )
  values (
    p_company_id,
    p_customer_id,
    created_jobsite_id,
    generated_order_number,
    trim(p_title),
    p_order_type,
    p_status,
    p_priority,
    trim(p_jobsite_address),
    p_start_date,
    p_end_date,
    p_description,
    p_internal_notes,
    safe_assigned_employee_ids,
    coalesce(p_has_dimensions, false),
    p_created_by
  )
  returning id into created_order_id;

  return query select created_order_id, created_jobsite_id, generated_order_number;
end;
$$;

grant execute on function public.create_order_with_jobsite(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  date,
  date,
  text,
  text,
  uuid[],
  boolean,
  uuid
) to authenticated;

select pg_notify('pgrst', 'reload schema');
