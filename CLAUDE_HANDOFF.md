# BauPro Übergabe für Claude

## Wichtig

Keine Secrets oder API-Keys weitergeben. Nicht kopieren:

- `.env.local`
- Supabase Secret Key
- OpenAI API Key
- private Tokens
- `node_modules`
- `.next`

## Projekt

BauPro ist eine Next.js/TypeScript/Supabase-App für Dachdecker- und Handwerksbetriebe.

Ziel: verkaufsfähige SaaS-Version mit:

- Firmen- und Rollenmodell
- Rollen: `admin`, `chef`, `vorarbeiter`, `mitarbeiter`, `kunde`
- Baustellen/Aufträge
- Kunden
- Tagesberichte
- Material/Lager
- Mitbringlisten
- Zeiterfassung
- Stundenzettel PDF/CSV
- Wetterdaten
- KI-Funktionen serverseitig
- Supabase RLS für Mandantentrennung

## Aktueller Stand

Lokaler Pfad:

```txt
/Users/angelo/Documents/BauPro
```

Dev-Server:

```bash
npm run dev
```

Lokale URL:

```txt
http://localhost:3000
```

Demo-Login laut README:

```txt
chef@mueller-dachtechnik.example
BauProDemo!2026
```

## Letzter gefixter Fehler

Problem:

Die Seite `/time-tracking` zeigte dauerhaft Ladezustand bzw. danach:

```txt
Daten konnten nicht geladen werden.
```

Ursache:

Supabase hatte noch nicht alle Wetter-Spalten in `time_entries`, konkret:

```txt
column time_entries.weather_summary does not exist
```

Fix:

Die Zeiterfassung ist jetzt abwärtskompatibel:

- Wenn Wetter-Spalten vorhanden sind, nutzt BauPro sie.
- Wenn Wetter-Spalten fehlen, lädt und speichert die Zeiterfassung trotzdem mit den Kernfeldern.
- Wetterdaten bleiben optional.

Wichtige Dateien:

```txt
lib/data/time-entries.ts
lib/data/selects.ts
app/(app)/time-tracking/page.tsx
app/(app)/time-tracking/daily/page.tsx
app/(app)/time-tracking/[id]/edit/page.tsx
lib/actions/time-tracking-actions.ts
lib/time-report-export.ts
tests/unit/performance-prefetch.test.ts
```

## Prüfungen nach Fix

Ausgeführt und grün:

```bash
npm run lint
npm run test
npm run db:schema-check
npm run build
```

Zusätzlich im Browser geprüft:

```txt
/time-tracking
/time-tracking/daily
/time-tracking/new
```

Alle laden ohne Endloszustand und ohne `Daten konnten nicht geladen werden`.

## Supabase-Migrationen

Für volle Wetterfunktion sollte diese Migration in Supabase ausgeführt sein:

```txt
supabase/migrations/20260616_weather_fields.sql
```

Die App läuft jetzt aber auch ohne diese Migration weiter.

## Review-Auftrag für Claude

Bitte prüfe die App wie ein Senior Fullstack/Security Reviewer:

1. Keine Secrets im Frontend.
2. Supabase RLS und Mandantentrennung.
3. Rollenrechte:
   - Admin/Chef sehen alles inklusive Preise.
   - Vorarbeiter/Mitarbeiter sehen keine EK/VK/Margen/Preisquellen.
   - Mitarbeiter nur eigene/zugewiesene Daten.
4. Zeiterfassung:
   - Mitarbeiter dürfen eigene Zeiten erfassen.
   - Genehmigte Zeiten für Mitarbeiter gesperrt.
   - Chef/Admin sehen Tagesstunden und Monatsberichte.
   - PDF/CSV Export prüfen.
5. Material/Lager:
   - Keine Preis-Leaks.
   - Reservierungen/Umlagerungen möglichst atomar.
6. Wetter:
   - Keine Pflicht beim Arbeitsstart.
   - Wetterdaten optional und sauber fallbackfähig.
7. Runtime:
   - Keine rohen DB-Fehler an Nutzer.
   - Loading/Empty/Error States prüfen.
8. Build/Test:
   - `npm run lint`
   - `npm run test`
   - `npm run build`

## Hinweis für Claude

Falls Supabase lokal/live nicht dieselben Migrationen hat, können einzelne Features in der Datenbank fehlen. In diesem Fall bitte unterscheiden zwischen:

- Codefehler
- fehlender Migration
- absichtlich optionalem Fallback

Keine Secrets in Logs oder Antworten ausgeben.
