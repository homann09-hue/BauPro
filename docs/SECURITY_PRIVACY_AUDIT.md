# Datenschutz- und Sicherheitsaudit

Stand: 2026-06-20

Dieser Bericht dokumentiert technische Datenschutz- und Sicherheitsmassnahmen in BauPro. Er ersetzt keine anwaltliche DSGVO-Pruefung, macht aber die wichtigsten Schutzmechanismen nachvollziehbar.

## Gepruefte Bereiche

- Supabase Row Level Security und Mandantentrennung
- Rollenmodell fuer Admin, Chef, Vorarbeiter, Mitarbeiter und Kunde
- Preisfelder wie EK, VK, Marge, Aufschlag und Online-Angebote
- Kundenportal-Datenfreigabe
- Upload-Validierung und private Storage-Pfade
- Datenschutz-Center, Auskunftsexporte und Betroffenenanfragen
- Audit-Logs fuer Rollen-, Preis-, Supplier-Key-, Export- und Lageraktionen
- Soft-Delete/Archivierung fuer geschaeftskritische Daten

## Behobene Schwachstellen

| Bereich | Risiko | Massnahme |
| --- | --- | --- |
| Firmenexport | Preisfelder konnten im allgemeinen Firmenexport neben operativen Daten liegen. | Operative Exportdaten sind jetzt preisbereinigt; EK/VK/Margen/Online-Preise liegen in `restricted_financial_data`. |
| RLS fuer neue Mandantentabellen | Neue Tabellen mit `company_id` koennten ohne FORCE RLS bleiben. | Migration `20260708_privacy_security_hardening.sql` setzt RLS und FORCE RLS fuer alle Public-Tabellen mit `company_id`. |
| Datenschutz-Hinweise | Preis- und Loeschkonzept waren fuer Nutzer zu wenig sichtbar. | Datenschutz-Center erklaert preisbereinigte Eigenauskunft, eingeschraenkten Firmenexport und geprueften Loeschprozess. |
| Schema-Drift | Delta-Migration und Vollschema koennten auseinanderlaufen. | `schema.sql`, README, Schema-Check und RLS-Tests pruefen den finalen Datenschutz-Haertungsblock. |

## Wichtige bestehende Schutzmechanismen

- `company_id`-Tabellen werden per RLS auf die aktuelle Firma eingeschraenkt.
- `companies` ist ebenfalls per RLS/FORCE RLS geschuetzt.
- Mitarbeiter und Vorarbeiter nutzen preisbereinigte Datenquellen, z. B. `inventory_items_public`.
- Kundenportal-Loader liefern nur explizit freigegebene Baustellendaten, Fotos, Dokumente und Berichte.
- Uploads pruefen MIME-Typ, Dateigroesse und Magic Bytes; Storage-Pfade erzwingen Firma und Kontext.
- Kritische Aktionen schreiben Metadaten in `company_audit_log`, ohne Exportinhalte zu protokollieren.
- Geschaeftskritische Tabellen werden archiviert statt hart geloescht, soweit fachlich sinnvoll.

## Offene organisatorische Punkte

- Auftragsverarbeitungsvertraege, Datenschutzerklaerung und Loeschfristen muessen fuer den echten Betreiber final juristisch geprueft werden.
- Produktivbetrieb braucht definierte Verantwortlichkeiten fuer Betroffenenanfragen, Datenexporte, Loeschentscheidungen und Backup-Retention.
- API-Schluessel fuer OpenAI, Stripe, Supabase Service Role und Lieferanten duerfen nur serverseitig in der Hosting-Umgebung gepflegt werden.
- Regelmaessige RLS-/Security-Reviews sollten Teil jedes Releases bleiben, besonders nach neuen Tabellen, Views oder API-Routen.
