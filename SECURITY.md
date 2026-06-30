# Security Notes

Pruefpflichtige technische Arbeitsgrundlage, keine Rechtsberatung.

## Aktueller Schutz

- Authentifizierung ueber Supabase Auth.
- Optionale TOTP-Zwei-Faktor-Authentifizierung ist fuer Systemadmin-Zugaenge verfuegbar und empfohlen, aber noch nicht erzwungen.
- Firmenmandanten-Trennung ueber `company_id` und Supabase RLS.
- Systemadminrechte und Chef-Rechte sind getrennt: `admin` verwaltet firmenuebergreifend System, Benutzer, Rechte, Abrechnung, Integrationen und Datenschutz; `chef` verwaltet die operative Firmenarbeit.
- Die Migration `supabase/migrations/20260715_platform_system_admin.sql` gibt Systemadmins eigene firmenuebergreifende Policies fuer Firmen, Profile, Rechte- und Audit-Metadaten. Operative Kundendaten, Baustellen, Lager und Preise werden dadurch nicht global geoeffnet.
- `vorarbeiter` und `mitarbeiter` sehen keine EK/VK-, Margen-, Aufschlags- oder Preisvergleichsdaten.
- Server Actions und Export-Routen pruefen Auth-Kontext serverseitig.
- OpenAI wird nur serverseitig genutzt; API-Keys duerfen nie `NEXT_PUBLIC_*` sein.
- Report-Fotos liegen im privaten Supabase Storage Bucket `report-photos`; Lesen ist an Firmenpfad, `report_photos`-Metadaten, nicht archivierte Berichte und Manager-/Ersteller-/Mitarbeiterzuordnung gebunden.
- Foto-Uploads sind auf JPG, PNG, WebP, HEIC/HEIF und 10 MB begrenzt.
- PDF-/CSV-Export ist managergeschuetzt.
- Fehlerausgaben an API-Routen vermeiden rohe Provider-/DB-Details.

## Supabase Policies

Wichtige Policies stehen in `supabase/schema.sql` und Delta-Migrationen:

- Firmenmitglieder lesen nur eigene Firma.
- Systemadmins lesen und verwalten Firmen-/Profil-/Rechte-Metadaten firmenuebergreifend ueber eigene `is_system_admin()`-Policies.
- Kunden nur Chef.
- Baustellen/Auftraege fuer Mitarbeiter nur bei Zuordnung.
- Rollen-Eskalation wird per `assert_role_change_allowed` BEFORE-Trigger verhindert: `chef` darf keine Nutzer zu `admin` befoerdern und der letzte Systemadmin darf nicht herabgestuft werden.
- Inventory-Preistabellen nur Chef; Mitarbeiter und Vorarbeiter nutzen preisbereinigte Views.
- Storage fuer Report-Fotos: Uploadpfad muss `company_id/reports/report_id/...` entsprechen, Lesen muss zur `report_photos`-Metadatenzeile und einem berechtigten Bericht passen, Delete ist auf Chef oder Objektinhaber beschraenkt.
- Datenschutzanfragen: eigene Anfrage oder Systemadmin.

## Zwei-Faktor-Authentifizierung

- Systemadmin-Accounts koennen unter `/settings/security` TOTP-basierte 2FA aktivieren.
- Der Login prueft nach korrektem Passwort den Supabase Authenticator Assurance Level. Wenn ein verifizierter Faktor vorhanden ist, wird vor dem Dashboard die Seite `/login/mfa-challenge` verlangt.
- 2FA-Entfernung erfordert eine Passwort-Bestaetigung ueber einen nicht-persistierenden Supabase-Client, damit die bestehende Session nicht versehentlich durch einen AAL1-Login ueberschrieben wird.
- 2FA ist aktuell Opt-in. Eine spaetere Erzwingung sollte als eigene Migration/Produktentscheidung umgesetzt werden, damit bestehende Betriebe sauber migrieren koennen.

## Offene Produktionspunkte

- Supabase-Migrationen in Production ausfuehren und Schema Cache reload pruefen.
- Supabase Storage Bucket `report-photos` privat halten.
- Service Role Key nur serverseitig speichern.
- OpenAI-Key rotieren, wenn er jemals in Chat/Logs geteilt wurde.
- Redis/KV Rate Limiting in Production verpflichtend konfigurieren (`UPSTASH_REDIS_REST_*` oder `KV_REST_API_*`); ohne Redis blockt die App rate-limitierte Aktionen.
- Rechtstexte, AVV/DPA und Anbieterkennzeichnung vor echter Vermarktung final juristisch pruefen; die App kennzeichnet diese Inhalte bewusst als pruefpflichtige Entwuerfe.
- Security Header/CSP fuer Production regelmaessig mit Uploads, PDF, PWA und Vercel Analytics testen.
- Backup-/Restore-Konzept und Incident-Prozess dokumentieren.

## Dependency Security Scanning

- Dependabot prueft woechentlich npm-Pakete und GitHub Actions. Patch- und Minor-Updates werden gruppiert, Major-Updates bleiben einzeln pruefbar.
- Die CI fuehrt nach `npm ci` immer `npm audit --audit-level=high` aus. High- oder Critical-CVEs machen den Build bewusst rot.
- Der geplante Workflow `Security Scan` laeuft montags um 06:00 UTC und kann manuell per `workflow_dispatch` gestartet werden. Er erzeugt `audit-report.json` als Artifact.
- Falls High/Critical-Funde auftreten, erstellt der Workflow ein GitHub Issue mit Label `security-audit`, solange noch kein offenes Audit-Issue existiert.
- Maintainer-Reaktion: High/Critical-Funde binnen 48 Stunden patchen, Paket ersetzen oder eine dokumentierte Mitigation mit Risikoentscheidung hinterlegen.
