# Subprocessors

Pruefpflichtiger Entwurf, keine Rechtsberatung.

| Anbieter | Rolle | Daten | Status |
| --- | --- | --- | --- |
| Supabase | Auth, Postgres, Storage | Nutzer, Firmen, Baustellen, Zeiten, Fotos | erforderlich, AVV/Region pruefen |
| OpenAI | optionale KI-Verarbeitung | reduzierte Texteingaben und Kontextdaten | optional, serverseitig, final pruefen |
| Vercel/eigener Hoster | Hosting | technische Request-/Serverlogs | deploymentabhaengig |
| eBay Browse API | optionale Onlinepreise | Materialsuchbegriffe | nur Chef/Admin, optional |
| PriceAPI/DataForSEO/SearchApi | optionale Onlinepreise | Materialsuchbegriffe | optional, Anbieterbedingungen pruefen |
| CSV-Preislisten | Lieferantenpreise | Material-/Preislisten | nur erlaubte Feeds nutzen |

Keine Subprozessor-Liste ohne finale Anbieter-, Region- und Vertragspruefung produktiv verwenden.
