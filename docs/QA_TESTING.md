# QA-Testlauf mit Demo-Firma

Diese Tests pruefen BauPro so, wie ein kleiner Dachdeckerbetrieb die App nutzt. Alle Testdaten sind frei erfunden und verwenden die Domain `mueller-dachtechnik.example`.

## Demo-Firma vorbereiten

Voraussetzungen in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Dann:

```bash
npm run seed:demo
```

Das Skript erstellt oder aktualisiert `Müller Dachtechnik GmbH` mit:

- Chef, zwei Vorarbeitern und fuenf Mitarbeitern
- Kunden, Baustellen und Auftraegen
- Fahrzeuge, Geraete/Ressourcen und Plantafel-Einsaetze
- Lagerorte, Lagerbestand, Materialwarnungen und Einkaufsvorschlaege
- Materialverbrauchsmeldungen und Materialbewegungen
- Tagesberichte, Zeiten, Stundenzettel und Arbeitsauftrag zur Kundensignatur
- bewusste QA-Fehlerfaelle: knappes Material, doppelte Planung und defektes eingeplantes Geraet

Standard-Login:

```text
chef@mueller-dachtechnik.example
BauProDemo!2026
```

Mitarbeiter-Login:

```text
max@mueller-dachtechnik.example
BauProDemo!2026
```

## Automatisierte Tests

Schnelle technische Tests:

```bash
npm run lint
npm run test
npm run build
```

E2E-Tests gegen die vorbereitete Demo-Firma:

```bash
npx playwright install chromium
npm run test:e2e
```

Demo neu seed’en und direkt E2E laufen lassen:

```bash
npm run test:e2e:demo
```

## Abgedeckte Hauptablaeufe

- Login, falscher Login und Logout
- Zeiterfassung als Mitarbeiter, Freigabe und CSV-Export als Chef
- Baustelle erstellen
- Tagesbericht erstellen, Foto hochladen und PDF exportieren
- Materialverbrauch melden und bestaetigen
- Kunde oeffnet Portal und unterschreibt Arbeitsauftrag digital
- Plantafel: Ressource anlegen, Planung erstellen, Konflikte sichtbar machen
- Rechte: Mitarbeiter sieht keine EK/VK-/Chef-Preisbereiche
- Fehlerfaelle: knappes Material, doppelte Planung, Offline-Fallback

## Hinweise

- E2E-Tests brauchen eine laufende Supabase-Test-/Dev-Datenbank mit aktuellem Schema.
- Keine echten Kundendaten verwenden. Die Demo-Daten sind bewusst synthetisch.
- Externe Dienste wie OpenAI, Stripe und Sentry werden in den Playwright-Fixtures gemockt.
