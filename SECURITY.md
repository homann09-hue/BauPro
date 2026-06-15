# Security Notes

Pruefpflichtige technische Arbeitsgrundlage, keine Rechtsberatung.

## Aktueller Schutz

- Authentifizierung ueber Supabase Auth.
- Firmenmandanten-Trennung ueber `company_id` und Supabase RLS.
- Managerrechte nur fuer `admin` und `chef`.
- `vorarbeiter` und `mitarbeiter` sehen keine EK/VK-, Margen-, Aufschlags- oder Preisvergleichsdaten.
- Server Actions und Export-Routen pruefen Auth-Kontext serverseitig.
- OpenAI wird nur serverseitig genutzt; API-Keys duerfen nie `NEXT_PUBLIC_*` sein.
- Report-Fotos liegen in privatem Supabase Storage Bucket `report-photos`.
- Foto-Uploads sind auf JPG, PNG, WebP, HEIC/HEIF und 10 MB begrenzt.
- PDF-/CSV-Export ist managergeschuetzt.
- Fehlerausgaben an API-Routen vermeiden rohe Provider-/DB-Details.

## Supabase Policies

Wichtige Policies stehen in `supabase/schema.sql` und Delta-Migrationen:

- Firmenmitglieder lesen nur eigene Firma.
- Kunden nur Chef/Admin.
- Baustellen/Auftraege fuer Mitarbeiter nur bei Zuordnung.
- Inventory-Preistabellen nur Chef/Admin; Mitarbeiter nutzen preisbereinigte Views.
- Storage Delete fuer Report-Fotos: eigene Firma plus Chef/Admin oder Objektinhaber.
- Datenschutzanfragen: eigene Anfrage oder Chef/Admin.

## Offene Produktionspunkte

- Supabase-Migrationen in Production ausfuehren und Schema Cache reload pruefen.
- Supabase Storage Bucket `report-photos` privat halten.
- Service Role Key nur serverseitig speichern.
- OpenAI-Key rotieren, wenn er jemals in Chat/Logs geteilt wurde.
- Rate Limiting fuer Login/API auf Hosting-/Edge-Ebene final konfigurieren.
- Security Header/CSP fuer Production ergaenzen und mit Uploads/PDFs testen.
- Backup-/Restore-Konzept und Incident-Prozess dokumentieren.
