# BauPro Architektur-Entscheidungen

## Rollenmodell

BauPro trennt Systemverwaltung und operative Betriebsleitung bewusst:

- `admin` ist der firmenübergreifende Systemadministrator. Diese Rolle verwaltet Benutzer, Rechte, Abrechnung, Integrationen, API-/Sicherheits- und Datenschutzoptionen.
- `chef` ist die operative Betriebsleitung einer Firma. Diese Rolle verwaltet Baustellen, Kunden, Aufträge, Material, Lager, Zeiten, Berichte, Kalkulation, Angebote und Rechnungen innerhalb der eigenen Firma.
- `vorarbeiter` und `mitarbeiter` erhalten operative Rechte über `employee_permissions`, sehen aber keine EK/VK-Preise, Margen, Abrechnung oder Systemverwaltung.
- `kunde` sieht nur explizit freigegebene Kundenportal-Daten.

Im Code ist `requirePlatformAdmin()` der bevorzugte Guard für Systembereiche. Operative Bereiche nutzen `requirePermission(...)`, `requireManager()` oder `requireAppContext()` mit zusätzlicher Firmen- und Ressourcenprüfung.

## Service-Role-Boundary

`SUPABASE_SERVICE_ROLE_KEY` umgeht Row Level Security. Direkte Nutzung ist deshalb nur in `lib/supabase/server.ts` und im Wrapper `lib/supabase/admin.ts` erlaubt.

Alle produktiven Service-Role-Zugriffe müssen über `createScopedSupabaseAdminClient({ caller, reason })` laufen. Das macht Reviews einfacher und verhindert, dass neue RLS-Bypässe nebenbei entstehen.

Erlaubte Fälle:

- Stripe-Webhooks ohne eingeloggten Nutzer
- Kundenportal-Token und kurzlebige Signed URLs
- Demo-Seeding mit isolierten Beispieldaten
- Auth-Admin-Flows für Systemadministratoren
- Audit-Logs, die serverseitig geschrieben werden müssen

Normale App-Daten laufen über `createSupabaseServerClient()` und RLS.

## Atomare Auftragsanlage

Neue Aufträge werden über die Datenbankfunktion `create_order_with_jobsite(...)` erstellt. Diese Funktion:

- prüft `auth.uid()`, `company_id`, Kunden-Zugehörigkeit und Mitarbeiter-Zuordnungen,
- erzeugt die Auftragsnummer mit `generate_order_number(...)`,
- schützt die Nummernvergabe per `pg_advisory_xact_lock(...)` gegen parallele Klicks,
- erstellt Baustelle und Auftrag in einer Transaktion.

Kalkulationen, Maße und Materialanforderungen hängen danach am bereits erzeugten Auftrag. Wenn diese optionalen Schritte scheitern, sieht der Nutzer eine klare Warnung, aber es entstehen keine halben Baustellen-Aufträge mehr.

## RLS-Strategie

Tenant-Daten bleiben über `company_id = current_company_id()` begrenzt. Preis- und Systemdaten haben zusätzliche Manager-/Admin-Policies. Wegen der hohen Policy-Anzahl gilt:

- Keine neue Fallback-Policy ohne Matrix-Dokumentation.
- Neue Tabellen brauchen `FORCE ROW LEVEL SECURITY`.
- Preisfelder dürfen für operative Rollen nur über preisbereinigte Views oder serverseitig bereinigte Props sichtbar werden.
