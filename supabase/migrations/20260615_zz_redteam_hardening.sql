-- Redteam hardening: tenant RLS force, atomic inventory RPCs and critical audit hooks.

do $$
declare
  row record;
begin
  for row in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table %I.%I enable row level security', row.schemaname, row.tablename);
    execute format('alter table %I.%I force row level security', row.schemaname, row.tablename);
  end loop;
end $$;

do $$
declare
  row record;
begin
  for row in
    select table_schema, table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'company_id'
      and table_name not like 'pg_%'
  loop
    execute format('drop policy if exists "redteam managers select fallback" on %I.%I', row.table_schema, row.table_name);
    execute format(
      'create policy "redteam managers select fallback" on %I.%I for select to authenticated using (company_id = public.current_company_id() and public.can_manage_company())',
      row.table_schema,
      row.table_name
    );

    execute format('drop policy if exists "redteam managers insert fallback" on %I.%I', row.table_schema, row.table_name);
    execute format(
      'create policy "redteam managers insert fallback" on %I.%I for insert to authenticated with check (company_id = public.current_company_id() and public.can_manage_company())',
      row.table_schema,
      row.table_name
    );

    execute format('drop policy if exists "redteam managers update fallback" on %I.%I', row.table_schema, row.table_name);
    execute format(
      'create policy "redteam managers update fallback" on %I.%I for update to authenticated using (company_id = public.current_company_id() and public.can_manage_company()) with check (company_id = public.current_company_id() and public.can_manage_company())',
      row.table_schema,
      row.table_name
    );

    execute format('drop policy if exists "redteam managers delete fallback" on %I.%I', row.table_schema, row.table_name);
    execute format(
      'create policy "redteam managers delete fallback" on %I.%I for delete to authenticated using (company_id = public.current_company_id() and public.can_manage_company())',
      row.table_schema,
      row.table_name
    );
  end loop;
end $$;

drop policy if exists "read own company inventory items" on public.inventory_items;
drop policy if exists "managers can read inventory items with prices" on public.inventory_items;
create policy "managers can read inventory items with prices"
on public.inventory_items for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "read own company materials" on public.materials;
drop policy if exists "managers can read materials with prices" on public.materials;
create policy "managers can read materials with prices"
on public.materials for select
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "authenticated can read active material catalog" on public.material_catalog;
drop policy if exists "managers can read priced material catalog" on public.material_catalog;
create policy "managers can read priced material catalog"
on public.material_catalog for select
to authenticated
using (active = true and public.can_manage_company());

drop policy if exists "members can upload company report photos" on storage.objects;
create policy "members can upload company report photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'report-photos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'reports'
  and exists (
    select 1 from public.reports r
    where r.company_id = public.current_company_id()
      and r.id::text = (storage.foldername(name))[3]
      and (public.can_manage_company() or r.created_by = auth.uid() or auth.uid() = any(r.employee_ids))
  )
);

create or replace function public.adjust_inventory_stock(
  p_company_id uuid,
  p_item_id uuid,
  p_mode text,
  p_amount numeric,
  p_actor_id uuid
)
returns numeric
language plpgsql
set search_path = public
as $$
declare
  current_stock numeric;
  next_stock numeric;
begin
  if p_company_id <> public.current_company_id() or not public.can_manage_company() then
    raise exception 'not_authorized';
  end if;

  if p_amount < 0 or p_mode not in ('increase', 'decrease', 'set') then
    raise exception 'invalid_inventory_adjustment';
  end if;

  select stock
  into current_stock
  from public.inventory_items
  where id = p_item_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'inventory_item_not_found';
  end if;

  next_stock := case
    when p_mode = 'increase' then current_stock + p_amount
    when p_mode = 'decrease' then current_stock - p_amount
    else p_amount
  end;

  if next_stock < 0 then
    raise exception 'negative_stock_not_allowed';
  end if;

  update public.inventory_items
  set stock = next_stock,
      updated_at = now()
  where id = p_item_id
    and company_id = p_company_id;

  insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
  values (
    p_company_id,
    p_actor_id,
    'inventory_item',
    p_item_id,
    'inventory_stock_adjusted',
    jsonb_build_object('stock', current_stock),
    jsonb_build_object('stock', next_stock, 'mode', p_mode, 'amount', p_amount)
  );

  return next_stock;
end;
$$;

create or replace function public.transfer_inventory_item(
  p_company_id uuid,
  p_source_item_id uuid,
  p_target_location_id uuid,
  p_amount numeric,
  p_actor_id uuid
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  source_item public.inventory_items%rowtype;
  target_item_id uuid;
begin
  if p_company_id <> public.current_company_id() or not public.can_manage_company() then
    raise exception 'not_authorized';
  end if;

  if p_amount <= 0 then
    raise exception 'invalid_transfer_amount';
  end if;

  select *
  into source_item
  from public.inventory_items
  where id = p_source_item_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'source_inventory_item_not_found';
  end if;

  if source_item.location_id = p_target_location_id then
    raise exception 'same_inventory_location';
  end if;

  if not exists (
    select 1 from public.inventory_locations
    where id = p_target_location_id
      and company_id = p_company_id
      and active = true
  ) then
    raise exception 'target_location_not_found';
  end if;

  if source_item.stock < p_amount then
    raise exception 'insufficient_source_stock';
  end if;

  update public.inventory_items
  set stock = stock - p_amount,
      updated_at = now()
  where id = p_source_item_id
    and company_id = p_company_id;

  if source_item.catalog_item_id is not null then
    insert into public.inventory_items (
      company_id,
      catalog_item_id,
      category_id,
      subcategory_id,
      location_id,
      supplier_id,
      name,
      unit,
      stock,
      minimum_stock,
      package_unit,
      manufacturer,
      article_number,
      ean,
      purchase_price,
      sales_price,
      markup_percent,
      sales_unit,
      price_per_unit,
      notes,
      created_by
    )
    values (
      p_company_id,
      source_item.catalog_item_id,
      source_item.category_id,
      source_item.subcategory_id,
      p_target_location_id,
      source_item.supplier_id,
      source_item.name,
      source_item.unit,
      p_amount,
      source_item.minimum_stock,
      source_item.package_unit,
      source_item.manufacturer,
      source_item.article_number,
      source_item.ean,
      source_item.purchase_price,
      source_item.sales_price,
      source_item.markup_percent,
      source_item.sales_unit,
      source_item.price_per_unit,
      source_item.notes,
      p_actor_id
    )
    on conflict (company_id, catalog_item_id, location_id)
    do update set stock = public.inventory_items.stock + excluded.stock,
                  updated_at = now()
    returning id into target_item_id;
  else
    insert into public.inventory_items (
      company_id,
      category_id,
      subcategory_id,
      location_id,
      supplier_id,
      name,
      unit,
      stock,
      minimum_stock,
      package_unit,
      manufacturer,
      article_number,
      ean,
      purchase_price,
      sales_price,
      markup_percent,
      sales_unit,
      price_per_unit,
      notes,
      created_by
    )
    values (
      p_company_id,
      source_item.category_id,
      source_item.subcategory_id,
      p_target_location_id,
      source_item.supplier_id,
      source_item.name,
      source_item.unit,
      p_amount,
      source_item.minimum_stock,
      source_item.package_unit,
      source_item.manufacturer,
      source_item.article_number,
      source_item.ean,
      source_item.purchase_price,
      source_item.sales_price,
      source_item.markup_percent,
      source_item.sales_unit,
      source_item.price_per_unit,
      source_item.notes,
      p_actor_id
    )
    returning id into target_item_id;
  end if;

  insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
  values (
    p_company_id,
    p_actor_id,
    'inventory_item',
    p_source_item_id,
    'inventory_transferred',
    jsonb_build_object('source_stock', source_item.stock, 'source_location_id', source_item.location_id),
    jsonb_build_object('target_item_id', target_item_id, 'target_location_id', p_target_location_id, 'amount', p_amount)
  );

  return target_item_id;
end;
$$;

create or replace function public.reserve_inventory_item(
  p_company_id uuid,
  p_job_id uuid,
  p_bring_list_id uuid,
  p_material_id uuid,
  p_inventory_item_id uuid,
  p_quantity_required numeric,
  p_quantity_requested numeric,
  p_unit text,
  p_reserved_by uuid
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  item_stock numeric;
  existing_reservation_id uuid;
  existing_reserved numeric := 0;
  active_reserved numeric := 0;
  available_quantity numeric;
  reserved_quantity numeric;
  reservation_status text;
begin
  if p_company_id <> public.current_company_id() or not public.can_manage_company() then
    raise exception 'not_authorized';
  end if;

  if p_quantity_required < 0 or p_quantity_requested < 0 then
    raise exception 'invalid_reservation_quantity';
  end if;

  select stock
  into item_stock
  from public.inventory_items
  where id = p_inventory_item_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'inventory_item_not_found';
  end if;

  select id, quantity_reserved
  into existing_reservation_id, existing_reserved
  from public.material_reservations
  where company_id = p_company_id
    and inventory_item_id = p_inventory_item_id
    and (
      (p_bring_list_id is null and bring_list_id is null)
      or bring_list_id = p_bring_list_id
    )
    and status in ('open', 'reserved', 'partially_reserved')
  order by created_at asc
  limit 1
  for update;

  select coalesce(sum(quantity_reserved), 0)
  into active_reserved
  from public.material_reservations
  where company_id = p_company_id
    and inventory_item_id = p_inventory_item_id
    and status in ('open', 'reserved', 'partially_reserved');

  available_quantity := greatest(item_stock - active_reserved + coalesce(existing_reserved, 0), 0);
  reserved_quantity := least(p_quantity_requested, available_quantity);
  reservation_status := case
    when reserved_quantity <= 0 then 'missing'
    when reserved_quantity < p_quantity_required then 'partially_reserved'
    else 'reserved'
  end;

  if existing_reservation_id is not null then
    update public.material_reservations
    set job_id = p_job_id,
        bring_list_id = p_bring_list_id,
        material_id = p_material_id,
        quantity_required = p_quantity_required,
        quantity_reserved = reserved_quantity,
        unit = p_unit,
        status = reservation_status,
        reserved_by = p_reserved_by,
        reserved_at = now(),
        updated_at = now()
    where id = existing_reservation_id
      and company_id = p_company_id
    returning id into existing_reservation_id;
  else
    insert into public.material_reservations (
      company_id,
      job_id,
      bring_list_id,
      material_id,
      inventory_item_id,
      quantity_required,
      quantity_reserved,
      unit,
      status,
      reserved_by,
      reserved_at
    )
    values (
      p_company_id,
      p_job_id,
      p_bring_list_id,
      p_material_id,
      p_inventory_item_id,
      p_quantity_required,
      reserved_quantity,
      p_unit,
      reservation_status,
      p_reserved_by,
      now()
    )
    returning id into existing_reservation_id;
  end if;

  insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, new_values)
  values (
    p_company_id,
    p_reserved_by,
    'material_reservation',
    existing_reservation_id,
    'material_reserved',
    jsonb_build_object(
      'inventory_item_id', p_inventory_item_id,
      'quantity_required', p_quantity_required,
      'quantity_reserved', reserved_quantity,
      'available_before_reservation', available_quantity
    )
  );

  return existing_reservation_id;
end;
$$;

grant execute on function public.adjust_inventory_stock(uuid, uuid, text, numeric, uuid) to authenticated;
grant execute on function public.transfer_inventory_item(uuid, uuid, uuid, numeric, uuid) to authenticated;
grant execute on function public.reserve_inventory_item(uuid, uuid, uuid, uuid, uuid, numeric, numeric, text, uuid) to authenticated;

create or replace function public.audit_profile_role_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.role is distinct from new.role then
    insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
    values (
      new.company_id,
      auth.uid(),
      'profile',
      new.id,
      'role_changed',
      jsonb_build_object('role', old.role),
      jsonb_build_object('role', new.role)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_profile_role_change on public.profiles;
create trigger audit_profile_role_change
after update of role on public.profiles
for each row execute function public.audit_profile_role_change();

create or replace function public.audit_inventory_price_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.purchase_price is distinct from new.purchase_price
    or old.sales_price is distinct from new.sales_price
    or old.markup_percent is distinct from new.markup_percent
    or old.price_per_unit is distinct from new.price_per_unit then
    insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
    values (
      new.company_id,
      auth.uid(),
      'inventory_item',
      new.id,
      'price_changed',
      jsonb_build_object(
        'purchase_price', old.purchase_price,
        'sales_price', old.sales_price,
        'markup_percent', old.markup_percent,
        'price_per_unit', old.price_per_unit
      ),
      jsonb_build_object(
        'purchase_price', new.purchase_price,
        'sales_price', new.sales_price,
        'markup_percent', new.markup_percent,
        'price_per_unit', new.price_per_unit
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_inventory_price_change on public.inventory_items;
create trigger audit_inventory_price_change
after update of purchase_price, sales_price, markup_percent, price_per_unit on public.inventory_items
for each row execute function public.audit_inventory_price_change();

create or replace function public.audit_supplier_key_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.api_key_encrypted is distinct from new.api_key_encrypted then
    insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
    values (
      new.company_id,
      auth.uid(),
      'supplier_integration',
      new.id,
      'supplier_key_changed',
      jsonb_build_object('had_key', old.api_key_encrypted is not null),
      jsonb_build_object('has_key', new.api_key_encrypted is not null)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_supplier_key_change on public.supplier_integrations;
create trigger audit_supplier_key_change
after update of api_key_encrypted on public.supplier_integrations
for each row execute function public.audit_supplier_key_change();

select pg_notify('pgrst', 'reload schema');
