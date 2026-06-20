-- Dashboard-Buendelabfrage: reduziert viele einzelne Supabase-Requests auf einen RPC.
-- Die Funktion prueft den angemeldeten Nutzer explizit gegen profiles, damit p_company_id
-- und p_can_manage nicht durch manipulierte Client-Daten missbraucht werden koennen.

create or replace function public.get_dashboard_summary(
  p_company_id uuid,
  p_user_id uuid,
  p_can_manage boolean,
  p_today date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_can_manage boolean;
  v_jobsites_count integer := 0;
  v_jobsites_list jsonb := '[]'::jsonb;
  v_weather_jobsites_list jsonb := '[]'::jsonb;
  v_reports_count integer := 0;
  v_reports_list jsonb := '[]'::jsonb;
  v_tasks_count integer := 0;
  v_tasks_list jsonb := '[]'::jsonb;
  v_time_entries_count integer := 0;
  v_time_entries_net_minutes integer := 0;
  v_time_entries_list jsonb := '[]'::jsonb;
  v_employees_count integer := 0;
  v_employees_list jsonb := '[]'::jsonb;
  v_low_stock_count integer := 0;
  v_material_alerts_count integer := 0;
  v_material_alerts_list jsonb := '[]'::jsonb;
  v_purchase_suggestions_count integer := 0;
  v_purchase_suggestions_list jsonb := '[]'::jsonb;
  v_bring_lists_count integer := 0;
  v_weather_orders_list jsonb := '[]'::jsonb;
  v_today_reports_count integer := 0;
  v_today_reports_list jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    raise exception 'dashboard access denied' using errcode = '42501';
  end if;

  select p.role::text
    into v_role
    from public.profiles p
   where p.id = auth.uid()
     and p.company_id = p_company_id
     and p.active = true;

  if v_role is null then
    raise exception 'dashboard company access denied' using errcode = '42501';
  end if;

  v_can_manage := v_role in ('admin', 'chef');

  if coalesce(p_can_manage, false) and not v_can_manage then
    raise exception 'dashboard role access denied' using errcode = '42501';
  end if;

  select count(*)
    into v_jobsites_count
    from public.jobsites j
   where j.company_id = p_company_id
     and j.status in ('geplant', 'aktiv')
     and (v_can_manage or p_user_id = any(coalesce(j.assigned_employee_ids, array[]::uuid[])));

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.start_date asc nulls last), '[]'::jsonb)
    into v_jobsites_list
    from (
      select j.id, j.company_id, j.name, j.customer, j.address, j.start_date, j.status, j.notes,
             j.assigned_employee_ids, j.latitude, j.longitude, j.weather_last_checked_at, j.created_at
        from public.jobsites j
       where j.company_id = p_company_id
         and j.status in ('geplant', 'aktiv')
         and (v_can_manage or p_user_id = any(coalesce(j.assigned_employee_ids, array[]::uuid[])))
       order by j.start_date asc nulls last
       limit 5
    ) row_data;

  if v_can_manage then
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.start_date asc nulls last), '[]'::jsonb)
      into v_weather_jobsites_list
      from (
        select j.id, j.company_id, j.name, j.customer, j.address, j.start_date, j.status, j.notes,
               j.assigned_employee_ids, j.latitude, j.longitude, j.weather_last_checked_at, j.created_at
          from public.jobsites j
         where j.company_id = p_company_id
           and j.status in ('geplant', 'aktiv')
         order by j.start_date asc nulls last
         limit 80
      ) row_data;

    select count(*)
      into v_employees_count
      from public.profiles p
     where p.company_id = p_company_id
       and p.active = true
       and p.role in ('mitarbeiter', 'vorarbeiter');

    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.full_name asc nulls last), '[]'::jsonb)
      into v_employees_list
      from (
        select p.id, p.company_id, p.email, p.full_name, p.role, p.active
          from public.profiles p
         where p.company_id = p_company_id
           and p.active = true
           and p.role in ('mitarbeiter', 'vorarbeiter')
         order by p.full_name asc nulls last
      ) row_data;

    select count(*)
      into v_low_stock_count
      from public.inventory_items i
     where i.company_id = p_company_id
       and i.stock <= i.minimum_stock;

    select count(*)
      into v_material_alerts_count
      from public.material_alerts ma
     where ma.company_id = p_company_id
       and ma.status = 'open';

    select coalesce(jsonb_agg(item order by created_at desc), '[]'::jsonb)
      into v_material_alerts_list
      from (
        select ma.created_at,
               jsonb_build_object(
                 'id', ma.id,
                 'company_id', ma.company_id,
                 'material_id', ma.material_id,
                 'inventory_item_id', ma.inventory_item_id,
                 'job_id', ma.job_id,
                 'bring_list_id', ma.bring_list_id,
                 'alert_type', ma.alert_type,
                 'severity', ma.severity,
                 'message', ma.message,
                 'required_quantity', ma.required_quantity,
                 'available_quantity', ma.available_quantity,
                 'missing_quantity', ma.missing_quantity,
                 'unit', ma.unit,
                 'status', ma.status,
                 'created_by_system', ma.created_by_system,
                 'assigned_to_admin', ma.assigned_to_admin,
                 'created_at', ma.created_at,
                 'acknowledged_at', ma.acknowledged_at,
                 'resolved_at', ma.resolved_at,
                 'inventory_items',
                   case when i.id is null then null else jsonb_build_object('id', i.id, 'name', i.name, 'unit', i.unit, 'stock', i.stock, 'minimum_stock', i.minimum_stock) end,
                 'jobsites',
                   case when j.id is null then null else jsonb_build_object('id', j.id, 'name', j.name, 'address', j.address, 'customer', j.customer) end,
                 'bring_lists',
                   case when bl.id is null then null else jsonb_build_object('id', bl.id, 'title', bl.title, 'date', bl.date) end
               ) as item
          from public.material_alerts ma
          left join public.inventory_items i on i.id = ma.inventory_item_id and i.company_id = ma.company_id
          left join public.jobsites j on j.id = ma.job_id and j.company_id = ma.company_id
          left join public.bring_lists bl on bl.id = ma.bring_list_id and bl.company_id = ma.company_id
         where ma.company_id = p_company_id
           and ma.status = 'open'
         order by ma.created_at desc
         limit 6
      ) alerts;

    select count(*)
      into v_purchase_suggestions_count
      from public.purchase_suggestions ps
     where ps.company_id = p_company_id
       and ps.status = 'open';

    select coalesce(jsonb_agg(item order by created_at desc), '[]'::jsonb)
      into v_purchase_suggestions_list
      from (
        select ps.created_at,
               jsonb_build_object(
                 'id', ps.id,
                 'company_id', ps.company_id,
                 'material_id', ps.material_id,
                 'inventory_item_id', ps.inventory_item_id,
                 'job_id', ps.job_id,
                 'bring_list_id', ps.bring_list_id,
                 'quantity_needed', ps.quantity_needed,
                 'unit', ps.unit,
                 'reason', ps.reason,
                 'status', ps.status,
                 'created_at', ps.created_at,
                 'updated_at', ps.updated_at,
                 'inventory_items',
                   case when i.id is null then null else jsonb_build_object('id', i.id, 'name', i.name, 'unit', i.unit, 'stock', i.stock, 'minimum_stock', i.minimum_stock) end,
                 'jobsites',
                   case when j.id is null then null else jsonb_build_object('id', j.id, 'name', j.name, 'address', j.address, 'customer', j.customer) end,
                 'bring_lists',
                   case when bl.id is null then null else jsonb_build_object('id', bl.id, 'title', bl.title, 'date', bl.date) end
               ) as item
          from public.purchase_suggestions ps
          left join public.inventory_items i on i.id = ps.inventory_item_id and i.company_id = ps.company_id
          left join public.jobsites j on j.id = ps.job_id and j.company_id = ps.company_id
          left join public.bring_lists bl on bl.id = ps.bring_list_id and bl.company_id = ps.company_id
         where ps.company_id = p_company_id
           and ps.status = 'open'
         order by ps.created_at desc
         limit 6
      ) suggestions;

    select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb)
      into v_weather_orders_list
      from (
        select o.id, o.jobsite_id, o.status, o.priority, o.start_date, o.end_date
          from public.orders o
         where o.company_id = p_company_id
           and o.status in ('geplant', 'in_arbeit')
         limit 100
      ) row_data;
  else
    select count(*)
      into v_bring_lists_count
      from public.bring_lists bl
     where bl.company_id = p_company_id
       and bl.date >= p_today
       and (bl.assigned_to = p_user_id or bl.created_by = p_user_id);
  end if;

  select count(*)
    into v_reports_count
    from public.reports r
   where r.company_id = p_company_id
     and r.archived_at is null
     and (v_can_manage or r.created_by = p_user_id);

  select coalesce(jsonb_agg(item order by report_date desc), '[]'::jsonb)
    into v_reports_list
    from (
      select r.report_date,
             jsonb_build_object(
               'id', r.id,
               'company_id', r.company_id,
               'jobsite_id', r.jobsite_id,
               'report_date', r.report_date,
               'weather', r.weather,
               'weather_summary', r.weather_summary,
               'weather_temperature_c', r.weather_temperature_c,
               'weather_precipitation_mm', r.weather_precipitation_mm,
               'weather_wind_kmh', r.weather_wind_kmh,
               'weather_source', r.weather_source,
               'weather_fetched_at', r.weather_fetched_at,
               'weather_lat', r.weather_lat,
               'weather_lng', r.weather_lng,
               'work_start', r.work_start,
               'work_end', r.work_end,
               'employee_ids', r.employee_ids,
               'activities', r.activities,
               'material_usage', r.material_usage,
               'issues', r.issues,
               'signature_name', r.signature_name,
               'created_by', r.created_by,
               'created_at', r.created_at,
               'jobsites',
                 case when j.id is null then null else jsonb_build_object('id', j.id, 'name', j.name, 'customer', j.customer, 'address', j.address) end
             ) as item
        from public.reports r
        left join public.jobsites j on j.id = r.jobsite_id and j.company_id = r.company_id
       where r.company_id = p_company_id
         and r.archived_at is null
         and (v_can_manage or r.created_by = p_user_id)
       order by r.report_date desc
       limit 5
    ) reports;

  select count(*)
    into v_tasks_count
    from public.tasks t
   where t.company_id = p_company_id
     and t.archived_at is null
     and t.status <> 'erledigt'
     and (v_can_manage or t.assigned_to = p_user_id);

  select coalesce(jsonb_agg(item order by due_date asc nulls last), '[]'::jsonb)
    into v_tasks_list
    from (
      select t.due_date,
             jsonb_build_object(
               'id', t.id,
               'company_id', t.company_id,
               'jobsite_id', t.jobsite_id,
               'title', t.title,
               'description', t.description,
               'assigned_to', t.assigned_to,
               'due_date', t.due_date,
               'status', t.status,
               'jobsites',
                 case when j.id is null then null else jsonb_build_object('id', j.id, 'name', j.name) end,
               'profiles',
                 case when p.id is null then null else jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email) end
             ) as item
        from public.tasks t
        left join public.jobsites j on j.id = t.jobsite_id and j.company_id = t.company_id
        left join public.profiles p on p.id = t.assigned_to and p.company_id = t.company_id
       where t.company_id = p_company_id
         and t.archived_at is null
         and t.status <> 'erledigt'
         and (v_can_manage or t.assigned_to = p_user_id)
       order by t.due_date asc nulls last
       limit 8
    ) tasks;

  select count(*), coalesce(sum(te.net_minutes), 0)
    into v_time_entries_count, v_time_entries_net_minutes
    from public.time_entries te
   where te.company_id = p_company_id
     and te.date = p_today
     and (v_can_manage or te.employee_id = p_user_id);

  select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb)
    into v_time_entries_list
    from (
      select te.id, te.company_id, te.employee_id, te.job_id, te.date, te.status, te.net_minutes
        from public.time_entries te
       where te.company_id = p_company_id
         and te.date = p_today
         and (v_can_manage or te.employee_id = p_user_id)
       limit 200
    ) row_data;

  select count(*)
    into v_today_reports_count
    from public.reports r
   where r.company_id = p_company_id
     and r.archived_at is null
     and r.report_date = p_today
     and (v_can_manage or r.created_by = p_user_id);

  select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb)
    into v_today_reports_list
    from (
      select r.id, r.jobsite_id, r.report_date
        from public.reports r
       where r.company_id = p_company_id
         and r.archived_at is null
         and r.report_date = p_today
         and (v_can_manage or r.created_by = p_user_id)
       limit 100
    ) row_data;

  return jsonb_build_object(
    'jobsites_active', jsonb_build_object('count', v_jobsites_count, 'list', v_jobsites_list),
    'reports_latest', jsonb_build_object('count', v_reports_count, 'list', v_reports_list),
    'tasks_open', jsonb_build_object('count', v_tasks_count, 'list', v_tasks_list),
    'today_time_entries', jsonb_build_object('count', v_time_entries_count, 'net_minutes', v_time_entries_net_minutes, 'list', v_time_entries_list),
    'employees_active', jsonb_build_object('count', v_employees_count, 'list', v_employees_list),
    'low_stock_count', v_low_stock_count,
    'open_alerts_count', v_material_alerts_count,
    'material_alerts_open', jsonb_build_object('count', v_material_alerts_count, 'list', v_material_alerts_list),
    'open_suggestions_count', v_purchase_suggestions_count,
    'purchase_suggestions_open', jsonb_build_object('count', v_purchase_suggestions_count, 'list', v_purchase_suggestions_list),
    'bring_lists_upcoming', jsonb_build_object('count', v_bring_lists_count),
    'weather_jobsites', jsonb_build_object('list', v_weather_jobsites_list),
    'weather_orders', jsonb_build_object('list', v_weather_orders_list),
    'today_reports_count', v_today_reports_count,
    'today_reports', jsonb_build_object('count', v_today_reports_count, 'list', v_today_reports_list)
  );
end;
$$;

revoke all on function public.get_dashboard_summary(uuid, uuid, boolean, date) from public;
grant execute on function public.get_dashboard_summary(uuid, uuid, boolean, date) to authenticated;

select pg_notify('pgrst', 'reload schema');
