# BauPro Chaos Engineering

Diese Checks sind bewusst **nicht-destruktiv**. Sie testen, ob BauPro bei
kaputten Sessions, falschen Payloads, fehlender Authentifizierung, hohen
Request-Spitzen und Timeouts sauber reagiert.

## Lokal ausführen

1. Produktionsbuild erstellen:

   ```bash
   npm run build
   ```

2. Server starten:

   ```bash
   npm run start
   ```

3. In einem zweiten Terminal:

   ```bash
   npm run test:chaos
   ```

## Was geprüft wird

- Öffentliche Seiten liefern keine 500er unter Burst-Last.
- Geschützte Seiten ohne Session antworten kontrolliert mit Redirect,
  `401` oder `403`.
- API-Routen mit kaputter oder fehlender Authentifizierung liefern keine
  Stacktraces und keine rohen Provider-/DB-Fehler.
- Malformed JSON und überlange KI-Payloads werden kontrolliert abgefangen,
  bevor kostenpflichtige oder datenverändernde Verarbeitung startet.
- Kritische Requests haben ein Client-seitiges Timeout im Chaos-Harness.

## Grenzen

- Dieser Harness schreibt keine echten Geschäftsdaten.
- Er ersetzt keine Lasttests mit Demo-Login (`npm run test:load`).
- Echte Produktions-Chaos-Experimente gegen Vercel/Supabase dürfen nur mit
  explizitem Wartungsfenster, Backups und Rollback-Plan laufen.

## Wichtige ENV-Variablen

- `CHAOS_BASE_URL`: Ziel-URL, Standard `http://localhost:3000`
- `CHAOS_TIMEOUT_MS`: Timeout pro Request, Standard `5000`
- `CHAOS_BURST_CONCURRENCY`: parallele Checks, Standard `8`
- `CHAOS_PUBLIC_ROUTES`: optionale kommagetrennte Liste öffentlicher Routen
- `CHAOS_PROTECTED_ROUTES`: optionale kommagetrennte Liste geschützter Routen
