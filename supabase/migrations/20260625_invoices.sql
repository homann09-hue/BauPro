-- Angebots- und Rechnungsmodul.
-- Bewusst getrennt vom Stripe-Billing: diese Tabellen sind fuer Kundenangebote,
-- Rechnungen und Gutschriften der Handwerksfirma.

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  type text not null check (type in ('angebot', 'rechnung', 'gutschrift')),
  status text not null default 'entwurf' check (status in ('entwurf', 'gesendet', 'bezahlt', 'storniert')),
  invoice_number text not null,
  issue_date date not null default current_date,
  due_date date,
  subtotal_eur numeric(12, 2) not null default 0,
  tax_rate_percent numeric(7, 2) not null default 19 check (tax_rate_percent in (0, 7, 19)),
  tax_eur numeric(12, 2) not null default 0,
  total_eur numeric(12, 2) not null default 0,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (company_id, invoice_number)
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit text not null default 'Stueck',
  unit_price_eur numeric(12, 2) not null default 0 check (unit_price_eur >= 0),
  total_eur numeric(12, 2) generated always as (
    round(coalesce(quantity, 0) * coalesce(unit_price_eur, 0), 2)
  ) stored,
  position integer not null default 1,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists invoices_company_type_status_idx
  on public.invoices(company_id, type, status, issue_date desc)
  where archived_at is null;

create index if not exists invoices_company_customer_idx
  on public.invoices(company_id, customer_id, created_at desc)
  where archived_at is null;

create index if not exists invoices_company_order_idx
  on public.invoices(company_id, order_id, created_at desc)
  where archived_at is null;

create index if not exists invoice_items_invoice_position_idx
  on public.invoice_items(invoice_id, position)
  where archived_at is null;

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoices force row level security;
alter table public.invoice_items force row level security;

grant select, insert, update on public.invoices to authenticated;
grant select, insert, update, delete on public.invoice_items to authenticated;

drop policy if exists "managers read invoices" on public.invoices;
create policy "managers read invoices"
on public.invoices for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "creators read own invoices" on public.invoices;
create policy "creators read own invoices"
on public.invoices for select
to authenticated
using (company_id = public.current_company_id() and created_by = auth.uid());

drop policy if exists "managers insert invoices" on public.invoices;
create policy "managers insert invoices"
on public.invoices for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update invoices" on public.invoices;
create policy "managers update invoices"
on public.invoices for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers read invoice items" on public.invoice_items;
create policy "managers read invoice items"
on public.invoice_items for select
to authenticated
using (
  exists (
    select 1
    from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.company_id = public.current_company_id()
      and public.can_manage_company()
  )
);

drop policy if exists "creators read own invoice items" on public.invoice_items;
create policy "creators read own invoice items"
on public.invoice_items for select
to authenticated
using (
  exists (
    select 1
    from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.company_id = public.current_company_id()
      and i.created_by = auth.uid()
  )
);

drop policy if exists "managers insert invoice items" on public.invoice_items;
create policy "managers insert invoice items"
on public.invoice_items for insert
to authenticated
with check (
  exists (
    select 1
    from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.company_id = public.current_company_id()
      and public.can_manage_company()
  )
);

drop policy if exists "managers update invoice items" on public.invoice_items;
create policy "managers update invoice items"
on public.invoice_items for update
to authenticated
using (
  exists (
    select 1
    from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.company_id = public.current_company_id()
      and public.can_manage_company()
  )
)
with check (
  exists (
    select 1
    from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.company_id = public.current_company_id()
      and public.can_manage_company()
  )
);

drop policy if exists "managers delete invoice items" on public.invoice_items;
create policy "managers delete invoice items"
on public.invoice_items for delete
to authenticated
using (
  exists (
    select 1
    from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.company_id = public.current_company_id()
      and public.can_manage_company()
  )
);

drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create or replace function public.generate_invoice_number(p_company_id uuid, p_type text default 'rechnung')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_year text := to_char(current_date, 'YYYY');
  prefix text;
  last_number int;
begin
  if p_type = 'angebot' then
    prefix := 'AN-' || current_year || '-';
  elsif p_type = 'gutschrift' then
    prefix := 'GS-' || current_year || '-';
  else
    prefix := 'RE-' || current_year || '-';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_company_id::text || ':' || prefix));

  select coalesce(max(nullif(regexp_replace(invoice_number, '^.*-', ''), '')::int), 0)
  into last_number
  from public.invoices
  where company_id = p_company_id
    and invoice_number like prefix || '%';

  return prefix || lpad((last_number + 1)::text, 4, '0');
end;
$$;

create or replace function public.recalculate_invoice_totals(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  subtotal numeric(12, 2);
  tax_rate numeric(7, 2);
begin
  select coalesce(sum(total_eur), 0)
  into subtotal
  from public.invoice_items
  where invoice_id = p_invoice_id
    and archived_at is null;

  select tax_rate_percent
  into tax_rate
  from public.invoices
  where id = p_invoice_id;

  update public.invoices
  set
    subtotal_eur = subtotal,
    tax_eur = round(subtotal * coalesce(tax_rate, 19) / 100, 2),
    total_eur = round(subtotal * (1 + coalesce(tax_rate, 19) / 100), 2)
  where id = p_invoice_id;
end;
$$;

create or replace function public.recalculate_invoice_totals_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_invoice_totals(coalesce(new.invoice_id, old.invoice_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists recalculate_invoice_totals_on_items on public.invoice_items;
create trigger recalculate_invoice_totals_on_items
after insert or update or delete on public.invoice_items
for each row execute function public.recalculate_invoice_totals_trigger();

grant execute on function public.generate_invoice_number(uuid, text) to authenticated;
grant execute on function public.recalculate_invoice_totals(uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
