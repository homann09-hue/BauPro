# BauPro Performance-Audit

Stand: 2026-06-20

## Ziel

BauPro soll sich auf dem iPhone schnell und ruhig anfühlen: wichtige Daten werden im Hintergrund vorbereitet, große Listen laden nur relevante Ausschnitte, Bilder blockieren nicht den ersten Seitenaufbau und neue Module bekommen passende Datenbank-Indizes.

## Gefundene Hotspots

| Bereich | Vorher | Risiko |
| --- | --- | --- |
| App-Start | Prefetch nur für wenige Routen/Scopes | Plantafel, Team, Aufgaben und Mitbringlisten starteten kalt |
| Mobile Datenverbindung | Prefetch lief unabhängig von `saveData`/2G | unnötige Netzlast auf der Baustelle |
| Lieferscheine | Liste lud bis zu 2.000 Positionszeilen firmenseitig | unnötige DB-/JSON-Last bei vielen Lieferscheinen |
| Materialkatalog | Alle Material-Aliasse wurden geladen | wächst mit Katalog statt mit sichtbarer Trefferliste |
| Plantafel | Ressourcen, Warnungen und Planungen ohne harte Limits | große Firmen können sehr schwere Monatsansichten erzeugen |
| Neue Module | Teilweise fehlende Folge-Indizes | langsamere Filter bei Checklisten, Mängeln, Lieferbelegen, Portal, Materialbewegungen |
| Bilder | Galerie-/Signaturbilder ohne lazy decoding | schlechtere gefühlte Performance auf iPhone |
| Loading States | Plantafel, Team, Mitbringlisten, Lieferscheine ohne eigene Skeletons | leere Ladezustände wirken wie Hänger |

## Umgesetzte Verbesserungen

- Predictive Prefetch erweitert für Dashboard, Baustellen, Aufgaben, Plantafel, Team, Material, Mitbringlisten, Zeiten und Wetter.
- Prefetch-Payloads werden im `sessionStorage` klein gecacht und bei Data Saver oder 2G reduziert.
- Neue schlanke Warmup-Scopes im Endpoint `/api/prefetch/route-data`: `tasks`, `planning`, `team`.
- Lieferscheinliste lädt Positionszählungen nur für die aktuell angezeigten 30 Lieferscheine.
- Materialkatalog lädt Aliasse nur für die aktuell sichtbaren Katalogartikel.
- Plantafel-Queries haben Zeitraum-/Listenlimits für Mitarbeiter, Fahrzeuge, Ressourcen, Planungen, Baustellen und Materialwarnungen.
- Skeleton-Loader ergänzt für `/plantafel`, `/bring-lists`, `/materials/delivery-notes` und `/team`.
- Supabase-Follow-up-Migration `20260707_performance_followup_indexes.sql` mit Indizes für neuere SaaS-Module.
- `schema.sql` auf denselben Index-Stand gebracht.
- Bilder in Galerien, Signaturen, Lieferscheinen, Checklisten, Mängeln, Wetterradar und Kundenportal laden lazy/asynchron.
- Unit-Tests sichern Prefetch-Scopes, Skeletons, Query-Reduktionen und Index-Migrationen ab.

## Grobe Vorher/Nachher-Messung

| Messpunkt | Vorher | Nachher |
| --- | ---: | ---: |
| Manager-Prefetch-Scopes | 5 | 9, aber datenverbindungsabhängig gedrosselt |
| Mitarbeiter-Prefetch-Scopes | 3 | 5, weiterhin ohne Preis-/Teamdaten |
| Lieferschein-Positionsread | bis 2.000 Zeilen pro Firmenliste | maximal Positionen der 30 sichtbaren Lieferscheine |
| Material-Alias-Read | gesamter Alias-Katalog | nur Aliasse der sichtbaren 80/300 Artikel |
| Plantafel Monats-Assignments | unbegrenzt im Zeitraum | maximal 900 |
| Neue Skeleton-Routen | 0 für diese vier Bereiche | 4 |
| Neue Follow-up-Indizes | 0 | 38 |

## Nächste Messpunkte

- In Production echte Web-Vitals erfassen: LCP, INP, TTFB, Route-Wechselzeit.
- Supabase `pg_stat_statements` für langsamste Queries auswerten.
- Bei sehr großen Firmen serverseitige RPCs für Plantafel und Materialkontrollzentrum ergänzen.
- Für sehr große Materiallisten serverseitige Pagination mit URL-Parametern statt langer Ergebnislimits nutzen.
