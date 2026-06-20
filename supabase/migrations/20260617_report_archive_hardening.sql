-- Archive daily reports instead of hard-deleting operational documentation.

alter table public.reports add column if not exists archived_at timestamptz;

create index if not exists reports_archived_idx on public.reports(company_id, archived_at, report_date desc);

drop policy if exists "read relevant reports" on public.reports;
create policy "read relevant reports"
on public.reports for select
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and (public.can_manage_company() or created_by = auth.uid() or auth.uid() = any(employee_ids))
);

drop policy if exists "update relevant reports" on public.reports;
create policy "update relevant reports"
on public.reports for update
to authenticated
using (
  company_id = public.current_company_id()
  and archived_at is null
  and (public.can_manage_company() or created_by = auth.uid())
)
with check (
  company_id = public.current_company_id()
  and (public.can_manage_company() or created_by = auth.uid())
);

drop policy if exists "read relevant report photos" on public.report_photos;
create policy "read relevant report photos"
on public.report_photos for select
to authenticated
using (
  company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or created_by = auth.uid()
    or exists (
      select 1
      from public.reports r
      where r.id = report_id
        and r.archived_at is null
        and (r.created_by = auth.uid() or auth.uid() = any(r.employee_ids))
    )
  )
);

select pg_notify('pgrst', 'reload schema');
