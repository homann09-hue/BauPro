# DSGVO Readiness Checklist

Pruefpflichtige Arbeitsliste, keine Rechtsberatung.

## Technisch erledigt

- [x] Firmenmandanten-Trennung ueber `company_id` und RLS vorbereitet.
- [x] Rollenmodell mit getrenntem Systemadmin, Chef, Vorarbeiter, Mitarbeiter und Kunde.
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
- [ ] OpenAI-Verarbeitung, Rechtsgrundlage, EU-/Drittlandtransfer, AVV/DPA und Subprozessoren final dokumentieren.
- [ ] KI-Funktionen nur nach bewusstem Opt-in nutzen und Kunden-/Adressdaten vor OpenAI-Uebertragung auf Datenminimierung pruefen.
- [ ] Arbeitsrechtliche Hinweise fuer Zeiterfassung, Baustellenberichte und moegliche Standortdaten klaeren.
- [ ] Loesch-/Archivfristen final festlegen.
- [ ] Backup, Incident Response und Berechtigungskonzept freigeben.
