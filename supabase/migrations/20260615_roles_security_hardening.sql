-- BauPro SaaS hardening: add foreman role without granting price/admin rights.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'chef', 'vorarbeiter', 'mitarbeiter'));

create or replace function public.can_manage_company()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() in ('admin', 'chef'), false)
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_company_id uuid;
  requested_role text;
begin
  target_company_id := nullif(new.raw_user_meta_data->>'company_id', '')::uuid;
  requested_role := coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'admin');

  if requested_role not in ('admin', 'chef', 'vorarbeiter', 'mitarbeiter') then
    requested_role := 'mitarbeiter';
  end if;

  if target_company_id is null then
    insert into public.companies (name, created_by)
    values (coalesce(nullif(new.raw_user_meta_data->>'company_name', ''), 'Meine Firma'), new.id)
    returning id into target_company_id;

    requested_role := 'admin';
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
