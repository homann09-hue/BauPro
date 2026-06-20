# Encoding-Audit

Stand: 2026-06-20

## Ergebnis

BauPro verwendet UTF-8 in Quelltexten, JSON/API-Antworten, CSV-Exports und SQL-Dateien. Der Audit hat keine klassischen Mojibake-Zeichen wie `\u00C3`, `\u00C2`, `\u00E2\u20AC` oder das Unicode-Replacement-Zeichen gefunden.

Gefundene und behobene Probleme:

| Bereich | Problem | Fix |
| --- | --- | --- |
| PDF-Exports | Deutsche Umlaute wurden in `ae/oe/ue/ss` umgeschrieben und Nicht-ASCII-Zeichen entfernt. | PDF-Text bleibt in NFC erhalten und wird PDF-sicher per WinAnsi/Oktal-Escaping ausgegeben. |
| Download-Dateinamen | `Content-Disposition` nutzte nur rohen `filename`. Umlaute konnten je nach Browser/Proxy verloren gehen. | Header enthält jetzt ASCII-Fallback plus `filename*=UTF-8''...`. |
| CSV-Exports | Stundenzettel hatten BOM, DATEV-CSV noch nicht. | DATEV-CSV schreibt nun ebenfalls UTF-8 mit BOM. |
| Suche | `Müller` und `Mueller` wurden nicht zuverlässig gegenseitig gefunden. | Gemeinsame deutsche Suchnormalisierung für `ä/ae`, `ö/oe`, `ü/ue`, `ß/ss`. |
| UI-Texte | Sichtbare Texte enthielten alte ASCII-Schreibweisen wie `fuer`, `Taetigkeit`, `Stueck`. | App- und Komponenten-Texte auf echte deutsche Umlaute korrigiert. |

## Technische Regeln

- Alle Textdateien werden als UTF-8 gelesen und geschrieben.
- CSV-Exports enthalten UTF-8-BOM, damit Excel deutsche Umlaute korrekt erkennt.
- JSON/API-Antworten bleiben UTF-8 über `Buffer`/`Response`-Standardverhalten und explizite `charset=utf-8` für Textdownloads.
- PDF-Generatoren nutzen Helvetica mit `/WinAnsiEncoding`; deutsche Umlaute werden im PDF-Content-Stream escaped statt ersetzt.
- Export-Dateinamen behalten UTF-8-Umlaute, liefern aber zusätzlich einen ASCII-Fallback für ältere Clients.
- Supabase/Postgres läuft bei Supabase standardmäßig mit UTF8; die App verändert Umlaute vor dem Speichern nicht.

## Tests

Automatisiert abgesichert in `tests/unit/encoding.test.ts`:

- Quelltextdateien sind UTF-8-lesbar und enthalten kein Mojibake.
- App- und Komponenten-Texte enthalten keine typischen alten ASCII-Umlautwörter.
- JSON/API-artige Serialisierung erhält `Müller`, `Dachdeckerstraße`, `Fußpfette`, `Überstunden`, `Größe`, `Maßangaben`.
- PDF-Text erhält Umlaute und escaped sie korrekt.
- Suche findet `Müller` mit `Mueller`, `Fußpfette` mit `Fusspfette` und `Dachdeckerstraße` mit `Dachdeckerstrasse`.
- UTF-8-Dateinamen bleiben erhalten.

Zusätzlich angepasst:

- `tests/unit/time-report-export.test.ts`
- `tests/unit/download-security.test.ts`

## Offene Hinweise

- Bestehende Daten in Supabase müssen nicht migriert werden, solange sie korrekt als UTF-8 gespeichert wurden.
- Falls alte CSV-Importe aus Windows-1252/ISO-8859-1 stammen, sollten sie vor dem Import als UTF-8 gespeichert werden. Die App selbst erwartet UTF-8-Eingaben.
- Externe PDF-Viewer unterscheiden sich bei eingebauten Fonts. Die erzeugten PDF-Streams speichern deutsche Zeichen jetzt korrekt für WinAnsi-kompatible Standardfonts.
