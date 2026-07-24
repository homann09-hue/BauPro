# BauPro Incident Runbook

Dieses Runbook ist fuer Produktionsvorfaelle gedacht. Keine Secrets in Tickets, Logs oder Screenshots kopieren.

## Sofort-Triage

1. Vercel Deployment, Runtime Logs und aktuelle Release-Version pruefen.
2. Supabase Status, Auth-Logs, Database-Health und Connection-Pooler-Metriken pruefen.
3. Redis/Upstash Status pruefen, weil Rate Limits in Production fail-closed arbeiten duerfen.
4. Nutzerwirkung einschaetzen: Login, Speichern, Uploads, Kundenportal, KI, Stripe.
5. Incident im Team dokumentieren: Startzeit, Scope, betroffene Kunden, Workaround.

## Login/Auth Stoerung

- Supabase Auth Status und Redirect URLs pruefen.
- `NEXT_PUBLIC_SUPABASE_URL`, Publishable/Anon Key und Site URL in Vercel kontrollieren.
- Bei Middleware-/Proxy-Fehlern letzten Release rollbacken.
- Keine Service-Role-Keys im Browser suchen oder ausgeben.

## Datenbank/RLS Stoerung

- `npm run db:schema-check` lokal gegen den aktuellen Stand ausfuehren.
- Letzte Migration mit Supabase SQL History vergleichen.
- Bei Cross-Tenant-Verdacht sofort schreibende App-Routen deaktivieren oder Release rollbacken.
- Audit-Logs sichern, bevor Daten korrigiert werden.

## Rate-Limit/Redis Stoerung

- Upstash/Vercel KV Health und ENV Variablen pruefen.
- In Production darf ein fehlendes Redis nicht still durchlassen.
- Wenn legitime Nutzer blockiert werden: Limits, Schluesselbildung und IP-Header pruefen.

## Upload/Storage Stoerung

- Bucket-Policies, Signed-URL-Routen und Magic-Byte-Validierung pruefen.
- Grosse Dateien und falsche MIME-Typen muessen kontrolliert abgelehnt werden.
- Bei moeglichem Datenleck Signed URLs widerrufen und betroffene Dokumente neu ausstellen.

## KI-/Provider Stoerung

- OpenAI-Key und Provider-Status pruefen.
- KI-Funktionen duerfen bei Ausfall nicht Kernprozesse blockieren.
- DSGVO-Opt-in und Foto-Kontext in Logs nicht ausgeben.

## Stripe/Billing Stoerung

- Webhook-Signatur und Event-Idempotenz pruefen.
- Stripe Dashboard mit internen Subscription-Feldern abgleichen.
- Keine Zahlungsdaten in App-Logs schreiben.

## Rollback

1. Letztes gruenes Vercel Deployment auswaehlen.
2. Rollback ausloesen.
3. Supabase Migrationen nur nach Plan rueckgaengig machen; keine destruktiven Schnellfixes.
4. Nach Rollback `npm run check:fast`, `npm run check:security` und Smoke-Test ausfuehren.
