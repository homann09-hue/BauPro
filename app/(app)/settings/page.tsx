import Link from "next/link";
import { Calculator, ShieldCheck, SlidersHorizontal, Sparkles, Users } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { updateCalculationSettingsAction } from "@/lib/actions/ai-job-actions";
import { updateAiSettingsAction } from "@/lib/actions/ai-actions";
import { updateCompanyProfileAction } from "@/lib/actions/auth-actions";
import { updatePricingSettingsAction } from "@/lib/actions/material-calculation-actions";
import { loadCalculationSettings } from "@/lib/ai/job-drafts";
import { aiRuntimeState, loadAiSettings } from "@/lib/ai/permissions";
import { requirePermission } from "@/lib/auth";
import { companyPricingSettingsSelect } from "@/lib/data/selects";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { CompanyPricingSettings } from "@/types/app";

export default async function SettingsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requirePermission("settings.edit", "/dashboard");
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);

  const [companyResult, { data: pricing }, aiSettings, calculationSettings] = await Promise.all([
    supabase.from("companies").select("id, name, session_timeout_minutes").eq("id", context.companyId).single(),
    supabase
      .from("company_pricing_settings")
      .select(companyPricingSettingsSelect)
      .eq("company_id", context.companyId)
      .maybeSingle(),
    loadAiSettings(supabase, context.companyId),
    loadCalculationSettings(supabase, context.companyId)
  ]);

  let company = companyResult.data as { id: string; name: string; session_timeout_minutes?: number | null } | null;
  const companyMissingSessionSetting = companyResult.error && isMissingSchemaError(companyResult.error);
  if (!company && companyMissingSessionSetting) {
    const fallback = await supabase.from("companies").select("id, name").eq("id", context.companyId).single();
    company = fallback.data ? { ...fallback.data, session_timeout_minutes: context.company.session_timeout_minutes } : null;
  }

  const settings = (pricing as CompanyPricingSettings | null) ?? {
    company_id: context.companyId,
    waste_percent: 20,
    default_markup_percent: 35,
    auto_calculate_sales_price: true
  };
  const aiRuntime = aiRuntimeState(context, aiSettings);
  const sessionTimeoutMinutes = Number(company?.session_timeout_minutes ?? context.company.session_timeout_minutes ?? 30);

  return (
    <>
      <PageHeader
        title="Einstellungen"
        description="Betriebsdaten, Kalkulation und Rollen zentral pflegen. Preis- und Einkaufseinstellungen bleiben Chef/Admin vorbehalten."
      />
      <MessageBox error={error} success={success} />

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <section className="surface p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-mint text-moss">
              <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="meta-label">Betrieb</p>
              <h2 className="section-title">Firmenprofil</h2>
            </div>
          </div>
          <form action={updateCompanyProfileAction} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_auto]">
            <input type="hidden" name="return_to" value="/settings" />
            <label>
              <span className="field-label">Firmenname</span>
              <input className="field-input" name="name" defaultValue={company?.name ?? context.companyName} required />
            </label>
            <label>
              <span className="field-label">Automatische Abmeldung nach</span>
              <input
                className="field-input"
                defaultValue={Number.isFinite(sessionTimeoutMinutes) ? sessionTimeoutMinutes : 30}
                inputMode="numeric"
                max={1440}
                min={0}
                name="session_timeout_minutes"
                step={1}
                type="number"
              />
              <span className="field-help">Minuten, 0 = nie. Empfohlen für geteilte Tablets: 30 Minuten.</span>
            </label>
            <button className="btn-primary self-end" type="submit">
              Speichern
            </button>
          </form>
          {companyMissingSessionSetting ? (
            <p className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm font-semibold text-amber-900">
              Datenbank-Update fehlt: Bitte `supabase/migrations/20260623_session_timeout_setting.sql` ausführen.
            </p>
          ) : null}
          <p className="mt-3 rounded-md border border-line bg-fog p-3 text-sm text-slate-600">
            Weitere Firmenfelder wie Logo, Briefkopf, Steuernummer und Zahlungsbedingungen sind für die Angebots- und Rechnungsstrecke
            vorbereitet.
          </p>
        </section>

        <section className="surface p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-steel/10 text-steel">
              <Calculator className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="meta-label">Kalkulation</p>
              <h2 className="section-title">Material und Preise</h2>
            </div>
          </div>
          <form action={updatePricingSettingsAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="return_to" value="/settings" />
            <label>
              <span className="field-label">Standard-Verschnitt %</span>
              <input className="field-input" name="waste_percent" inputMode="decimal" defaultValue={settings.waste_percent} />
            </label>
            <label>
              <span className="field-label">Standard-Aufschlag %</span>
              <input
                className="field-input"
                name="default_markup_percent"
                inputMode="decimal"
                defaultValue={settings.default_markup_percent}
              />
            </label>
            <label className="flex items-center gap-3 rounded-md border border-line bg-fog px-3 py-2 text-sm font-semibold text-ink sm:col-span-2">
              <input
                type="checkbox"
                name="auto_calculate_sales_price"
                defaultChecked={settings.auto_calculate_sales_price}
                className="h-4 w-4 rounded border-line text-moss"
              />
              VK automatisch aus EK und Aufschlag berechnen
            </label>
            <button className="btn-primary sm:col-span-2" type="submit">
              Kalkulation speichern
            </button>
          </form>
        </section>
      </div>

      <section className="surface mt-5 p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-mint text-moss">
            <Calculator className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="meta-label">Auftragskalkulation</p>
            <h2 className="section-title">Standardwerte für Arbeit und Preise</h2>
          </div>
        </div>
        <form action={updateCalculationSettingsAction} className="grid gap-3 md:grid-cols-4">
          <input type="hidden" name="return_to" value="/settings" />
          <label>
            <span className="field-label">Verschnitt %</span>
            <input
              className="field-input"
              name="default_waste_percent"
              inputMode="decimal"
              defaultValue={calculationSettings.default_waste_percent}
            />
          </label>
          <label>
            <span className="field-label">MwSt. %</span>
            <input className="field-input" name="default_vat_rate" inputMode="decimal" defaultValue={calculationSettings.default_vat_rate} />
          </label>
          <label>
            <span className="field-label">Stundenlohn VK netto</span>
            <input
              className="field-input"
              name="default_labor_rate_net"
              inputMode="decimal"
              defaultValue={calculationSettings.default_labor_rate_net}
            />
          </label>
          <label>
            <span className="field-label">Interner Lohnsatz</span>
            <input
              className="field-input"
              name="default_internal_hourly_cost"
              inputMode="decimal"
              defaultValue={calculationSettings.default_internal_hourly_cost}
            />
          </label>
          <label>
            <span className="field-label">Gewinnaufschlag %</span>
            <input
              className="field-input"
              name="default_profit_markup_percent"
              inputMode="decimal"
              defaultValue={calculationSettings.default_profit_markup_percent}
            />
          </label>
          <label>
            <span className="field-label">Gemeinkosten %</span>
            <input
              className="field-input"
              name="default_overhead_percent"
              inputMode="decimal"
              defaultValue={calculationSettings.default_overhead_percent}
            />
          </label>
          <label>
            <span className="field-label">Kilometerpreis netto</span>
            <input
              className="field-input"
              name="default_travel_rate_per_km"
              inputMode="decimal"
              defaultValue={calculationSettings.default_travel_rate_per_km}
            />
          </label>
          <label>
            <span className="field-label">Fahrtpauschale netto</span>
            <input
              className="field-input"
              name="default_travel_flat_rate"
              inputMode="decimal"
              defaultValue={calculationSettings.default_travel_flat_rate}
            />
          </label>
          <div className="grid gap-2 md:col-span-4 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                name="allow_ai_job_creation"
                defaultChecked={calculationSettings.allow_ai_job_creation}
                className="h-4 w-4 rounded border-line text-moss"
              />
              KI darf Auftragsentwürfe vorbereiten
            </label>
            <label className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                name="require_admin_confirmation"
                defaultChecked={calculationSettings.require_admin_confirmation}
                className="h-4 w-4 rounded border-line text-moss"
              />
              Chef/Admin-Bestätigung immer erforderlich
            </label>
          </div>
          <button className="btn-primary md:col-span-4" type="submit">
            Kalkulationswerte speichern
          </button>
        </form>
      </section>

      <section className="surface mt-5 p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-ink text-white">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="meta-label">KI</p>
            <h2 className="section-title">OpenAI-Assistent</h2>
          </div>
        </div>

        {!aiRuntime.configured ? (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            KI-Funktionen sind noch nicht konfiguriert. Setze `OPENAI_API_KEY` nur serverseitig in `.env.local` oder in Vercel.
          </p>
        ) : null}

        <form action={updateAiSettingsAction} className="grid gap-3 md:grid-cols-2">
          <label>
            <span className="field-label">Standard-Modell</span>
            <input className="field-input" name="default_model" defaultValue={aiRuntime.model} />
            <span className="field-help">Die App nutzt serverseitig `OPENAI_MODEL`; dieses Feld dokumentiert die Firmenvorgabe.</span>
          </label>
          <div className="rounded-md border border-line bg-fog p-3 text-sm text-slate-700">
            <p className="font-black text-ink">Sicherheitsregel</p>
            <p className="mt-1">Mitarbeiter-Kontext wird ohne EK, VK, Marge, Aufschlag und Preisvergleich geladen.</p>
          </div>

          <label className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">
            <input type="checkbox" name="enabled" defaultChecked={aiSettings.enabled} className="h-4 w-4 rounded border-line text-moss" />
            KI-Funktionen aktivieren
          </label>
          <label className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              name="allow_employee_ai"
              defaultChecked={aiSettings.allow_employee_ai}
              className="h-4 w-4 rounded border-line text-moss"
            />
            Mitarbeiter duerfen KI nutzen
          </label>
          <label className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              name="allow_ai_daily_reports"
              defaultChecked={aiSettings.allow_ai_daily_reports}
              className="h-4 w-4 rounded border-line text-moss"
            />
            Tagesbericht-Entwürfe erlauben
          </label>
          <label className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              name="allow_ai_time_tracking"
              defaultChecked={aiSettings.allow_ai_time_tracking}
              className="h-4 w-4 rounded border-line text-moss"
            />
            Zeiterfassung per KI auswerten
          </label>
          <label className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink md:col-span-2">
            <input
              type="checkbox"
              name="allow_ai_material_matching"
              defaultChecked={aiSettings.allow_ai_material_matching}
              className="h-4 w-4 rounded border-line text-moss"
            />
            Materialnamen normalisieren und Katalogtreffer vorschlagen
          </label>
          <button className="btn-primary md:col-span-2" type="submit">
            KI-Einstellungen speichern
          </button>
        </form>
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Link href="/team" className="interactive-surface p-4">
          <Users className="mb-3 h-5 w-5 text-moss" aria-hidden="true" />
          <h3 className="font-black text-ink">Mitarbeiter und Rollen</h3>
          <p className="mt-2 text-sm text-slate-600">Zugänge, Rollen und Aktivstatus verwalten.</p>
        </Link>
        <Link href="/settings/security" className="interactive-surface p-4">
          <ShieldCheck className="mb-3 h-5 w-5 text-moss" aria-hidden="true" />
          <h3 className="font-black text-ink">Sicherheit und 2FA</h3>
          <p className="mt-2 text-sm text-slate-600">Zwei-Faktor-Authentifizierung für Admin- und Chef-Accounts einrichten.</p>
        </Link>
        <Link href="/materials/catalog" className="interactive-surface p-4">
          <Calculator className="mb-3 h-5 w-5 text-moss" aria-hidden="true" />
          <h3 className="font-black text-ink">Materialkatalog</h3>
          <p className="mt-2 text-sm text-slate-600">Dachdeckerartikel suchen und ins Lager übernehmen.</p>
        </Link>
        <div className="surface p-4">
          <ShieldCheck className="mb-3 h-5 w-5 text-moss" aria-hidden="true" />
          <h3 className="font-black text-ink">Rechte geprüft</h3>
          <p className="mt-2 text-sm text-slate-600">EK, VK, Marge und Preisquellen sind nur in Chef/Admin-Flächen sichtbar.</p>
        </div>
      </div>
    </>
  );
}
