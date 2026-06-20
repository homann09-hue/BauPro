-- Fix fuer Materialbestaetigungen:
-- Die alte Funktion nutzte eine lokale Variable "movement_id" mit gleichem Namen
-- wie die Tabellenspalte. Postgres wertet das in UPDATE/JSON-Kontexten als
-- mehrdeutig aus. Die Variable heisst jetzt eindeutig v_movement_id.

create or replace function public.confirm_material_usage_report(
  p_company_id uuid,
  p_report_id uuid,
  p_actor_id uuid,
  p_decision text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  report_row public.material_usage_reports%rowtype;
  current_item public.inventory_items%rowtype;
  next_stock numeric;
  v_movement_id uuid;
  existing_alert_id uuid;
  actor_can_confirm boolean;
begin
  if p_company_id <> public.current_company_id() then
    raise exception 'not_authorized';
  end if;

  if p_actor_id is distinct from auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if p_decision not in ('confirmed', 'rejected') then
    raise exception 'invalid_decision';
  end if;

  select *
  into report_row
  from public.material_usage_reports
  where id = p_report_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'usage_report_not_found';
  end if;

  if report_row.status <> 'reported' then
    raise exception 'usage_report_already_processed';
  end if;

  perform set_config('app.material_usage_confirmation', '1', true);

  actor_can_confirm := public.can_manage_company()
    or (
      public.current_role() = 'vorarbeiter'
      and exists (
        select 1
        from public.jobsites j
        where j.id = report_row.jobsite_id
          and j.company_id = p_company_id
          and auth.uid() = any(j.assigned_employee_ids)
      )
    );

  if not actor_can_confirm then
    raise exception 'not_authorized';
  end if;

  if p_decision = 'rejected' then
    update public.material_usage_reports
    set status = 'rejected',
        rejection_reason = nullif(p_note, ''),
        confirmed_by = p_actor_id,
        confirmed_at = now(),
        updated_at = now()
    where id = report_row.id
      and company_id = p_company_id;

    insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
    values (
      p_company_id,
      p_actor_id,
      'material_usage_report',
      report_row.id,
      'material_usage_rejected',
      jsonb_build_object('status', report_row.status),
      jsonb_build_object('status', 'rejected', 'reason', nullif(p_note, ''))
    );

    return null;
  end if;

  select *
  into current_item
  from public.inventory_items
  where id = report_row.inventory_item_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'inventory_item_not_found';
  end if;

  if report_row.booking_type in ('consume', 'loss', 'break') then
    if current_item.stock < report_row.quantity then
      raise exception 'negative_stock_not_allowed';
    end if;

    next_stock := current_item.stock - report_row.quantity;
  else
    next_stock := current_item.stock + report_row.quantity;
  end if;

  update public.inventory_items
  set stock = next_stock,
      updated_at = now()
  where id = current_item.id
    and company_id = p_company_id;

  insert into public.material_movements (
    company_id,
    inventory_item_id,
    from_location_id,
    to_location_id,
    jobsite_id,
    bring_list_id,
    quantity,
    unit,
    movement_type,
    created_by,
    notes
  )
  values (
    p_company_id,
    current_item.id,
    case when report_row.booking_type in ('consume', 'loss', 'break') then current_item.location_id else null end,
    case when report_row.booking_type = 'return' then current_item.location_id else null end,
    report_row.jobsite_id,
    report_row.bring_list_id,
    report_row.quantity,
    report_row.unit,
    report_row.booking_type,
    p_actor_id,
    coalesce(nullif(p_note, ''), report_row.notes)
  )
  returning id into v_movement_id;

  update public.material_usage_reports
  set status = 'confirmed',
      movement_id = v_movement_id,
      confirmed_by = p_actor_id,
      confirmed_at = now(),
      notes = coalesce(nullif(p_note, ''), public.material_usage_reports.notes),
      updated_at = now()
  where id = report_row.id
    and company_id = p_company_id;

  if current_item.minimum_stock > 0 and next_stock <= current_item.minimum_stock then
    update public.material_alerts
    set status = 'open',
        severity = case when next_stock <= 0 then 'critical' else 'warning' end,
        alert_type = case when next_stock <= 0 then 'out_of_stock' else 'low_stock' end,
        message = current_item.name || ' ist knapp: ' || next_stock || ' ' || current_item.unit || ' verfuegbar.',
        available_quantity = next_stock,
        missing_quantity = greatest(current_item.minimum_stock - next_stock, 0),
        unit = current_item.unit,
        resolved_at = null
    where id = (
      select id
      from public.material_alerts
      where company_id = p_company_id
        and inventory_item_id = current_item.id
        and status in ('open', 'acknowledged')
        and alert_type in ('low_stock', 'out_of_stock')
      order by created_at desc
      limit 1
    )
    returning id into existing_alert_id;

    if existing_alert_id is null then
      insert into public.material_alerts (
        company_id,
        inventory_item_id,
        job_id,
        alert_type,
        severity,
        message,
        required_quantity,
        available_quantity,
        missing_quantity,
        unit,
        created_by_system
      )
      values (
        p_company_id,
        current_item.id,
        report_row.jobsite_id,
        case when next_stock <= 0 then 'out_of_stock' else 'low_stock' end,
        case when next_stock <= 0 then 'critical' else 'warning' end,
        current_item.name || ' ist knapp: ' || next_stock || ' ' || current_item.unit || ' verfuegbar.',
        current_item.minimum_stock,
        next_stock,
        greatest(current_item.minimum_stock - next_stock, 0),
        current_item.unit,
        true
      );
    end if;
  elsif current_item.minimum_stock > 0 and next_stock > current_item.minimum_stock then
    update public.material_alerts
    set status = 'resolved',
        resolved_at = now()
    where company_id = p_company_id
      and inventory_item_id = current_item.id
      and status in ('open', 'acknowledged')
      and alert_type in ('low_stock', 'out_of_stock');
  end if;

  insert into public.company_audit_log (company_id, actor_id, entity_type, entity_id, action, old_values, new_values)
  values (
    p_company_id,
    p_actor_id,
    'material_usage_report',
    report_row.id,
    'material_usage_confirmed',
    jsonb_build_object('stock', current_item.stock, 'status', report_row.status),
    jsonb_build_object(
      'stock', next_stock,
      'status', 'confirmed',
      'movement_id', v_movement_id,
      'inventory_item_id', current_item.id,
      'jobsite_id', report_row.jobsite_id,
      'booking_type', report_row.booking_type,
      'quantity', report_row.quantity
    )
  );

  return v_movement_id;
end;
$$;

grant execute on function public.confirm_material_usage_report(uuid, uuid, uuid, text, text) to authenticated;

select pg_notify('pgrst', 'reload schema');
