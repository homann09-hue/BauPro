create or replace function public.insert_invoice_items_from_json(p_invoice_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Bitte mindestens eine Position erfassen.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as parsed(item)
    where btrim(coalesce(item->>'description', '')) = ''
      or coalesce(nullif(item->>'quantity', '')::numeric, 0) <= 0
      or coalesce(nullif(item->>'unit_price_eur', '')::numeric, 0) < 0
  ) then
    raise exception 'Belegpositionen sind ungueltig.';
  end if;

  insert into public.invoice_items (
    invoice_id,
    description,
    quantity,
    unit,
    unit_price_eur,
    position
  )
  select
    p_invoice_id,
    left(btrim(item->>'description'), 1000),
    (item->>'quantity')::numeric,
    left(coalesce(nullif(btrim(item->>'unit'), ''), 'Stueck'), 40),
    coalesce(nullif(item->>'unit_price_eur', '')::numeric, 0),
    coalesce(nullif(item->>'position', '')::int, ordinality::int)
  from jsonb_array_elements(p_items) with ordinality as parsed(item, ordinality);
end;
$$;

create or replace function public.create_invoice_with_items(
  p_company_id uuid,
  p_customer_id uuid,
  p_order_id uuid,
  p_type text,
  p_issue_date date,
  p_due_date date,
  p_tax_rate_percent numeric,
  p_notes text,
  p_created_by uuid,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_invoice_id uuid;
  invoice_number text;
begin
  if p_company_id is distinct from public.current_company_id() or not public.can_manage_company() then
    raise exception 'Keine Berechtigung fuer diesen Beleg.';
  end if;

  if p_type not in ('angebot', 'rechnung', 'gutschrift') then
    raise exception 'Ungueltiger Belegtyp.';
  end if;

  if p_tax_rate_percent not in (0, 7, 19) then
    raise exception 'Ungueltiger MwSt.-Satz.';
  end if;

  if not exists (
    select 1 from public.customers
    where id = p_customer_id
      and company_id = p_company_id
      and archived_at is null
  ) then
    raise exception 'Kunde wurde nicht gefunden.';
  end if;

  if p_order_id is not null and not exists (
    select 1 from public.orders
    where id = p_order_id
      and company_id = p_company_id
      and customer_id = p_customer_id
      and archived_at is null
  ) then
    raise exception 'Auftrag wurde nicht gefunden.';
  end if;

  invoice_number := public.generate_invoice_number(p_company_id, p_type);

  insert into public.invoices (
    company_id,
    customer_id,
    order_id,
    type,
    status,
    invoice_number,
    issue_date,
    due_date,
    tax_rate_percent,
    notes,
    created_by
  )
  values (
    p_company_id,
    p_customer_id,
    p_order_id,
    p_type,
    'entwurf',
    invoice_number,
    p_issue_date,
    p_due_date,
    p_tax_rate_percent,
    nullif(btrim(coalesce(p_notes, '')), ''),
    p_created_by
  )
  returning id into created_invoice_id;

  perform public.insert_invoice_items_from_json(created_invoice_id, p_items);
  perform public.recalculate_invoice_totals(created_invoice_id);

  return created_invoice_id;
end;
$$;

create or replace function public.update_invoice_with_items(
  p_invoice_id uuid,
  p_company_id uuid,
  p_customer_id uuid,
  p_order_id uuid,
  p_type text,
  p_issue_date date,
  p_due_date date,
  p_tax_rate_percent numeric,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
begin
  if p_company_id is distinct from public.current_company_id() or not public.can_manage_company() then
    raise exception 'Keine Berechtigung fuer diesen Beleg.';
  end if;

  select status
  into current_status
  from public.invoices
  where id = p_invoice_id
    and company_id = p_company_id
    and archived_at is null
  for update;

  if current_status is null then
    raise exception 'Beleg wurde nicht gefunden.';
  end if;

  if current_status <> 'entwurf' then
    raise exception 'Nur Entwuerfe koennen bearbeitet werden.';
  end if;

  if p_type not in ('angebot', 'rechnung', 'gutschrift') then
    raise exception 'Ungueltiger Belegtyp.';
  end if;

  if p_tax_rate_percent not in (0, 7, 19) then
    raise exception 'Ungueltiger MwSt.-Satz.';
  end if;

  if not exists (
    select 1 from public.customers
    where id = p_customer_id
      and company_id = p_company_id
      and archived_at is null
  ) then
    raise exception 'Kunde wurde nicht gefunden.';
  end if;

  if p_order_id is not null and not exists (
    select 1 from public.orders
    where id = p_order_id
      and company_id = p_company_id
      and customer_id = p_customer_id
      and archived_at is null
  ) then
    raise exception 'Auftrag wurde nicht gefunden.';
  end if;

  update public.invoices
  set
    customer_id = p_customer_id,
    order_id = p_order_id,
    type = p_type,
    issue_date = p_issue_date,
    due_date = p_due_date,
    tax_rate_percent = p_tax_rate_percent,
    notes = nullif(btrim(coalesce(p_notes, '')), '')
  where id = p_invoice_id
    and company_id = p_company_id;

  update public.invoice_items
  set archived_at = now()
  where invoice_id = p_invoice_id
    and archived_at is null;

  perform public.insert_invoice_items_from_json(p_invoice_id, p_items);
  perform public.recalculate_invoice_totals(p_invoice_id);

  return p_invoice_id;
end;
$$;

create or replace function public.get_invoice_stats(p_company_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_company_id = public.current_company_id() and public.can_manage_company() then (
      select jsonb_build_object(
        'open_count', count(*) filter (where status in ('entwurf', 'gesendet')),
        'paid_count', count(*) filter (where status = 'bezahlt'),
        'total_gross', coalesce(sum(total_eur), 0)
      )
      from public.invoices
      where company_id = p_company_id
        and archived_at is null
    )
    else jsonb_build_object('open_count', 0, 'paid_count', 0, 'total_gross', 0)
  end
$$;

revoke all on function public.insert_invoice_items_from_json(uuid, jsonb) from public;
grant execute on function public.create_invoice_with_items(uuid, uuid, uuid, text, date, date, numeric, text, uuid, jsonb) to authenticated;
grant execute on function public.update_invoice_with_items(uuid, uuid, uuid, uuid, text, date, date, numeric, text, jsonb) to authenticated;
grant execute on function public.get_invoice_stats(uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
