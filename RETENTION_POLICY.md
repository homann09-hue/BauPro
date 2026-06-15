# Retention Policy Draft

Pruefpflichtiger Entwurf, keine Rechtsberatung.

## Grundsaetze

- Daten nur solange speichern, wie sie fuer Betrieb, Vertrag, Nachweis, Gewaehrleistung, Steuer oder Arbeitsrecht erforderlich sind.
- Mitarbeiterzugang deaktivieren statt harte Loeschung, wenn Nachweispflichten bestehen.
- Loeschung/Anonymisierung im Datenschutz-Center als Anfrageprozess vorbereiten.
- Fotos und Diktate besonders streng zweckbezogen pruefen.

## Technische Vorbereitung

- `active=false` fuer Mitarbeiterprofile.
- `archived_at` fuer zentrale Tabellen als Soft-Delete-Grundlage.
- `privacy_requests` fuer Betroffenenanfragen.
- JSON-Export fuer eigene Daten und Firmenexport.
- Audit-Logs fuer Zeiten, KI-Nutzung und Exporte vorbereitet.

## Offene Fristen

Konkrete Fristen muessen final festgelegt werden fuer:

- Arbeitszeitdaten.
- Baustellenberichte und Fotos.
- Kunden-/Auftragsdaten.
- Rechnungs- und Angebotsdaten.
- KI-Diktate und Aktionsvorschlaege.
- Technische Logs und Sicherheitslogs.
