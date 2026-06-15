# BauPro

BauPro ist eine mobile-first Betriebssoftware fuer deutsche Dachdecker- und Handwerksbetriebe. Die App nutzt Next.js, TypeScript, Tailwind CSS und Supabase fuer Auth, Datenbank, Storage und Row Level Security.

## Funktionen

- Firmenregistrierung mit Admin-Profil
- Firmenprofil, Profilseite, Rollenverwaltung und Chef-Einstellungen
- Login/Logout ueber Supabase Auth
- Rollen: `admin`, `chef`, `vorarbeiter`, `mitarbeiter`
- Vorarbeiter-Rolle ohne Preis-/Chef-Rechte
- Rollenklare Navigation fuer Chef/Admin, Vorarbeiter und Mitarbeiter
- Dashboard als Betriebszentrale bzw. Mitarbeiter-Arbeitstag
- Kundenkartei mit Privatkunden, Gewerbekunden, Hausverwaltungen, Architekten und Versicherungen
- Auftragsanlage aus der Kundenkartei mit automatischer Auftragsnummer
- Kalenderuebersicht fuer Auftraege, Baustellen und Zeiten
- Baustellen-CRUD mit Mitarbeiterzuordnung
- Tagesberichte-CRUD mit Arbeitszeiten, Wetter, Materialverbrauch, Besonderheiten und Foto-Upload
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
- Materialberechnung je Baustelle und Auftrag mit Dachart, Maßen, 20 % Standard-Verschnitt und Chef-Preisen
- Angebote/Rechnungen als klar markierter vorbereiteter Produktbereich
- Fahrzeuge mit einfachem Fahrzeuglager
- Teamverwaltung und manuelles Anlegen von Mitarbeitern
- Datenschutz-Center mit Auskunftsexport, Firmenexport und Betroffenenanfragen
- Rechtliche Entwurfsseiten fuer Impressum, Datenschutz, AGB, AVV, Cookies, Loeschkonzept und Subprozessoren
- Consent-Banner mit Opt-in fuer optionale Analyse/Marketing-Verarbeitung
- Upload-Validierung fuer Tagesbericht-Fotos
- Supabase SQL-Schema mit Row Level Security pro Firma

## Lokales Setup

1. Dependencies installieren:

```bash
npm install
```

2. Supabase-Projekt erstellen und Schema ausfuehren:

```text
supabase/schema.sql
```

Die Datei erstellt Tabellen, RLS-Policies, Auth-Trigger und den privaten Storage Bucket `report-photos`.

Wenn dein Projekt bereits mit einer aelteren BauPro-Version laeuft, kannst du fuer Kunden und Auftraege alternativ die Delta-Migration ausfuehren:

```text
supabase/migrations/20260614_customers_orders.sql
```

Fuer den Live-Preisvergleich gibt es eine eigene Delta-Migration:

```text
supabase/migrations/20260614_supplier_price_comparison.sql
```

Fuer Online Price Discovery gibt es ebenfalls eine Delta-Migration:

```text
supabase/migrations/20260614_online_price_discovery.sql
supabase/migrations/20260614_online_price_source_adapters.sql
```

Fuer die Zeiterfassung und PDF-/CSV-Stundenzettel gibt es diese Delta-Migration:

```text
supabase/migrations/20260614_time_tracking.sql
```

Fuer Spracheingabe, Mitbringlisten, Materialwarnungen und Einkaufsvorschlaege gibt es diese Delta-Migration:

```text
supabase/migrations/20260614_voice_bring_lists_inventory_alerts.sql
```

Falls Supabase danach noch `Could not find the table 'public.material_alerts' in the schema cache` oder `relation "public.bring_lists" does not exist` meldet, fuehre diesen idempotenten Reparatur-Hotfix im Supabase SQL Editor aus. Er legt die fehlende Kette fuer Mitbringlisten, Materialwarnungen, Reservierungen und Einkaufsvorschlaege an:

```text
supabase/migrations/20260615_material_alerts_repair.sql
```

Fuer die SaaS-Haertung mit Firmenprofil-Feldern, Archivspalten und Audit-Grundlage gibt es diese Delta-Migration:

```text
supabase/migrations/20260615_saas_hardening.sql
```

Fuer produktionsnahe KI-Funktionen mit Usage-Logging, Aktionsvorschlaegen und KI-Einstellungen gibt es diese Migration:

```text
supabase/migrations/20260615_ai_features.sql
```

Fuer KI-Auftragsentwuerfe, Chef-Kalkulationen und Kalkulationseinstellungen gibt es diese Migration:

```text
supabase/migrations/20260615_ai_job_wizard.sql
```

Fuer die Vorarbeiter-Rolle und Rollen-Haertung gibt es diese Migration:

```text
supabase/migrations/20260615_roles_security_hardening.sql
```

Fuer Datenschutz-Center, Betroffenenanfragen und geschaerfte Foto-Storage-Policy gibt es diese Migration:

```text
supabase/migrations/20260615_privacy_compliance.sql
```

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
```

`SUPABASE_SERVICE_ROLE_KEY` ist nur serverseitig und wird fuer das manuelle Anlegen von Mitarbeitern benoetigt.
`SUPPLIER_API_ENCRYPTION_KEY` ist optional, aber erforderlich, wenn du offizielle API-Keys fuer Lieferanten speichern willst.
Die `ONLINE_PRICE_*` Variablen fuer CSV-Preislisten, eBay, PriceAPI, DataForSEO und SearchApi sind optional.
Ohne konfigurierte Quelle zeigt die App sauber an, dass keine aktuellen Online-Angebote gefunden wurden.
`OPENAI_API_KEY` ist optional und darf niemals mit `NEXT_PUBLIC_` beginnen. Ohne Key bleiben alle Kernfunktionen aktiv; KI-Bereiche zeigen dann „KI-Funktionen sind noch nicht konfiguriert.“

5. Supabase Auth konfigurieren:

- Site URL lokal: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/auth/callback`
- Fuer lokale Tests kannst du E-Mail-Bestaetigung deaktivieren.

6. Optionale Demo-Firma anlegen:

```bash
npm run seed:demo
```

Das Skript benoetigt `NEXT_PUBLIC_SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
Es legt die Demo-Firma `Müller Dachtechnik GmbH` mit einem Chef, zwei Vorarbeitern, fuenf Mitarbeitern, Baustellen, Lagerbestand, Fahrzeugen, Zeiten, Berichten, Mitbringliste, Materialwarnungen und Einkaufsvorschlaegen an.

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

## Rollenmodell

- `admin` und `chef`: duerfen Firma, Kunden, Auftraege, Team, Baustellen, Material, Fahrzeuge, Aufgaben und alle Berichte verwalten.
- `vorarbeiter`: sieht zugeordnete Baustellen, Auftraege, Zeiten, Tagesberichte, Mitbringlisten, Materialmeldungen und preisbereinigte Lagerdaten. EK, VK, Marge, Einkaufsvorschlaege und Preisvergleich bleiben gesperrt.
- `mitarbeiter`: sieht eigene Aufgaben, eigene/zugeordnete Berichte, zugeordnete Baustellen, zugeordnete Auftraege, eigene Zeiten, Mitbringlisten und Materialmeldungen. Stammdaten, Preisquellen, EK, VK, Aufschlag und Marge bleiben gesperrt.

Die RLS-Policies in `supabase/schema.sql` erzwingen, dass Nutzer nur Daten ihrer eigenen Firma sehen.

## Produktnavigation

Chef/Admin sieht:

- Dashboard
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

Mitbringlisten liegen unter `/bring-lists`. Chef/Admin kann Listen manuell erstellen oder im Auftragsdetail aus dem berechneten Materialbedarf eine Liste fuer morgen erzeugen. Mitarbeiter koennen Positionen abhaken und fehlendes Material melden.

Der Lagerabgleich prueft Bestand, Mindestbestand und offene Reservierungen. Bei Fehlbestand entstehen Materialwarnungen und Einkaufsvorschlaege fuer Chef/Admin im Dashboard. Einkaufsvorschlaege und Einkaufsdaten sind fuer Mitarbeiter nicht sichtbar.

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
