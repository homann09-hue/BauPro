# BauPro

BauPro ist eine mobile-first Betriebssoftware fuer deutsche Dachdecker- und Handwerksbetriebe. Die App nutzt Next.js, TypeScript, Tailwind CSS und Supabase fuer Auth, Datenbank, Storage und Row Level Security.

## Funktionen

- Firmenregistrierung mit Admin-Profil
- Startassistent fuer neue Betriebe: Firmenprofil, Demo-Daten, Mitarbeiterimport, Baustellenimport und gefuehrte Einfuehrung
- Demo-Modus fuer Interessenten: vorbereitete Firma mit Baustellen, Team, Lager, Auftraegen, Zeiten und 2-Minuten-Tour
- Firmenprofil, Profilseite, Rollenverwaltung und Chef-Einstellungen
- Login/Logout ueber Supabase Auth
- Rollen: `admin`, `chef`, `vorarbeiter`, `mitarbeiter`, `kunde`
- Vorarbeiter-Rolle ohne Preis-/Chef-Rechte
- Rollenklare Navigation fuer Chef/Admin, Vorarbeiter und Mitarbeiter
- Predictive Prefetching fuer rollenabhaengige Hauptstrecken, schlanke Route-Warmups und Kundenportal-Assets
- Dashboard als Betriebszentrale bzw. Mitarbeiter-Arbeitstag
- Kundenkartei mit Privatkunden, Gewerbekunden, Hausverwaltungen, Architekten und Versicherungen
- Sicheres Kundenportal per ablaufendem Link mit Baustellenstatus, Fortschritt, freigegebenen Fotos, Updates, Terminen, Dokumenten, Auftraegen, Bautagesberichten, Unterschriften und Kundenfragen
- Auftragsanlage aus der Kundenkartei mit automatischer Auftragsnummer
- Angebote/Rechnungen aus Auftraegen mit Positionen, Status, Summen, PDF-Export, DATEV-CSV und XRechnung-XML-Entwurf
- Digitale Arbeitsauftraege mit Touch-/Maus-Unterschrift, Status Entwurf/Gesendet/Gesehen/Unterschrieben/Abgelehnt, Hash und PDF-Nachweis
- Kalenderuebersicht fuer Auftraege, Baustellen und Zeiten
- Baustellen-CRUD mit Mitarbeiterzuordnung
- Zentrale Baustellenakte je Auftrag/Baustelle mit Dokumenten, Verlauf, Fotos, Aufgaben, Zeiten, Materialbedarf und kaufmaennischen Dokumenten
- Baustellendokumente mit privatem Storage, Rollenrechten, Kundenfreigabe, Archivierung und digitaler Bestätigung/Abnahme
- Bautagesberichte mit Sprache/Text, KI-Entwurf nach DSGVO-Opt-in, Wetter-Nachweis, uebernommenen Arbeitszeiten, Materialverbrauch, Maschinen/Fahrzeugen, Fotos, PDF-Export, Chef-Pruefung/Freigabe und revisionssicherer digitaler Unterschrift
- Mitarbeiter-Zeiterfassung mit Freigabe, Aenderungsprotokoll, Monats-Stundenzettel, PDF- und CSV-Export
- Sprache-zu-Text Diktat mit Bestaetigung fuer Mitbringlisten, Zeiterfassung und Materialmeldungen
- OpenAI-KI-Assistent fuer Diktat-Auswertung, Tagesbericht-Entwuerfe, Materialnamen-Abgleich und rollenbasierte Betriebsfragen
- KI-Auftragswizard fuer Chef/Admin: Text/Sprache zu Auftragsentwurf, regelbasierter Materialberechnung, Lagerabgleich und Chef-Kalkulation
- Mitbringlisten mit Packstatus, Fehlmaterialmeldung, Lagerabgleich, Reservierungen und Einkaufsvorschlaegen
- Materialmeldung fuer Mitarbeiter ohne Preisansicht
- Dachdecker-Materialkatalog mit ueber 150 praxisnahen Standardartikeln
- Material-/Lagerverwaltung mit Lagerorten, Mindestbestand, Preisen, Schnellerfassung und Umlagerung
- Live-Preisvergleich vorbereitet fuer manuelle Angebote, CSV-Feeds und offizielle Anbieter-APIs
- Online Price Discovery als optionaler Chef-Preisindikator ueber erlaubte Feeds/offizielle APIs
- Materialberechnung je Baustelle und Auftrag mit Dachart, strukturiertem Aufmass, 20 % Standard-Verschnitt und Chef-Preisen
- Angebote/Rechnungen als klar markierter vorbereiteter Produktbereich
- Fahrzeuge mit einfachem Fahrzeuglager
- Teamverwaltung und manuelles Anlegen von Mitarbeitern
- Datenschutz-Center mit Auskunftsexport, Firmenexport und Betroffenenanfragen
- Rechtliche Entwurfsseiten fuer Impressum, Datenschutz, AGB, AVV, Cookies, Loeschkonzept und Subprozessoren
- Consent-Banner mit Opt-in fuer optionale Analyse/Marketing-Verarbeitung
- Upload-Validierung fuer Tagesbericht-Fotos mit MIME-, Groessen- und Magic-Byte-Pruefung
- Supabase SQL-Schema mit FORCE Row Level Security pro Firma
- Atomare Lagerbuchungen und Reservierungen ueber Postgres-RPCs
- Audit-Log fuer Rollen-, Preis-, Supplier-Key- und Lagerbestandsaenderungen

## Lokales Setup

1. Dependencies installieren:

```bash
npm install
```

2. Supabase-Projekt erstellen und Schema ausfuehren:

```text
supabase/schema.sql
```

Die Datei erstellt Tabellen, RLS-Policies, Auth-Trigger, die privaten Storage Buckets `report-photos`, `customer-documents` und `jobsite-documents`, Audit-Hooks und die atomaren Lager-RPCs. Frische Installationen brauchen keine Repair-Hotfixes.

Wenn dein Projekt bereits mit einer aelteren BauPro-Version laeuft, fuehre die Delta-Migrationen in dieser Reihenfolge im Supabase SQL Editor aus:

```text
supabase/migrations/20260614_customers_orders.sql
supabase/migrations/20260614_supplier_price_comparison.sql
supabase/migrations/20260614_online_price_discovery.sql
supabase/migrations/20260614_online_price_source_adapters.sql
supabase/migrations/20260614_time_tracking.sql
supabase/migrations/20260614_voice_bring_lists_inventory_alerts.sql
supabase/migrations/20260615_material_alerts_repair.sql
supabase/migrations/20260615_saas_hardening.sql
supabase/migrations/20260615_ai_features.sql
supabase/migrations/20260615_ai_job_wizard.sql
supabase/migrations/20260615_roles_security_hardening.sql
supabase/migrations/20260615_privacy_compliance.sql
supabase/migrations/20260615_zz_redteam_hardening.sql
supabase/migrations/20260616_weather_fields.sql
supabase/migrations/20260616_live_weather.sql
supabase/migrations/20260616_help_material_intelligence.sql
supabase/migrations/20260617_customer_portal_work_orders.sql
supabase/migrations/20260617_performance_indexes.sql
supabase/migrations/20260617_inventory_rpc_actor_hardening.sql
supabase/migrations/20260617_vehicle_material_tenant_hardening.sql
supabase/migrations/20260617_legacy_soft_delete_hardening.sql
supabase/migrations/20260617_report_archive_hardening.sql
supabase/migrations/20260617_task_assignment_hardening.sql
supabase/migrations/20260617_bring_list_direct_update_hardening.sql
supabase/migrations/20260619_stripe_billing.sql
supabase/migrations/20260619_dashboard_rpc.sql
supabase/migrations/20260620_soft_delete_columns.sql
supabase/migrations/20260621_role_escalation_guard.sql
supabase/migrations/20260621_schema_gap_fix.sql
supabase/migrations/20260622_employee_permissions.sql
supabase/migrations/20260622_rls_consolidation.sql
supabase/migrations/20260622_commercial_documents.sql
supabase/migrations/20260622_redteam_hardening.sql
supabase/migrations/20260623_roof_measurements.sql
supabase/migrations/20260623_session_timeout_setting.sql
supabase/migrations/20260624_onboarding.sql
supabase/migrations/20260624_jobsite_file_documents.sql
supabase/migrations/20260625_invoices.sql
supabase/migrations/20260625_digital_signatures.sql
supabase/migrations/20260626_construction_daily_reports.sql
supabase/migrations/20260627_customer_portal_jobsites.sql
supabase/migrations/20260628_planning_board.sql
supabase/migrations/20260629_planning_weather_risks.sql
supabase/migrations/20260630_inventory_jobsite_flow.sql
supabase/migrations/20260701_auto_bring_lists.sql
supabase/migrations/20260702_delivery_note_recognition.sql
supabase/migrations/20260703_ai_roof_material_calculation.sql
supabase/migrations/20260704_resource_vehicle_management.sql
supabase/migrations/20260705_flexible_checklists.sql
supabase/migrations/20260706_defect_management.sql
supabase/migrations/20260707_performance_followup_indexes.sql
supabase/migrations/20260708_privacy_security_hardening.sql
supabase/migrations/20260709_fix_material_usage_confirmation_rpc.sql
supabase/migrations/20260710_calculation_travel_rate.sql
supabase/migrations/20260711_invoice_atomic_stats.sql
supabase/migrations/20260712_price_permission_hardening.sql
supabase/migrations/20260713_redteam_storage_prefetch_hardening.sql
```

`20260615_material_alerts_repair.sql` bleibt idempotent, damit aeltere Testdatenbanken mit fehlender Mitbringlisten-Kette repariert werden koennen. Fuer neue Projekte ist der vollstaendige Stand bereits in `supabase/schema.sql` enthalten.

3. Materialkatalog seed ausfuehren:

```text
supabase/material-catalog-seed.sql
```

Der Seed legt Kategorien, Unterkategorien, Importvorlagen und einen Dachdecker-Materialkatalog mit typischen Artikeln fuer kleine Betriebe an.
Er legt außerdem Beispielregeln fuer die Materialberechnung an, z. B. Unterspannbahn nach Flaeche, Firstrolle nach Firstlaenge und Rinnenhalter alle 60 cm.

4. `.env.local` aus `.env.example` anlegen:

```bash
cp .env.example .env.local
```

Dann eintragen:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# oder bei neuen Supabase-Projekten:
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=BauPro
SUPABASE_SERVICE_ROLE_KEY=...
SUPPLIER_API_ENCRYPTION_KEY=...
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_STARTER_MONTHLY_PRICE_ID=
STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID=
STRIPE_PROFESSIONAL_YEARLY_PRICE_ID=
STRIPE_BUSINESS_MONTHLY_PRICE_ID=
STRIPE_BUSINESS_YEARLY_PRICE_ID=
```

`SUPABASE_SERVICE_ROLE_KEY` ist nur serverseitig und wird fuer das manuelle Anlegen von Mitarbeitern sowie das sichere Kundenportal mit ablaufenden Token-Links benoetigt.
`SUPPLIER_API_ENCRYPTION_KEY` ist optional, aber erforderlich, wenn du offizielle API-Keys fuer Lieferanten speichern willst.
Die `ONLINE_PRICE_*` Variablen fuer CSV-Preislisten, eBay, PriceAPI, DataForSEO und SearchApi sind optional.
Ohne konfigurierte Quelle zeigt die App sauber an, dass keine aktuellen Online-Angebote gefunden wurden.
`OPENAI_API_KEY` ist optional und darf niemals mit `NEXT_PUBLIC_` beginnen. Ohne Key bleiben alle Kernfunktionen aktiv; KI-Bereiche zeigen dann „KI-Funktionen sind noch nicht konfiguriert.“
KI-Bautagesberichte laufen ueber `/api/ai/report-draft`, verlangen ein aktives Nutzer-Opt-in und senden den OpenAI-Key nie an den Browser.
`STRIPE_SECRET_KEY` und `STRIPE_WEBHOOK_SECRET` sind nur serverseitig. Die Stripe Price IDs legst du im Stripe Dashboard je Tarif/Intervall an und traegst sie in `.env.local` ein.

5. Supabase Auth konfigurieren:

- Site URL lokal: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/auth/callback`
- Fuer lokale Tests kannst du E-Mail-Bestaetigung deaktivieren.

6. Demo-Modus fuer Interessenten:

Der Demo-Modus ist lokal ueber `/demo` oder den Button auf `/login` erreichbar. Er legt serverseitig die Demo-Firma `Müller Dachtechnik GmbH` mit einem Chef, zwei Vorarbeitern, fuenf Mitarbeitern, Baustellen, Lagerbestand, Auftraegen, Aufmass, Zeiten, Berichten, Mitbringliste, Materialwarnungen und Einkaufsvorschlaegen an und loggt direkt als Chef ein.

In Production ist die Demo nur aktiv, wenn `DEMO_MODE_ENABLED=true` gesetzt ist. `SUPABASE_SERVICE_ROLE_KEY` wird serverseitig benoetigt, damit Auth-User und Beispieldaten automatisch angelegt werden koennen. Der normale Demo-Start verwendet vorhandene Beispieldaten wieder, damit Interessenten nicht auf ein komplettes Neu-Seeding warten. Nur fuer Wartung/QA kannst du `DEMO_RESEED_ON_START=true` setzen; in Production sollte der Wert leer oder `false` bleiben.

Optional kannst du die Demo-Firma auch per CLI vorgeladen:

```bash
npm run seed:demo
```

Das Skript benoetigt `NEXT_PUBLIC_SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
Der UI-Demo-Start fuehrt danach auf `/demo-tour`, damit der Nutzen in etwa zwei Minuten sichtbar wird.

Standard-Login:

```text
chef@mueller-dachtechnik.example
BauProDemo!2026
```

Weitere Demo-User nutzen dasselbe Passwort: `niklas`, `tobias`, `max`, `lena`, `emre`, `sophie`, `jan` jeweils mit `@mueller-dachtechnik.example`.
Das Passwort kann mit `DEMO_USER_PASSWORD` geaendert werden.

7. App starten:

```bash
npm run dev
```

Danach im Browser oeffnen:

```text
http://localhost:3000
```

Nach der ersten Registrierung landet Chef/Admin automatisch im Startassistenten unter `/onboarding`. Dort kann ein Betrieb in wenigen Minuten:

- Firmendaten vervollstaendigen
- realistische Demo-Daten anlegen
- Mitarbeiter aus einer Excel-/CSV-Liste importieren
- Baustellen aus einer Excel-/CSV-Liste importieren
- die wichtigsten Arbeitsablaeufe Schritt fuer Schritt oeffnen

## Rollenmodell

- `admin` und `chef`: duerfen Firma, Kunden, Auftraege, Team, Baustellen, Material, Fahrzeuge, Aufgaben und alle Berichte verwalten.
- `vorarbeiter`: sieht zugeordnete Baustellen, Auftraege, Zeiten, Tagesberichte, Mitbringlisten, Materialmeldungen und preisbereinigte Lagerdaten. EK, VK, Marge, Einkaufsvorschlaege und Preisvergleich bleiben gesperrt.
- `mitarbeiter`: sieht eigene Aufgaben, eigene/zugeordnete Berichte, zugeordnete Baustellen, zugeordnete Auftraege, eigene Zeiten, Mitbringlisten und Materialmeldungen. Stammdaten, Preisquellen, EK, VK, Aufschlag und Marge bleiben gesperrt.
- `kunde`: ist fuer Kundenzugaenge vorgesehen. Kunden sehen im Portal nur explizit freigegebene Projektdaten, Fotos, Dokumente und Arbeitsauftraege.

Die RLS-Policies in `supabase/schema.sql` erzwingen, dass Nutzer nur Daten ihrer eigenen Firma sehen.
Preisfelder wie `purchase_price`, `sales_price`, `markup_percent`, `price_net`, `price_gross`, Supplier-Angebote und Online-Preisangebote sind nur fuer `admin` und `chef` freigegeben. Mitarbeiter und Vorarbeiter nutzen preisbereinigte Views wie `inventory_items_public`.

## Security und CI

Der PR-Workflow `.github/workflows/ci.yml` fuehrt aus:

```bash
npm ci
npm run lint
npm run test
npm run db:schema-check
npm run build
```

Der Schema-Check prueft statisch FORCE RLS, preisbereinigte Views, Manager-only Preis-Policies, Storage-Pfade und atomare Lager-RPCs.

### Rate Limiting in Production

BauPro nutzt serverseitiges Rate Limiting fuer Login, Demo-Start, KI, Uploads, Wetter, Kalender, Kundenportal und Preisabfragen.
In Vercel/Serverless darf Rate Limiting nicht im Arbeitsspeicher der Funktion liegen, weil jede Instanz eigenen State hat.
Darum ist Redis/KV fuer Production Pflicht.

Erforderliche Production-Variablen:

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Alternativ werden die Vercel-KV-Aliasse akzeptiert:

```env
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

Wenn Redis/KV in `NODE_ENV=production` fehlt, blockiert `checkRateLimit()` die Anfrage mit einer sicheren Fehlermeldung.
In Development darf Redis fehlen; die App warnt dann einmalig in der Konsole und laesst Requests durch, damit lokale Arbeit nicht blockiert.

Warum das wichtig ist:

- Login- und Demo-Endpunkte werden gegen automatisierte Versuche gedrosselt.
- KI-Endpunkte koennen nicht unbegrenzt Kosten verursachen.
- Upload-, Wetter- und Preisabfrage-Routen erzeugen weniger vermeidbare Datenbank- und Provider-Last.
- Rate Limits gelten instanzuebergreifend statt nur pro Serverless-Funktion.

Wichtige Härtungen:

- Server Actions validieren kritische IDs serverseitig und uebernehmen keine `company_id` aus Formularen.
- Supplier API Keys bleiben verschluesselt gespeichert und werden nur serverseitig kurz vor dem Provider-Call entschluesselt.
- Tagesbericht-Fotos werden nach Dateigroesse, MIME und Magic Bytes geprueft; Storage-Pfade muessen `company_id/reports/report_id/...` entsprechen.
- Tagesbericht-Fotos koennen nur gelesen werden, wenn der Storage-Pfad zur `report_photos`-Metadatenzeile und zu einem fuer den Nutzer erlaubten, nicht archivierten Bericht passt.
- Kundenportal-Links werden nicht im Klartext gespeichert, sondern als SHA-256-Hash mit Ablaufdatum und Sperrmoeglichkeit.
- Arbeitsauftraege werden nach Unterschrift/Abweisung finalisiert, versioniert und als PDF-Nachweis exportierbar.
- Lagerbestand und Reservierungen laufen ueber Postgres-Funktionen mit `for update`, damit parallele Buchungen keinen negativen Bestand erzeugen.
- Lager-RPCs und Materialbewegungen pruefen serverseitig `auth.uid()`, damit Audit-Logs, Reservierungen und Ziel-Lagerartikel nicht per manipuliertem RPC fremden Nutzern zugeschrieben werden koennen.
- Security Headers und Origin-Check fuer schreibende Requests sind in Next.js konfiguriert.

## Performance

- Die App-Shell startet nach Login einen unauffaelligen Prefetcher fuer wahrscheinliche naechste Routen.
- `/api/prefetch/route-data` laedt kleine, rollenbereinigte Datenpakete mit `private, max-age` und `stale-while-revalidate`.
- Mitarbeiter/Vorarbeiter erhalten beim Prefetch nur preisbereinigte Materialdaten.
- Chef/Admin waermen zusaetzlich das Live-Wetter der aktivsten Baustelle vor; Mitarbeiterstandorte werden dafuer nicht genutzt.
- Das Kundenportal prefetches bereits freigegebene Foto- und Dokument-URLs im Idle-Zeitfenster.
- Listen wie Baustellen, Auftraege, Kunden, Tagesberichte, Materiallager und Zeiterfassung nutzen Pagination bzw. schlanke Selects statt Volltabellen-Loads.
- `20260617_performance_indexes.sql` legt idempotente Indizes fuer Dashboard, Lager, Zeiten, Materialwarnungen, Kundenportal und Auftraege an.

## Produktnavigation

Chef/Admin sieht:

- Dashboard
- Startassistent
- KI Auftrag
- Kunden
- Auftraege
- Kalender
- Material
- Lager
- Mitbringlisten
- Mitarbeiter
- Zeiterfassung
- Stundenzettel
- Angebote/Rechnungen
- Einstellungen

Mitarbeiter sieht:

- Meine Baustellen
- Meine Zeiten
- Mitbringlisten
- Material melden
- Tagesberichte
- Profil

Wichtige Bereiche werden nicht hinter einem generischen `Mehr` versteckt. Mobile nutzt eine horizontale Bottom-Navigation.

## Zeiterfassung und Stundenzettel

Die Zeiterfassung ist unter `/time-tracking` erreichbar. Mitarbeiter koennen eigene Zeiten erfassen und bearbeiten, solange sie nicht freigegeben sind.

- Pflichtfelder: Datum, Mitarbeiter, Baustelle, Ort/Adresse, Beginn, Ende, Pause und Taetigkeit
- Bruttozeit, Pause und Nettoarbeitszeit werden automatisch berechnet
- Warnhinweise erscheinen bei mehr als 10 Netto-Stunden oder fehlender Pause bei laengerer Arbeitszeit
- Status: Entwurf, Eingereicht, Freigegeben, Abgelehnt
- Nach Freigabe ist der Eintrag fuer Mitarbeiter gesperrt
- Chef/Admin kann Zeiten korrigieren, freigeben oder ablehnen
- Jede Anlage/Korrektur/Freigabe wird in `time_entry_audit_log` protokolliert

Chef/Admin erstellt Monats-Stundenzettel unter `/time-tracking/reports`. Der Bericht nutzt eingereichte oder freigegebene Zeiten und bietet:

- Detailansicht mit Summen
- PDF-Download mit Firmenname, Zeitraum, Mitarbeiter, Tabelle, Summe, Freigabe und Erstellungsdatum
- CSV-Download fuer Weiterverarbeitung

Hinweis: Die App strukturiert Daten nachvollziehbar und exportierbar, ersetzt aber keine Rechtsberatung.

## Spracheingabe und Mitbringlisten

Die App zeigt unten rechts einen Mikrofon-Button. Die Spracheingabe nutzt die Web Speech API im Browser mit Deutsch als Standardsprache. Wenn der Browser keine Spracheingabe unterstuetzt, bleibt ein normales Textfeld sichtbar.

- Diktate werden erst nach Bestaetigung gespeichert
- Regelbasierte Erkennung fuer Mitbringlisten, Zeiterfassung und Materialmeldungen
- Optional wertet OpenAI das Diktat serverseitig aus und speichert den Vorschlag in `ai_actions`
- Bei weniger als 70 % Sicherheit fragt die App nach, statt automatisch zu speichern
- Beispiel: `Morgen Baustelle Hauptstraße 12 mitnehmen 2 Rollen Unterspannbahn und 1 Karton Schrauben`
- Beispiel: `Heute Baustelle Hauptstraße von 7 bis 16 Uhr gearbeitet, 30 Minuten Pause, Ziegel eingedeckt`
- Beispiel: `Baustelle Hauptstraße Unterspannbahn fehlt 2 Rollen`

Mitbringlisten liegen unter `/bring-lists`. Chef/Admin kann Listen manuell erstellen oder im Auftragsdetail aus dem berechneten Materialbedarf eine Liste fuer morgen erzeugen. Zusaetzlich erzeugt BauPro fuer morgen automatisch Listen aus Auftrag, Materialplanung, Lagerbestand und Plantafel. Mitarbeiter und Vorarbeiter sehen die ihnen zugeordneten Listen, koennen Positionen abhaken, manuell ergaenzen und fehlendes Material melden.

Der Lagerabgleich prueft Bestand, Mindestbestand, offene Reservierungen und Fahrzeug-/Lagerorte. Bei Fehlbestand entstehen Materialwarnungen und Einkaufsvorschlaege fuer Chef/Admin im Dashboard. Wenn Material im falschen Fahrzeug liegt oder ein Geraet in der Plantafel als defekt/Werkstatt markiert ist, zeigt die Mitbringliste einen Hinweis. Einkaufsvorschlaege und Einkaufsdaten sind fuer Mitarbeiter nicht sichtbar.

## KI-Assistent

Der KI-Assistent liegt unter `/ai-assistant` und ist zusaetzlich global ueber `KI fragen` erreichbar.

- OpenAI wird nur serverseitig ueber die Responses API genutzt
- Strukturierte Antworten werden als JSON validiert
- KI-Nutzung wird in `ai_usage_logs` protokolliert
- Aktionsvorschlaege werden in `ai_actions` gespeichert und erst nach Nutzerbestaetigung ausgefuehrt
- Mitarbeiter-Kontext enthaelt keine EK-, VK-, Margen-, Aufschlags- oder Preisvergleichsdaten
- Chef/Admin kann KI in `/settings` aktivieren/deaktivieren und Mitarbeiterzugriff steuern
- Ohne `OPENAI_API_KEY` zeigt die UI einen Setup-Hinweis, aber die App bleibt nutzbar

## KI-Auftragswizard

Der KI-Auftragswizard liegt unter `/ai/job-wizard` und ist nur fuer Admin/Chef erreichbar.

- Chef/Admin beschreibt einen Auftrag per Text oder Sprache
- OpenAI extrahiert Kunde, Auftragstitel, Auftragsart, Adresse, Zeitraum, Maße und Rueckfragen als validiertes JSON
- Die App berechnet Materialbedarf anschliessend regelbasiert mit Standard-Verschnitt aus `calculation_settings`
- Lagerbestand, offene Reservierungen, fehlendes Material und Einkaufsvorschlaege werden angezeigt
- Chef-Kalkulation zeigt EK, VK, Lohn, Gemeinkosten, Gewinn, Netto, MwSt., Brutto und Preisquellen
- Nichts wird ohne Bestaetigung final gespeichert
- Chef/Admin kann erkannte Daten korrigieren und die Vorschau neu berechnen
- Erst die Bestaetigungsbuttons erstellen Auftrag, Mitbringliste, Reservierung und gespeicherte Kalkulation
- Mitarbeiter koennen diese Route und die Preis-/Kalkulationstabellen nicht lesen

## Material und Lager

Der neue Materialbereich ist unter `/materials/inventory` erreichbar. Die Hauptnavigation zeigt direkt `Material`; wichtige Unterseiten sind oben sichtbar:

- `Lager`: aktueller Bestand, Plus/Minus-Buchung und Umlagerung zwischen Lagerorten
- `Katalog`: Dachdeckerartikel suchen und ins eigene Lager uebernehmen
- `Mindestbestand`: knappe Artikel sofort auffuellen
- `Orte`: Hauptlager, Fahrzeuglager, Baustelle, Container und Werkstatt pflegen
- `Schnellerfassung`: typische Startbestaende schnell aufnehmen
- `Angebote`: Preisvergleich aus manuellen Angeboten, CSV-Feeds und vorbereiteten offiziellen Integrationen

Beim ersten Oeffnen legt die App Standard-Lagerorte fuer die Firma an. Katalogdaten sind globale Stammdaten; Lagerbestaende, Lagerorte und Lieferanten sind immer firmeneigen per RLS geschuetzt.

## Live-Preisvergleich

Der Preisvergleich ist unter `/materials/live-offers` erreichbar. Lieferantenintegrationen liegen unter `/suppliers`.

- Manuelle Angebote funktionieren sofort
- CSV-Angebote koennen ueber `/materials/live-offers/import` importiert werden
- idealo, Geizhals, Google Shopping, eBay, Amazon Business, Contorion, Hornbach, BAUHAUS, OBI, Wuerth, SPAX und fischer sind als Provider vorbereitet
- Offizielle Anbieter liefern ohne API-Key eine klare Fehlermeldung
- Geschuetzte Shops werden nicht gescraped
- Angebote koennen Material zugeordnet und als EK uebernommen werden
- Im Lagerdetail `/materials/inventory/[id]` sieht Chef guenstigstes Angebot, schnellste Lieferung und besten Deal

Mitarbeiter haben keinen Zugriff auf Preisvergleichstabellen. Die RLS-Policies erlauben `supplier_integrations`, `supplier_offers`, `supplier_offer_matches` und `supplier_price_history` nur fuer Admin/Chef.

## Online Price Discovery

Die Online-Recherche ist unter `/materials/online-discovery` erreichbar und ist nur ein Preisindikator fuer Admin/Chef.

- Adapter vorbereitet fuer `wuerth_catalog_csv`, `manual_csv`, `ebay`, `priceapi`, `dataforseo_google_shopping` und `searchapi_google_shopping`
- CSV-Preislisten von Wuerth, BTI, Foerch oder Baustoffhandel koennen als erlaubter Feed angebunden werden
- eBay nutzt die offizielle Browse API, SearchApi nutzt die Google-Shopping Search API, DataForSEO ist fuer Google-Shopping Live-Requests vorbereitet
- Quellen werden nur ueber erlaubte CSV-Feeds, JSON-Feeds oder offizielle API-Zugaenge abgefragt
- Ohne konfigurierte Live-Quelle nutzt die App interne Markt-Richtpreise fuer typische Verbrauchsartikel als Fallback
- Wenn auch der Richtpreis-Katalog keinen passenden Begriff kennt, erscheint: `Keine aktuellen Online-Angebote gefunden`
- Fehler einzelner Quellen brechen die App nicht; sie werden als Quellenstatus angezeigt
- Alle Onlinepreise sind klar markiert: `Preisvorschlag aus Online-Recherche – vor Bestellung prüfen.`
- Kalkulationsprioritaet im Lagerdetail: eigener EK, CSV-/Lieferantenpreis, eBay, PriceAPI/DataForSEO/SearchApi, Markt-Richtpreis
- Markt-Richtpreise werden nur als Fallback genutzt, wenn keine bessere Quelle Treffer liefert

Online-Preisdaten liegen in `online_price_discoveries` und `online_price_offers`. RLS erlaubt Zugriff nur fuer Admin/Chef.

## Materialberechnung auf Baustellen

Jede Baustelle hat eine Detailseite unter `/baustellen/[id]`. Dort koennen Admin/Chef eine schnelle Vor-Kalkulation erstellen:

- Dachart waehlen: Steildach, Flachdach, Reparatur, Entwaesserung oder Blech
- Laenge und Breite eintragen; die Flaeche wird automatisch berechnet
- optionale Laengen fuer Traufe, First, Ortgang, Kehle und Wandanschluss eintragen
- Standard-Verschnitt ist 20 %, in den Chef-Einstellungen aenderbar
- berechnete Materialliste zeigt Grundmenge, Zuschlag, Gesamtmenge und fuer Chef/Admin EK, VK und Marge

Mitarbeiter sehen auf zugeordneten Baustellen nur Materialname, benoetigte Menge, Einheit, Lagerort, Bestand und Mindestbestand. EK, VK, Aufschlag, Marge und Gesamtkosten sind in Frontend und Datenbankzugriff getrennt.

## Kunden und Auftraege

Die Kundenkartei ist unter `/customers` erreichbar. Admin/Chef koennen Kunden anlegen, bearbeiten und aus dem Kundenprofil direkt einen neuen Auftrag starten.

Die Auftragsstrecke ist unter `/orders` erreichbar:

- `/orders/new`: Wizard fuer Kunde, Auftrag, Maße und automatische Materialberechnung
- Laenge und Breite berechnen die Flaeche automatisch
- Auftragsdetail: strukturiertes Aufmass mit Dachflaechen, Abzuegen, Traufe, First, Ortgang, Kehle, Wandanschluss, Fallrohr und Stueckzahlen
- Standard-Verschnitt ist 20 %, kann aber von Chef/Admin angepasst werden
- Beim Speichern entsteht automatisch eine verknuepfte Baustelle
- Materialbedarf wird in `job_material_requirements` gespeichert
- Mitarbeiter lesen nur `orders_public` und `job_material_requirements_public`

Chef/Admin sehen im Auftragsdetail EK gesamt, VK gesamt und Marge. Mitarbeiter sehen nur Materialname, Gesamtmenge, Einheit, Lagerort, Bestand und Mindestbestand.

## SaaS-Haertung

Die Datei `supabase/migrations/20260615_saas_hardening.sql` erweitert das Datenmodell um:

- Firmenprofil-Felder fuer spaetere Briefkopf-/Rechnungsdaten
- `archived_at` fuer zentrale Tabellen als Grundlage fuer Soft Delete
- `company_audit_log` fuer spaetere Audit-Protokolle kritischer Betriebsdaten
- zusaetzliche Indizes fuer Archiv- und Audit-Abfragen

Die App vermeidet sichtbare Scheinfunktionen. Noch nicht produktive Bereiche wie Angebote/Rechnungen oder PDF-Export aus Kalkulationen sind deutlich als `Vorbereitet` markiert.

## Production & Legal Readiness

Die App enthaelt technische Grundlagen fuer Datenschutz und B2B-SaaS-Betrieb. Diese ersetzen keine anwaltliche Pruefung.

- Datenschutz-Center unter `/privacy` mit eigenem Datenexport, Firmenexport fuer Chef/Admin und Datenschutzanfragen.
- Billing unter `/billing` mit Stripe Checkout, Stripe Customer Portal, Tariflimits und KI-Kontingent.
- Angebote/Rechnungen unter `/invoices` mit Belegstatus, PDF-Export und Auftrag-Uebernahme. Das aeltere Modul `/angebote-rechnungen` bleibt fuer bestehende DATEV-/XRechnung-Exporte erreichbar.
- Rechtliche Entwurfsseiten unter `/legal`.
- Consent-Banner fuer notwendige Login-Cookies und optionale Analyse/Marketing-Verarbeitung.
- Datenlandkarte und Subprozessoren in `DATA_PROCESSING.md` und `SUBPROCESSORS.md`.
- Security-Hinweise in `SECURITY.md`.
- Loesch-/Aufbewahrungsentwurf in `RETENTION_POLICY.md`.
- DSGVO-Checkliste in `DSGVO_CHECKLIST.md`.
- KI nur serverseitig; Mitarbeiterkontext ohne Preis-/Margendaten und ohne separate Kundenliste.
- Tagesbericht-Fotos werden typ- und groessenvalidiert; Storage Bucket bleibt privat.

Vor Produktion final pruefen: Impressum, AGB, Datenschutzerklaerung, AVV, Subprozessoren, Supabase/OpenAI-Regionen, Arbeitsrecht rund um Zeiterfassung, konkrete Loeschfristen und technische/organisatorische Massnahmen.

## Wichtige Dateien

- `app/`: Next.js App Router Seiten und Layouts
- `components/`: UI- und Formular-Komponenten
- `lib/actions/`: Server Actions fuer CRUD und Auth
- `lib/supabase/`: Supabase Browser-, Server- und Middleware-Clients
- `types/app.ts`: zentrale App-Typen
- `supabase/schema.sql`: Datenbank, Trigger, Storage und RLS
- `supabase/migrations/20260614_customers_orders.sql`: Delta fuer Kunden, Auftraege und Auftragsmaterial
- `supabase/migrations/20260614_supplier_price_comparison.sql`: Delta fuer Lieferanten und Angebotsvergleich
- `supabase/migrations/20260614_online_price_discovery.sql`: Delta fuer Online Price Discovery
- `supabase/migrations/20260614_voice_bring_lists_inventory_alerts.sql`: Delta fuer Spracheingabe, Mitbringlisten und Materialwarnungen
- `supabase/migrations/20260615_saas_hardening.sql`: Delta fuer Firmenprofil, Archivierung und Audit-Grundlage
- `supabase/migrations/20260615_roles_security_hardening.sql`: Delta fuer Vorarbeiter-Rolle und Rollen-Haertung
- `supabase/migrations/20260615_privacy_compliance.sql`: Delta fuer Datenschutzanfragen und Storage-Haertung
- `supabase/migrations/20260619_stripe_billing.sql`: Delta fuer Stripe Billing, Tariflimits und Webhook-Idempotenz
- `supabase/migrations/20260619_dashboard_rpc.sql`: Delta fuer gebuendelte Dashboard-RPC, Cache-Tags und mandantensichere Summary-Daten
- `supabase/migrations/20260620_soft_delete_columns.sql`: Delta fuer Soft-Delete-Schutz und gesperrte Hard-Deletes bei Geschaeftsdaten
- `supabase/migrations/20260622_rls_consolidation.sql`: Delta fuer dokumentierte RLS-Policy-Matrix und Entfernung exakt redundanter Redteam-Fallback-Policies
- `supabase/migrations/20260622_employee_permissions.sql`: Delta fuer feingranulare Mitarbeiterrechte mit RLS, Manager-Bypass und Audit-Log
- `supabase/migrations/20260622_commercial_documents.sql`: Delta fuer Angebote/Rechnungen, Positionen, Summen-Trigger und Manager-only RLS
- `supabase/migrations/20260622_redteam_hardening.sql`: Delta fuer RedTeam-Fixes gegen Lieferanten-Dubletten und doppelte Stundenzettel
- `supabase/migrations/20260623_session_timeout_setting.sql`: Delta fuer firmenweite Inaktivitaets-Abmeldung auf geteilten Geraeten
- `supabase/migrations/20260624_onboarding.sql`: Delta fuer gefuehrten Firmen-Start, Onboarding-Abschluss, Gewerk, Firmenlogo und Logo-Storage-RLS
- `supabase/migrations/20260628_planning_board.sql`: Delta fuer Plantafel, Ressourcenplanung, Konflikt-Erkennung und rollenbasierte RLS
- `supabase/migrations/20260629_planning_weather_risks.sql`: Delta fuer Plantafel-Wetterrisiken, Cache und Chef-Bestaetigung/Ignorieren
- `supabase/migrations/20260630_inventory_jobsite_flow.sql`: Delta fuer Baustellen-Verbrauch, Rueckgabe, Verlust/Bruch, Reservierung und unveraenderbare Materialbewegungen
- `supabase/migrations/20260701_auto_bring_lists.sql`: Delta fuer automatische Mitbringlisten, Quellen-Schutz, manuelle Ergaenzungen und Audit-Log
- `supabase/migrations/20260702_delivery_note_recognition.sql`: Delta fuer Lieferschein-Fotoerkennung, private Originalfotos, Preis-Isolation und bestaetigten Wareneingang
- `supabase/migrations/20260703_ai_roof_material_calculation.sql`: Delta fuer KI-gestuetzte Dachdecker-Materialberechnung, Fehlmengen und pruefpflichtige Vorschlaege
- `supabase/migrations/20260704_resource_vehicle_management.sql`: Delta fuer Fahrzeuge, Maschinen, Werkzeuge, Prueftermine, Dokumente und Plantafel-Zuordnung
- `supabase/migrations/20260705_flexible_checklists.sql`: Delta fuer wiederverwendbare Checklisten, Baustellen-Checks, Foto-Nachweise, optionale Signatur und automatische Problem-Aufgaben
- `supabase/migrations/20260706_defect_management.sql`: Delta fuer Maengel, Fotos, Fristen, Kundenfreigabe, interne Benachrichtigungen und PDF-Maengelbericht
- `supabase/migrations/20260712_price_permission_hardening.sql`: Delta entfernt delegierbare Chef-/Preisrechte fuer Mitarbeiter/Vorarbeiter und haertet `has_employee_permission`
- `supabase/migrations/20260713_redteam_storage_prefetch_hardening.sql`: Delta bindet Report-Foto-Storage-Lesen an Bericht-Metadaten und Berichtsrechte
- `supabase/material-catalog-seed.sql`: praxisnaher Dachdecker-Materialkatalog
- `scripts/seed-demo-company.mjs`: realistische Demo-Firma fuer Verkauf, QA und Produktdemos
- `tests/`: Unit-, Integration- und E2E-Smoke-Tests
- `SECURITY.md`, `PRIVACY.md`, `DATA_PROCESSING.md`, `DSGVO_CHECKLIST.md`, `SUBPROCESSORS.md`, `RETENTION_POLICY.md`: pruefpflichtige Produktions-/Datenschutzdokumentation

## Qualitaet pruefen

```bash
npm run lint
npm run test
npm run build
```

Optionaler Mobile-E2E-Smoke-Test:

```bash
npx playwright install chromium
npm run test:e2e
```

Vollstaendiger Demo-QA-Lauf mit frischer Demo-Firma:

```bash
npm run test:e2e:demo
```

Details zu Demo-Daten, Testlogins, Hauptablaeufen und Fehlerfaellen stehen in `docs/QA_TESTING.md`.

Wenn Supabase-Umgebungsvariablen fehlen, kann die App nicht vollstaendig starten. Die erwarteten Variablen stehen in `.env.example`.

## Deployment auf Vercel

1. Projekt mit dem Git-Repository in Vercel verbinden.
2. Environment Variables aus `.env.example` in Vercel setzen.
3. In Supabase die Production Site URL auf deine Vercel-Domain setzen.
4. Supabase Redirect URL eintragen:

```text
https://deine-domain.de/auth/callback
```

5. In Supabase alle benoetigten SQL-Dateien ausfuehren: `schema.sql` fuer Neuinstallation oder die Migrationsdateien fuer bestehende Projekte.
6. Danach in Vercel deployen. Build Command: `npm run build`.

Secrets wie `SUPABASE_SERVICE_ROLE_KEY`, API-Keys und `SUPPLIER_API_ENCRYPTION_KEY` duerfen niemals als `NEXT_PUBLIC_*` Variablen gesetzt werden.
