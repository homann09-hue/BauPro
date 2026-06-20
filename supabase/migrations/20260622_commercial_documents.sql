-- Commercial document core: Angebote/Rechnungen from orders and material requirements.

create table if not exists public.commercial_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  jobsite_id uuid references public.jobsites(id) on delete set null,
  document_type text not null check (document_type in ('quote', 'invoice')),
  document_number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'paid', 'cancelled')),
  subject text not null,
  customer_snapshot jsonb not null default '{}'::jsonb,
  issue_date date not null default current_date,
  due_date date,
  valid_until date,
  subtotal_net numeric(12, 2) not null default 0,
  tax_rate numeric(7, 2) not null default 19,
  tax_total numeric(12, 2) not null default 0,
  total_gross numeric(12, 2) not null default 0,
  notes text,
  payment_terms text,
  created_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz,
  accepted_at timestamptz,
  paid_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, document_number)
);

create table if not exists public.commercial_document_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid not null references public.commercial_documents(id) on delete cascade,
  source_requirement_id uuid references public.job_material_requirements(id) on delete set null,
  position integer not null default 1,
  title text not null,
  description text,
  quantity numeric(12, 2) not null default 1,
  unit text not null default 'Stueck',
  unit_price_net numeric(12, 2) not null default 0,
  discount_percent numeric(7, 2) not null default 0,
  line_total_net numeric(12, 2) generated always as (
    round(coalesce(quantity, 0) * coalesce(unit_price_net, 0) * (1 - coalesce(discount_percent, 0) / 100), 2)
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity >= 0),
  check (unit_price_net >= 0),
  check (discount_percent >= 0 and discount_percent <= 100)
);

create index if not exists commercial_documents_company_type_status_idx
  on public.commercial_documents(company_id, document_type, status, issue_date desc);
create index if not exists commercial_documents_order_idx
  on public.commercial_documents(company_id, order_id, created_at desc);
create index if not exists commercial_documents_archived_idx
  on public.commercial_documents(company_id, archived_at, created_at desc);
create index if not exists commercial_document_items_document_idx
  on public.commercial_document_items(document_id, position);

alter table public.commercial_documents enable row level security;
alter table public.commercial_document_items enable row level security;
alter table public.commercial_documents force row level security;
alter table public.commercial_document_items force row level security;

drop policy if exists "managers read commercial documents" on public.commercial_documents;
create policy "managers read commercial documents"
on public.commercial_documents for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers insert commercial documents" on public.commercial_documents;
create policy "managers insert commercial documents"
on public.commercial_documents for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update commercial documents" on public.commercial_documents;
create policy "managers update commercial documents"
on public.commercial_documents for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers read commercial document items" on public.commercial_document_items;
create policy "managers read commercial document items"
on public.commercial_document_items for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers insert commercial document items" on public.commercial_document_items;
create policy "managers insert commercial document items"
on public.commercial_document_items for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers update commercial document items" on public.commercial_document_items;
create policy "managers update commercial document items"
on public.commercial_document_items for update
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company())
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "managers delete commercial document items" on public.commercial_document_items;
create policy "managers delete commercial document items"
on public.commercial_document_items for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop trigger if exists set_commercial_documents_updated_at on public.commercial_documents;
create trigger set_commercial_documents_updated_at
before update on public.commercial_documents
for each row execute function public.set_updated_at();

drop trigger if exists set_commercial_document_items_updated_at on public.commercial_document_items;
create trigger set_commercial_document_items_updated_at
before update on public.commercial_document_items
for each row execute function public.set_updated_at();

create or replace function public.recalculate_commercial_document_totals(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  subtotal numeric(12, 2);
  doc_tax_rate numeric(7, 2);
begin
  select coalesce(sum(line_total_net), 0)
  into subtotal
  from public.commercial_document_items
  where document_id = p_document_id;

  select tax_rate
  into doc_tax_rate
  from public.commercial_documents
  where id = p_document_id;

  update public.commercial_documents
  set
    subtotal_net = subtotal,
    tax_total = round(subtotal * coalesce(doc_tax_rate, 19) / 100, 2),
    total_gross = round(subtotal * (1 + coalesce(doc_tax_rate, 19) / 100), 2),
    updated_at = now()
  where id = p_document_id;
end;
$$;

create or replace function public.recalculate_commercial_document_totals_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_commercial_document_totals(coalesce(new.document_id, old.document_id));
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists recalculate_commercial_document_totals_on_items on public.commercial_document_items;
create trigger recalculate_commercial_document_totals_on_items
after insert or update or delete on public.commercial_document_items
for each row execute function public.recalculate_commercial_document_totals_trigger();

grant execute on function public.recalculate_commercial_document_totals(uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
