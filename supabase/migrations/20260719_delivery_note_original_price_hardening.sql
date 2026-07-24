-- Lieferschein-Originale koennen EK/VK- oder Lieferantenpreise enthalten.
-- Vorarbeiter duerfen weiter Mengen/Positionen bearbeiten, aber keine Originalfotos
-- aus dem Storage lesen. Chef und Systemadmin behalten Zugriff.

drop policy if exists "operators read delivery note storage" on storage.objects;
drop policy if exists "managers read delivery note storage" on storage.objects;

create policy "managers read delivery note storage"
on storage.objects for select
to authenticated
using (
  bucket_id = 'delivery-notes'
  and (storage.foldername(name))[1] = public.current_company_id()::text
  and (storage.foldername(name))[2] = 'delivery-notes'
  and public.current_role() in ('admin', 'chef')
);
