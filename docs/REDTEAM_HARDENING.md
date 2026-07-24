# Redteam-Härtung

BauPro hat eine zusätzliche Redteam-Pipeline, die aggressive Angriffsflächen sicher und reproduzierbar prüft. Die Checks laufen lokal, in CI oder gegen eine ausdrücklich freigegebene Staging-Umgebung. Sie greifen keine Production-Datenbank, keine fremden Systeme und keine Drittanbieter produktiv an.

## Befehle

```bash
npm run redteam:full
```

Der Master-Befehl führt diese Kategorien aus:

- `redteam:security`: CSP, Origin-Check, sichere Fehler, Secret-/Eval-/Rate-Limit-Grenzen
- `redteam:auth`: Login, deaktivierte Profile, Session-Refresh, MFA und geschützte Routen
- `redteam:roles`: Admin, Chef, Vorarbeiter, Mitarbeiter, Kunde und Preis-Schutz
- `redteam:multi-tenant`: Mandantentrennung, Tenant-Guards und Firmenfilter
- `redteam:api`: Server Actions, FormData-Manipulation, sichere API-Routen
- `redteam:rls`: Supabase RLS, Security-Invoker-Views, RPC-/Trigger-Hardening
- `redteam:files`: Upload-Größe, MIME- und Magic-Byte-Prüfung
- `redteam:photos`: mobile Fotoaufnahme, Storage-Pfade und Download-Schutz
- `redteam:pdf`: PDF-Exports ohne interne EK-/Margen-Leaks
- `redteam:nfc`: QR-/NFC-Vorbereitung für Ressourcen
- `redteam:offline`: Offline-Queue, begrenzte lokale Speicherung und Flush-UX
- `redteam:pwa`: Service-Worker-Cache, Offline-Seite und Manifest
- `redteam:voice`: Spracheingabe mit Bestätigung, Limits und Fallback
- `redteam:inventory`: atomare Lagerbuchungen, Reservierungen und negative-Bestand-Schutz
- `redteam:time`: Zeiterfassung, Freigaben, Edge Cases und Export
- `redteam:billing`: Stripe-Webhooks, Idempotenz und Plan-/KI-Limits
- `redteam:load`: sicherer k6-Konfigurationscheck für realistische Lasttests
- `redteam:chaos`: nicht-destruktive Chaos-Harness-Prüfung
- `redteam:release`: prüft, ob die Redteam-Gates in Scripts, CI und Doku verankert sind

Jede Kategorie kann einzeln ausgeführt werden, z. B.:

```bash
npm run redteam:roles
npm run redteam:inventory
npm run redteam:load
```

## Sichere Grenzen

- Standardmäßig sind Redteam-Checks statisch bzw. nicht-destruktiv.
- Echte Lasttests laufen nur über `npm run test:load` oder `npm run test:stress` und verlangen eine dedizierte Test-/Staging-Umgebung.
- Der 2.000-User-Stresstest verlangt `LOAD_TEST_ENVIRONMENT=local|test|staging` und `LOAD_TEST_ACKNOWLEDGE_2000_USERS=1`.
- Bekannte Production-Hosts werden vom Load-Runner blockiert.
- Live-Chaos-Probes werden nur mit `REDTEAM_LIVE_CHAOS=1` gestartet und sollten nur gegen lokale/staging Systeme laufen.
- Es werden keine echten API-Keys geloggt und keine echten Kundendaten verwendet.

## Release-Gate

`npm run check:security`, `npm run check:release` und `npm run check:all` führen `redteam:release` mit aus. Ein Release blockiert damit, wenn die Redteam-Pipeline aus den zentralen Scripts, der CI oder der Doku entfernt wird.

Für vollständige lokale Freigabe:

```bash
npm run redteam:full
npm run check:all
npm run build
```

## Ergebnisbericht

Der Redteam-Runner gibt für jede Kategorie blockierende Findings und Warnungen aus. Warnungen sind bewusst nicht blockierend, wenn eine Funktion vorbereitet, aber ohne Live-Umgebung nicht prüfbar ist, z. B. NFC-Hardware oder Live-Chaos-Probes.

Bei Findings gilt:

1. Ursache im Code oder Schema suchen.
2. Fix implementieren.
3. Regression-Test ergänzen.
4. Gate erneut ausführen.
5. Relevante Doku oder Runbooks aktualisieren.
