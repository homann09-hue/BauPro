-- 20260621_role_escalation_guard.sql
-- Verhindert Rollen-Eskalation direkt in der Datenbank.

create or replace function public.assert_role_change_allowed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  other_admin_exists boolean;
begin
  if old.role is not distinct from new.role then
    return new;
  end if;

  select p.role
    into actor_role
  from public.profiles p
  where p.id = auth.uid()
    and p.company_id = old.company_id
    and p.active = true
  limit 1;

  if new.role = 'admin' and coalesce(actor_role, '') <> 'admin' then
    raise exception 'Keine Berechtigung fuer diese Rollenaenderung.';
  end if;

  if old.role = 'admin' and new.role <> 'admin' then
    select exists (
      select 1
      from public.profiles p
      where p.company_id = old.company_id
        and p.id <> old.id
        and p.role = 'admin'
        and p.active = true
    )
      into other_admin_exists;

    if not coalesce(other_admin_exists, false) then
      raise exception 'Keine Berechtigung fuer diese Rollenaenderung.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_role_change_before_audit on public.profiles;
create trigger guard_profile_role_change_before_audit
before update of role on public.profiles
for each row execute function public.assert_role_change_allowed();

notify pgrst, 'reload schema';
