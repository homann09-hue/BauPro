-- BauPro REDTEAM hardening:
-- bootstrap_my_profile() ist nur ein Reparatur-Fallback, falls der Auth-Trigger
-- ein Profil nicht angelegt hat. Dieser Fallback darf niemals automatisch einen
-- firmenuebergreifenden Systemadmin erzeugen.

create or replace function public.bootstrap_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_profile public.profiles;
  target_company_id uuid;
  user_email text;
  user_full_name text;
  user_company_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into existing_profile
  from public.profiles
  where id = auth.uid()
  limit 1;

  if found then
    return existing_profile;
  end if;

  user_email := nullif(auth.jwt()->>'email', '');
  user_full_name := nullif(auth.jwt()->'user_metadata'->>'full_name', '');
  user_company_name := coalesce(nullif(auth.jwt()->'user_metadata'->>'company_name', ''), 'Meine Firma');

  insert into public.companies (name, created_by)
  values (user_company_name, auth.uid())
  returning id into target_company_id;

  insert into public.profiles (id, company_id, email, full_name, role, active)
  values (auth.uid(), target_company_id, user_email, user_full_name, 'chef', true)
  returning * into existing_profile;

  return existing_profile;
end;
$$;

grant execute on function public.bootstrap_my_profile() to authenticated;

notify pgrst, 'reload schema';
