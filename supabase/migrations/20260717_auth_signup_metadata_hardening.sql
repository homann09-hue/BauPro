-- BauPro REDTEAM hardening:
-- Clientseitige user_metadata darf keine Firmenzuordnung oder Rolle bestimmen.
-- Normale Registrierung erzeugt immer eine neue Firma mit Rolle chef.
-- Serverseitig angelegte Nutzer duerfen nur ueber raw_app_meta_data zugeordnet
-- werden, weil app_metadata nicht vom Client selbst gesetzt werden kann.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_company_id uuid;
  requested_role text;
  app_company_id text;
  app_server_created boolean;
begin
  app_server_created := coalesce((new.raw_app_meta_data->>'baupro_server_created')::boolean, false);
  app_company_id := nullif(new.raw_app_meta_data->>'baupro_company_id', '');

  if app_server_created and app_company_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    target_company_id := app_company_id::uuid;
    requested_role := coalesce(nullif(new.raw_app_meta_data->>'baupro_role', ''), 'mitarbeiter');
  else
    target_company_id := null;
    requested_role := 'chef';
  end if;

  if requested_role not in ('admin', 'chef', 'vorarbeiter', 'mitarbeiter', 'kunde') then
    requested_role := 'mitarbeiter';
  end if;

  if target_company_id is null then
    insert into public.companies (name, created_by)
    values (coalesce(nullif(new.raw_user_meta_data->>'company_name', ''), 'Meine Firma'), new.id)
    returning id into target_company_id;

    requested_role := 'chef';
  end if;

  insert into public.profiles (id, company_id, email, full_name, role)
  values (
    new.id,
    target_company_id,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    requested_role
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    company_id = excluded.company_id,
    role = excluded.role,
    active = true;

  return new;
end;
$$;

notify pgrst, 'reload schema';
