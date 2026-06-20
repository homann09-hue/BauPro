-- Harden bring lists against direct client-side RLS abuse.
-- Workers may pack/report assigned lists, but they must not move lists/items
-- across jobsites, vehicles, users or tenants by manipulating requests.

create or replace function public.can_access_bring_list(
  p_company_id uuid,
  p_job_id uuid,
  p_assigned_to uuid,
  p_created_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_company_id = public.current_company_id()
    and (
      public.can_manage_company()
      or p_assigned_to = auth.uid()
      or p_created_by = auth.uid()
      or exists (
        select 1
        from public.jobsites j
        where j.id = p_job_id
          and j.company_id = p_company_id
          and auth.uid() = any(j.assigned_employee_ids)
      )
    )
$$;

drop policy if exists "read relevant bring lists" on public.bring_lists;
create policy "read relevant bring lists"
on public.bring_lists for select
to authenticated
using (public.can_access_bring_list(company_id, job_id, assigned_to, created_by));

drop policy if exists "create bring lists" on public.bring_lists;
create policy "create bring lists"
on public.bring_lists for insert
to authenticated
with check (
  company_id = public.current_company_id()
  and (public.can_manage_company() or created_by = auth.uid())
);

drop policy if exists "update relevant bring lists" on public.bring_lists;
create policy "update relevant bring lists"
on public.bring_lists for update
to authenticated
using (public.can_access_bring_list(company_id, job_id, assigned_to, created_by))
with check (public.can_access_bring_list(company_id, job_id, assigned_to, created_by));

drop policy if exists "managers delete bring lists" on public.bring_lists;
create policy "managers delete bring lists"
on public.bring_lists for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "read relevant bring list items" on public.bring_list_items;
create policy "read relevant bring list items"
on public.bring_list_items for select
to authenticated
using (
  exists (
    select 1
    from public.bring_lists bl
    where bl.id = bring_list_id
      and public.can_access_bring_list(bl.company_id, bl.job_id, bl.assigned_to, bl.created_by)
  )
);

drop policy if exists "create relevant bring list items" on public.bring_list_items;
create policy "create relevant bring list items"
on public.bring_list_items for insert
to authenticated
with check (
  exists (
    select 1
    from public.bring_lists bl
    where bl.id = bring_list_id
      and bl.company_id = public.current_company_id()
      and (public.can_manage_company() or bl.created_by = auth.uid())
  )
);

drop policy if exists "update relevant bring list items" on public.bring_list_items;
create policy "update relevant bring list items"
on public.bring_list_items for update
to authenticated
using (
  exists (
    select 1
    from public.bring_lists bl
    where bl.id = bring_list_id
      and public.can_access_bring_list(bl.company_id, bl.job_id, bl.assigned_to, bl.created_by)
  )
)
with check (
  exists (
    select 1
    from public.bring_lists bl
    where bl.id = bring_list_id
      and public.can_access_bring_list(bl.company_id, bl.job_id, bl.assigned_to, bl.created_by)
  )
);

drop policy if exists "managers delete bring list items" on public.bring_list_items;
create policy "managers delete bring list items"
on public.bring_list_items for delete
to authenticated
using (
  exists (
    select 1
    from public.bring_lists bl
    where bl.id = bring_list_id
      and bl.company_id = public.current_company_id()
      and public.can_manage_company()
  )
);

create or replace function public.validate_bring_list_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and new.company_id <> public.current_company_id() then
    raise exception 'not_authorized';
  end if;

  if not exists (
    select 1
    from public.jobsites
    where id = new.job_id
      and company_id = new.company_id
  ) then
    raise exception 'jobsite_not_found';
  end if;

  if new.created_by is not null and not exists (
    select 1
    from public.profiles
    where id = new.created_by
      and company_id = new.company_id
  ) then
    raise exception 'creator_not_found';
  end if;

  if new.assigned_to is not null and not exists (
    select 1
    from public.profiles
    where id = new.assigned_to
      and company_id = new.company_id
      and role in ('vorarbeiter', 'mitarbeiter')
  ) then
    raise exception 'assignee_not_found';
  end if;

  if new.vehicle_id is not null and not exists (
    select 1
    from public.vehicles
    where id = new.vehicle_id
      and company_id = new.company_id
  ) then
    raise exception 'vehicle_not_found';
  end if;

  if auth.uid() is not null and not public.can_manage_company() then
    if tg_op = 'INSERT' then
      if new.created_by is distinct from auth.uid() then
        raise exception 'actor_mismatch';
      end if;

      if new.assigned_to is distinct from auth.uid() then
        raise exception 'assignment_mismatch';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.company_id is distinct from old.company_id
        or new.job_id is distinct from old.job_id
        or new.date is distinct from old.date
        or new.title is distinct from old.title
        or new.notes is distinct from old.notes
        or new.created_by is distinct from old.created_by
        or new.assigned_to is distinct from old.assigned_to
        or new.vehicle_id is distinct from old.vehicle_id
      then
        raise exception 'restricted_bring_list_update';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_bring_list_tenant on public.bring_lists;
create trigger validate_bring_list_tenant
before insert or update on public.bring_lists
for each row execute function public.validate_bring_list_tenant();

create or replace function public.validate_bring_list_item_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  list_company_id uuid;
begin
  select company_id
  into list_company_id
  from public.bring_lists
  where id = new.bring_list_id;

  if list_company_id is null then
    raise exception 'bring_list_not_found';
  end if;

  if auth.uid() is not null and list_company_id <> public.current_company_id() then
    raise exception 'not_authorized';
  end if;

  if new.material_id is not null and not exists (
    select 1
    from public.materials
    where id = new.material_id
      and company_id = list_company_id
  ) then
    raise exception 'material_not_found';
  end if;

  if new.inventory_item_id is not null and not exists (
    select 1
    from public.inventory_items
    where id = new.inventory_item_id
      and company_id = list_company_id
  ) then
    raise exception 'inventory_item_not_found';
  end if;

  if new.vehicle_id is not null and not exists (
    select 1
    from public.vehicles
    where id = new.vehicle_id
      and company_id = list_company_id
  ) then
    raise exception 'vehicle_not_found';
  end if;

  if auth.uid() is not null and not public.can_manage_company() then
    if tg_op = 'INSERT' then
      if not exists (
        select 1
        from public.bring_lists bl
        where bl.id = new.bring_list_id
          and bl.company_id = public.current_company_id()
          and bl.created_by = auth.uid()
      ) then
        raise exception 'not_authorized';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.bring_list_id is distinct from old.bring_list_id
        or new.material_id is distinct from old.material_id
        or new.inventory_item_id is distinct from old.inventory_item_id
        or new.custom_item_name is distinct from old.custom_item_name
        or new.item_type is distinct from old.item_type
        or new.quantity is distinct from old.quantity
        or new.unit is distinct from old.unit
        or new.storage_location is distinct from old.storage_location
        or new.vehicle_id is distinct from old.vehicle_id
        or new.notes is distinct from old.notes
        or new.created_at is distinct from old.created_at
      then
        raise exception 'restricted_bring_list_item_update';
      end if;

      if old.missing_reported and not new.missing_reported then
        raise exception 'restricted_missing_report_reset';
      end if;

      if new.packed and new.packed_by is distinct from auth.uid() then
        raise exception 'actor_mismatch';
      end if;

      if not new.packed and new.packed_by is not null then
        raise exception 'actor_mismatch';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_bring_list_item_tenant on public.bring_list_items;
create trigger validate_bring_list_item_tenant
before insert or update on public.bring_list_items
for each row execute function public.validate_bring_list_item_tenant();

select pg_notify('pgrst', 'reload schema');
