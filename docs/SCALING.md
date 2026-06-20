# Scaling und Datenbank-Connections

## Aktuelles Setup (PostgREST via supabase-js)

BauPro nutzt im App-Code keine direkte Postgres-Verbindung und keinen Datenbank-Connection-String. Die zentralen Clients in `lib/supabase/server.ts` lesen `NEXT_PUBLIC_SUPABASE_URL`, also die Supabase-Projekt-URL im Format `https://<project-ref>.supabase.co`.

Alle normalen Datenbankabfragen laufen damit ueber `supabase-js` und die Supabase HTTP-APIs/PostgREST. Das Connection-Pooling zur Postgres-Datenbank wird serverseitig von Supabase verwaltet. Next.js Serverless Functions halten keine eigenen direkten Postgres-Sockets offen.

Wichtig fuer spaetere Skalierung: keinen direkten Node-Postgres-Client (`pg`, Prisma mit Direkt-URL, Drizzle Direkt-URL) in Server Actions oder API-Routes einfuehren, ohne bewusst Supavisor/Connection-Pooler und Limits zu planen.

## Schwellenwerte fuer Skalierung

Diese Werte sind interne Betriebsrichtwerte fuer BauPro, keine harten Supabase-Vertragslimits:

| Stufe | Grobe Last | Massnahme |
| --- | --- | --- |
| Normalbetrieb | bis ca. 25 aktive Firmen gleichzeitig oder unter 100 Requests/Minute | Aktuelles PostgREST-Setup reicht normalerweise aus. Dashboard- und RPC-Buendelung beibehalten. |
| Wachstumsphase | ca. 25-100 aktive Firmen gleichzeitig oder 100-500 Requests/Minute | Supabase Dashboard woechentlich pruefen, langsame Queries optimieren, haeufige Listen paginieren, RPCs fuer Sammelabfragen bevorzugen. |
| Skalierungsphase | ab ca. 100 aktiven Firmen gleichzeitig oder wiederholt mehr als 500 Requests/Minute | Supabase Compute-Add-on, Datenbankgroesse, PostgREST/API-Limits und Connection-Pooler-Konfiguration im Supabase Dashboard aktiv planen. |
| Kritische Phase | Connection-Spitzen, Timeouts oder Fehler wie `remaining connection slots are reserved` | Sofort Eskalationsplan unten ausfuehren, Traffic drosseln, Hintergrundjobs reduzieren und Supabase Compute/Pooling hochstufen. |

Faustregel: Sobald p95-Latenzen der Datenbankabfragen dauerhaft steigen oder Connection-Pooler-Auslastung regelmaessig in die Naehe des Limits kommt, zuerst Query-Anzahl und Query-Form verbessern, dann Compute/Pooler erweitern.

## Monitoring-Empfehlung

Im Supabase Dashboard regelmaessig pruefen:

- `Database -> Connection Pooler`: aktive Connections, wartende Connections, Pool-Auslastung, Pool-Fehler.
- `Database -> Reports`: CPU, RAM, Disk I/O, Query-Latenzen, langsame Queries.
- `API/PostgREST`: Request-Volumen, Fehlerquoten, p95/p99-Latenzen.
- `Auth`: Login- und Token-Fehler, falls viele Mitarbeiter morgens gleichzeitig starten.
- `Edge Logs` oder eigenes Monitoring: API-Route `/api/health/db` auf Latenz und Fehler beobachten.

Empfohlene Alarme:

- DB-Health-Latenz ueber 1000 ms fuer mehr als 5 Minuten.
- Wiederholte 5xx-Fehler auf App- oder Supabase-API-Ebene.
- Connection-Pooler nahe Limit oder wartende Connections.
- Stark steigende Query-Zahl pro Dashboard-Aufruf.

## Eskalationsplan bei `remaining connection slots are reserved`

1. Fehler bestaetigen: Supabase Logs und externes Monitoring pruefen, ob es ein einzelner Ausreisser oder ein breiter Production-Ausfall ist.
2. Traffic beruhigen: nicht kritische Jobs, Preisabfragen, KI-Hintergrundaktionen und Prefetching temporaer deaktivieren oder drosseln.
3. App pruefen: aktuelle Deployments, neue Schleifen, fehlendes Caching und auffaellige Endpunkte identifizieren.
4. Query-Druck senken: betroffene Seiten auf RPCs, Pagination, `limit()`, gezielte Selects und Cache-Tags reduzieren.
5. Supabase Dashboard: Compute-Add-on, Pooler-Konfiguration und Datenbank-Metriken pruefen und bei Bedarf hochstufen.
6. Service-Role-Nutzung pruefen: Admin-/Webhook-Clients muessen sparsam bleiben und duerfen keine breiten Tabellen-Scans ausloesen.
7. Nach Stabilisierung: Incident dokumentieren, Schwellenwerte anpassen und einen Regressionstest oder Monitoring-Check fuer den Ausloeser ergaenzen.

## Health-Check

Der oeffentliche Endpoint `/api/health/db` fuehrt eine kleine, nicht sensible Leseabfrage gegen `plans` aus und gibt nur Status und Latenz zurueck:

```json
{ "status": "ok", "latencyMs": 42 }
```

`status` wird `degraded`, wenn die Latenz ueber 1000 ms liegt oder die Query fehlschlaegt. Der Endpoint ist fuer UptimeRobot, Better Stack oder vergleichbares externes Monitoring gedacht.
