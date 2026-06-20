| Datei | Zeile | Tabelle | Hat archived_at-Spalte? | Risiko (hoch/mittel/niedrig) | Empfehlung |
| --- | ---: | --- | --- | --- | --- |
| `lib/actions/help-actions.ts` | 71 | `user_help_state` | Nein | niedrig | Technischer UI-Hilfestatus ohne Geschaeftswert. Hard-Delete bleibt zulaessig und ist dokumentiert. |
| `lib/actions/report-actions.ts` | 254 | `report_photos` | Neu hinzugefuegt | hoch | Direkten Delete und Storage-Remove durch `archive_report_photo` ersetzt. Fotos werden archiviert und in Standardansichten ausgeblendet. |
| `lib/actions/vehicle-actions.ts` | 146 | `vehicle_materials` | Neu hinzugefuegt | mittel | Fahrzeuglager-Zuordnung wird archiviert; erneutes Hinzufuegen reaktiviert den Datensatz per `archived_at = null`. |
| `lib/actions/order-actions.ts` | 431 | `job_material_requirements` | Neu hinzugefuegt | mittel | Alte Materialbedarfe werden vor Neuberechnung archiviert statt geloescht; aktive Listen filtern `archived_at is null`. |
| `lib/actions/order-actions.ts` | 490 | `job_material_requirements` | Neu hinzugefuegt | mittel | Gleiche Haertung fuer manuelle Neuberechnung; Preis-/Mengenhistorie bleibt nachvollziehbar. |
| `supabase/migrations/*` | - | `DELETE FROM` | Nicht zutreffend | niedrig | Kein `DELETE FROM` in bestehenden Migrationen gefunden. DELETE-Policies fuer geschuetzte Tabellen werden mit `20260620_soft_delete_columns.sql` entfernt. |
