# BauPro UX Review - 2026-07-01

## Artifact Status

- Screenshots wurden als echte PNG-Dateien validiert.
- Bericht ist UTF-8-kodiert.
- Der Review ist als Arbeitsdokument gedacht: Befunde sind priorisiert, aber nicht automatisch gleichbedeutend mit bereits umgesetzten Produktänderungen.

## Audit Scope

Geprüft wurde der mobile Kernfluss mit iPhone-ähnlichem Viewport `390 x 844`:

1. Öffentliche Startseite `/`
2. Öffentliches Burger-Menü
3. Login `/login`
4. Demo `/demo`
5. Demo-Start zum Dashboard
6. Baustellen `/baustellen`
7. Material/Lager `/material`
8. Zeiterfassung `/time-tracking`
9. Berichte `/berichte`
10. Arbeitszeit erfassen `/time/new`
11. Neuer Auftrag `/orders/new`

Screenshots liegen im selben Ordner:

- `01-home-mobile.png`
- `02-mobile-menu.png`
- `03-login-mobile.png`
- `03-login-mobile-viewport.png`
- `04-demo-mobile.png`
- `04-demo-mobile-viewport.png`
- `05-demo-after-click.png`
- `06-baustellen-mobile.png`
- `07-material-mobile.png`
- `08-time-mobile.png`
- `09-berichte-mobile.png`
- `10-time-new-mobile.png`
- `11-order-new-mobile.png`

## Strengths

- Demo-Seite kommuniziert den Produktnutzen schnell: "BauPro in 2 Minuten verstehen" funktioniert als Einstieg.
- Demo-Start funktioniert lokal und führt direkt ins Chef-Dashboard.
- App-Seiten laden in der geprüften Demo ohne Endlos-Spinner.
- Mobile Cards und große CTAs sind grundsätzlich baustellentauglich.
- Rollen- und Sicherheitsversprechen sind im Marketing sichtbar: Preise, Kundenportal und KI werden nicht übertrieben verkauft.
- Zeiterfassungsformular ist nah am Baustellenbedarf: große Felder, 30-Minuten-Schritte, Offline-Hinweis.

## P1 UX Risks

### 1. Login versteckt den eigentlichen Login auf Mobile

Evidence: `03-login-mobile-viewport.png`

Code: `app/(auth)/layout.tsx:15-64`

Auf Mobile sieht der Nutzer zuerst fast nur den Marketing-Hero. Die Login-Felder liegen weiter unten. Für eine Baustellen-App ist das kritisch: Wer schon registriert ist, will sofort einloggen, nicht erst scrollen.

Empfehlung:

- Mobile Auth Layout umdrehen: Formular zuerst, Hero darunter oder stark verkleinert.
- Logo + Loginformular müssen im ersten Viewport sichtbar sein.
- Marketingchips auf Login mobile entfernen oder auf eine Zeile reduzieren.

### 2. Mobile App hat zu viele feste Ebenen unten

Evidence: `05-demo-after-click.png`, `06-baustellen-mobile.png`, `07-material-mobile.png`, `08-time-mobile.png`, `09-berichte-mobile.png`

Code: `components/app-shell.tsx:315`, `components/app-shell.tsx:322`, `components/app-shell.tsx:335-349`

Die App zeigt gleichzeitig:

- Voice Floating Button
- Mobile Action Dock
- Bottom Navigation
- teilweise Cookie Banner

Dadurch werden Inhalte verdeckt, besonders StatCards und erste Listenzeilen. Das wirkt langsam/kaputt, obwohl die Daten geladen sind.

Empfehlung:

- Entweder Bottom Navigation oder Action Dock, nicht beides dauerhaft.
- Action Dock nur auf Dashboard/Heute anzeigen, auf Listen/Formularen ausblenden.
- Voice Button an eine feste, konfliktfreie Stelle setzen oder in die Action Dock integrieren.
- Content Padding pro Seite dynamisch an aktive Fixed-Elemente koppeln.

### 3. Header ist auf Mobile zu voll und schneidet Titel ab

Evidence: `05-demo-after-click.png`, `06-baustellen-mobile.png`, `08-time-mobile.png`

Code: `components/app-top-bar.tsx:113-164`

Firmenname, Seitentitel, Theme Toggle, Userchip und Logout konkurrieren auf 390 px Breite. Titel wie "Dashboard", "Baustellen", "Arbeitszeit..." werden abgeschnitten.

Empfehlung:

- Mobile Header vereinfachen: Zurück links, kurzer Titel mittig, Profil-Menü rechts.
- Theme Toggle und Logout in ein Profil-Menü verschieben.
- Firmenname im Header auf Mobile nur im Dashboard oder als Tooltip/Drawer zeigen.

### 4. Berichte zeigen trotz Demo einen Datenbank-Migrationsfehler

Evidence: `09-berichte-mobile.png`

Code: `app/(app)/berichte/page.tsx:41`

Die Seite lädt Daten, zeigt aber zusätzlich "Datenbank-Update fehlt". Für Interessenten wirkt das wie ein kaputtes Produkt.

Empfehlung:

- Schema-Warnungen nicht mitten im normalen Demo-UI anzeigen.
- Admin/Systemdebug darf Warnung sehen; Demo-/Mitarbeiter-/Chef-Demo sollte einen neutralen Fallback zeigen.
- Migrationsstatus in `/debug/system` bündeln.

### 5. Neuer Auftrag startet mit E2E-Testkunden

Evidence: `11-order-new-mobile.png`

Code: `components/forms/order-wizard-form.tsx:260-276`

Im Demo-Modus sieht der erste Kunde aus wie Testdaten: `E2E Dachkunde 1782463019633`. Das zerstört sofort Vertrauen.

Empfehlung:

- Demo-Daten vor E2E-Daten sortieren oder E2E-Daten in Demo-Views ausblenden.
- Standardauswahl: "Kunde auswählen" statt erster Datensatz.
- Testdaten regelmäßig aus Demo-Umgebung löschen oder per Flag archivieren.

## P2 UX Risks

### 6. Öffentliche Startseite ist auf Mobile zu lang und wiederholt Nutzenargumente

Evidence: `01-home-mobile.png`

Code: `app/page.tsx:45-124`, `components/marketing/marketing-site.tsx`

Die Landingpage wirkt hochwertig, aber sehr lang. Viele Abschnitte erklären ähnliche Dinge: Warum BauPro, Was ist BauPro, Für wen geeignet, Baustellengefühl, Hauptfunktionen, Vorteile, KI/Rollen.

Empfehlung:

- Mobile Startseite kürzen: Hero, 3 Kernprobleme, 6 Funktionen, Demo CTA, FAQ.
- Detailtexte auf `/features`, `/use-cases`, `/security` auslagern.
- Sticky "Demo starten" CTA auf Mobile prüfen.

### 7. Burger-Menü ist funktional, aber sehr schwergewichtig

Evidence: `02-mobile-menu.png`

Code: `components/public/public-nav.tsx:95-158`

Das Menü ist sauber gebaut und enthält die richtigen Punkte. Visuell sind aber alle Menüpunkte gleich schwer. "Demo starten" und "Einloggen" sind gut sichtbar, rechtliche Links konkurrieren jedoch im selben Drawer.

Empfehlung:

- Menü in zwei Ebenen verdichten: "Produkt", "Vertrauen", "Rechtliches".
- Rechtliches kleiner und weiter unten lassen.
- Escape-Verhalten zusätzlich per E2E testen.

### 8. Cookie-Banner blockiert App-Formulare

Evidence: `10-time-new-mobile.png`

Code: `components/consent-banner.tsx:42-111`

Der Cookie-Banner liegt über dem Zeiterfassungsformular. Das ist rechtlich sauber gemeint, aber operativ störend, besonders in der App nach Login.

Empfehlung:

- Banner in eingeloggter App kleiner machen oder als nicht-blockierende Top-Notice darstellen.
- Auf Formularseiten nur minimale Leiste mit "Nur notwendig" anzeigen.
- Nach Demo-Start automatisch notwendigen Consent setzen, wenn rechtlich passend.

### 9. Quick Actions sind nicht kontextsensitiv genug

Evidence: `06-baustellen-mobile.png`, `07-material-mobile.png`, `08-time-mobile.png`

Code: `components/app-shell.tsx:152-168`, `components/app-shell.tsx:193-207`

Auf jeder Seite werden dieselben Schnellaktionen unten angezeigt. Das hilft im Dashboard, aber stört auf Listen und Formularen.

Empfehlung:

- Dashboard: drei Schnellaktionen behalten.
- Listen: nur eine primäre Floating Action zeigen, z. B. "Neue Baustelle".
- Formulare: keine globale Quickbar, nur Speichern/Abbrechen sticky unten.

## Accessibility Risks

- Mehrere sichtbare/fokussierbare Close-Controls im Public Menü wurden im Browser-Audit doppelt gemeldet. Prüfen, ob Fokusreihenfolge und `aria-label` eindeutig sind.
- Header-Titel werden visuell abgeschnitten; Screenreader haben zwar Text, sehende Mobile-Nutzer verlieren Kontext.
- Sehr große Display-Schrift auf Login funktioniert visuell, priorisiert aber Branding über Aufgabe.
- Fixed Overlays können Fokus und Touch-Ziele verdecken.
- Cookie-Banner hat nur `aria-label="Schliessen"` ohne Umlaut; UI-Texte sollten konsistent "Schließen" verwenden.

## Recommended Fix Order

1. Mobile Auth Layout reparieren: Formular im ersten Viewport.
2. App Mobile Chrome entschlacken: Bottom Nav behalten, Action Dock kontextabhängig machen, Voice nicht über Content.
3. Topbar mobile vereinfachen: Profil-Menü statt Userchip + Theme + Logout nebeneinander.
4. Demo-Daten säubern: keine E2E-Kunden in Demo-Listen.
5. Migrations-/Debug-Warnungen aus normalen Demo-Seiten entfernen.
6. Cookie-Banner in eingeloggter App entschärfen.
7. Landingpage mobile kürzen und Details auf Unterseiten verteilen.

## Evidence Limits

- Keine vollständige Tastatur-/Screenreader-Prüfung durchgeführt.
- Keine echten iPhone/Safari-Gerätetests durchgeführt.
- Kein vollständiger Speicher-/CRUD-Test in diesem Review; dieser Audit fokussiert UX und sichtbare Bedienbarkeit.
- Escape-Schließen im Public Menü konnte im In-App-Browser nicht zuverlässig simuliert werden und sollte mit Playwright/E2E separat getestet werden.
