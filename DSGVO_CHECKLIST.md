# DSGVO Readiness Checklist

Pruefpflichtige Arbeitsliste, keine Rechtsberatung.

## Technisch erledigt

- [x] Firmenmandanten-Trennung ueber `company_id` und RLS vorbereitet.
- [x] Rollenmodell mit Chef/Admin, Vorarbeiter, Mitarbeiter.
- [x] Preisfelder fuer Mitarbeiter im Frontend und ueber Views getrennt.
- [x] Datenschutz-Center mit Exporten und Anfrageprozess.
- [x] Rechtliche Entwurfsseiten unter `/legal`.
- [x] Consent-Banner fuer notwendige/optionale Verarbeitung.
- [x] Private Storage-Policy fuer Report-Fotos.
- [x] Upload-Validierung fuer Report-Fotos.
- [x] KI nur serverseitig, ohne Frontend-Key.
- [x] Tests fuer Rollen, RLS-Schema, KI-Mocking, Uploads und Consent.

## Vor Produktion zwingend pruefen

- [ ] Anwaltliche Pruefung von Impressum, AGB, Datenschutzerklaerung, AVV.
- [ ] Datenschutzbeauftragter prueft Datenlandkarte und TOMs.
- [ ] Supabase Region, AVV/DPA und Subprozessoren final dokumentieren.
- [ ] OpenAI-Verarbeitung, Rechtsgrundlage und Datenminimierung final bewerten.
- [ ] Arbeitsrechtliche Hinweise fuer Zeiterfassung, Baustellenberichte und moegliche Standortdaten klaeren.
- [ ] Loesch-/Archivfristen final festlegen.
- [ ] Backup, Incident Response und Berechtigungskonzept freigeben.
