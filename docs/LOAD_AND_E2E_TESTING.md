# BauPro Last- und E2E-Tests

Stand: 2026-07-03

## Ziel

Diese Testschicht prueft BauPro unter realistischen Betriebsablaeufen:

- Login/Auth mit unterschiedlichen Rollen
- Dashboard, Baustellen, Kunden, Auftraege, Lager, Zeiten, Berichte und Material
- Such- und Filterpfade
- PDF-/Export-Endpunkte
- Fehlerfaelle wie ungueltiger Login, ungueltiges Kundenportal-Token und fehlende Berechtigungen
- Rollen- und Preis-Schutz fuer Chef, Vorarbeiter und Mitarbeiter
- Upload-foermige Requests mit Testbild, falls ein dedizierter Test-Upload-Endpunkt gesetzt ist

Der 2.000-User-Test ist bewusst **optional**. Er darf nicht gegen Production oder echte Kundendaten laufen.

## Werkzeuge

- Playwright: echte Browser-Flows, Formulare, Uploads, PDF-Downloads, mobile Ansicht.
- k6: parallele Last, Antwortzeiten, Fehlerraten, Rollenmix, geschuetzte Routen und API-/Export-Endpunkte.
- Vitest: statische und logische Guards fuer Security, RLS, Rollen und Testkonfiguration.

## Testumgebung vorbereiten

Nutze eine lokale Supabase-Instanz oder eine separate Supabase-Testinstanz. Nicht die Production-Datenbank verwenden.

```bash
cp .env.example .env.local
```

Pflichtwerte fuer E2E-/Load-Tests:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
LOAD_BASE_URL=http://localhost:3000
LOAD_TEST_ENVIRONMENT=local
LOAD_USERS_FILE=tests/load/baupro-users.example.json
```

Demo-Daten vorbereiten:

```bash
npm run seed:demo
```

Der Demo-Seed legt synthetische Daten fuer `Müller Dachtechnik GmbH` an. Keine echten Kundendaten verwenden.

## E2E-Funktionstest

Alle Playwright-Flows:

```bash
npm run test:e2e
```

Mobiler Smoke-Test:

```bash
npm run test:e2e:smoke
```

Demo neu seed'en und danach E2E laufen lassen:

```bash
npm run test:e2e:demo
```

Die bestehenden E2E-Tests decken unter anderem ab:

- Login, falscher Login und Logout
- Auftrag mit Aufmass, Materialbedarf und Kostenkalkulation erstellen
- Baustelle erstellen
- Zeiterfassung als Mitarbeiter und Freigabe/CSV als Chef
- Tagesbericht mit Foto und PDF
- Materialverbrauch melden und bestaetigen
- Plantafel/Ressourcen/Konflikte
- Kundenportal, digitale Unterschrift und Portal-Fehlerfaelle
- Mobile Navigation und Preis-Schutz

## k6 installieren

macOS:

```bash
brew install k6
```

Linux/CI:

Siehe offizielle k6-Installationsanleitung von Grafana. Das Repo installiert k6 bewusst nicht als npm-Paket, damit der 2.000-User-Test ein expliziter Infrastruktur-Test bleibt.

## Konfigurations-Gate

Dieser Check laeuft auch in CI und startet keinen Lasttest:

```bash
npm run test:load:check
```

Er prueft:

- k6-Script existiert
- Profilnamen sind gueltig
- bekannte Production-Domain ist blockiert
- 2.000-User-Test braucht eine bewusste Bestaetigung

## Lokaler Load-Test

Startet einen kleineren Load-Test mit Standardwerten:

```bash
LOAD_TEST_ENVIRONMENT=local \
LOAD_BASE_URL=http://localhost:3000 \
LOAD_TARGET_VUS=100 \
LOAD_DURATION=2m \
npm run test:load
```

## 2.000-User-Stresstest

Nur gegen Test/Staging:

```bash
LOAD_TEST_ENVIRONMENT=test \
LOAD_BASE_URL=https://deine-test-app.example.com \
LOAD_ALLOW_REMOTE_TARGET=1 \
LOAD_TEST_ACKNOWLEDGE_2000_USERS=1 \
LOAD_TARGET_VUS=2000 \
LOAD_DURATION=10m \
npm run test:stress
```

Wichtig:

- `bau-pro.vercel.app` ist als bekannte Production-Domain hart blockiert.
- Remote-Ziele brauchen `LOAD_ALLOW_REMOTE_TARGET=1`.
- Der 2.000er braucht `LOAD_TEST_ACKNOWLEDGE_2000_USERS=1`.
- Supabase muss eine dedizierte Testinstanz sein.
- Upstash Redis/KV sollte auch in der Testumgebung gesetzt sein, sonst misst der Test kein realistisches Rate-Limiting.

## Rollenmix

Standardnutzer stehen in:

```text
tests/load/baupro-users.example.json
```

Fuer eine echte Testinstanz kannst du eine eigene Datei setzen:

```env
LOAD_USERS_FILE=tests/load/baupro-users.staging.json
```

Struktur:

```json
[
  { "role": "chef", "email": "chef@example.test", "passwordEnv": "LOAD_CHEF_PASSWORD" },
  { "role": "vorarbeiter", "email": "vorarbeiter@example.test", "passwordEnv": "LOAD_FOREMAN_PASSWORD" },
  { "role": "mitarbeiter", "email": "mitarbeiter@example.test", "passwordEnv": "LOAD_EMPLOYEE_PASSWORD" }
]
```

## Optionale Export- und Upload-Pfade

Wenn du konkrete IDs aus der Testdatenbank hast, werden PDF-/Export-Endpunkte mitgetestet:

```env
LOAD_REPORT_ID=
LOAD_TIME_REPORT_ID=
LOAD_INVOICE_ID=
```

Upload-Tests brauchen einen dedizierten Test-Endpunkt, der keine echten Daten erzeugt:

```env
LOAD_UPLOAD_ENDPOINT=/api/test/upload
```

Ohne diese Variablen ueberspringt k6 die jeweiligen Teilpfade sauber.

## Ergebnisbericht

k6 schreibt JSON-Zusammenfassungen nach:

```text
test-results/load/
```

Im Bericht dokumentieren:

| Feld | Inhalt |
| --- | --- |
| Umgebung | lokal, Test oder Staging |
| simulierte Nutzer | Ziel-VUs und Dauer |
| getestete Rollen | Chef, Vorarbeiter, Mitarbeiter |
| Fehlerrate | `http_req_failed` und `baupro_business_errors` |
| Antwortzeiten | p95, p99, max |
| langsamste Seiten | aus k6 Summary und Vercel/Supabase Logs |
| Supabase-Hinweise | Connections, RLS-Fehler, Timeouts |
| kritische Bugs | reproduzierbarer Ablauf und Route |
| Skalierungsempfehlung | Compute, Pooling, Redis/KV, Query-/Indexbedarf |

## Quality Gate

Normales vollstaendiges Gate:

```bash
npm run test:all
```

Optional danach:

```bash
npm run test:load
npm run test:stress
```

Der Stresstest bleibt optional, weil 2.000 parallele Nutzer Infrastrukturkosten verursachen und eine isolierte Testumgebung brauchen.
