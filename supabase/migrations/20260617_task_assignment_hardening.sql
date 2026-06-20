alter table public.tasks add column if not exists archived_at timestamptz;

drop policy if exists "read relevant tasks" on public.tasks;
create policy "read relevant tasks"
on public.tasks for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and (public.can_manage_company() or assigned_to = auth.uid())
);

drop policy if exists "managers can insert tasks" on public.tasks;
create policy "managers can insert tasks"
on public.tasks for insert
to authenticated
with check (company_id = public.current_company_id() and public.can_manage_company());

drop policy if exists "update relevant tasks" on public.tasks;
create policy "update relevant tasks"
on public.tasks for update
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and (public.can_manage_company() or assigned_to = auth.uid())
)
with check (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or (assigned_to = auth.uid() and archived_at is null)
  )
);

drop policy if exists "managers can delete tasks" on public.tasks;
create policy "managers can delete tasks"
on public.tasks for delete
to authenticated
using (company_id = public.current_company_id() and public.can_manage_company());

select pg_notify('pgrst', 'reload schema');
