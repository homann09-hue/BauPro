-- Redteam-Härtung: Report-Foto-Lesen nicht nur an Firmenpfad binden,
-- sondern an die zugehörige Report-Metadaten-Zeile und deren Rechte.
drop policy if exists "members can read company report photos" on storage.objects;
create policy "members can read company report photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'report-photos'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'reports'
  and exists (
    select 1
    from public.report_photos rp
    join public.reports r on r.id = rp.report_id
    where rp.company_id = public.current_company_id()
      and rp.storage_path = storage.objects.name
      and rp.archived_at is null
      and r.company_id = public.current_company_id()
      and r.archived_at is null
      and r.id::text = (storage.foldername(name))[3]
      and (
        public.can_manage_company()
        or rp.created_by = auth.uid()
        or r.created_by = auth.uid()
        or auth.uid() = any(r.employee_ids)
      )
  )
);

select pg_notify('pgrst', 'reload schema');
