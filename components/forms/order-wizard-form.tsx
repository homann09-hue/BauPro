"use client";

import { useMemo, useState } from "react";
import { Calculator, ClipboardCheck, FileText, PencilLine, UserRound } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { VoiceInputField } from "@/components/voice/VoiceInputField";
import { VoiceTextarea } from "@/components/voice/VoiceTextarea";
import { createOrderAction } from "@/lib/actions/order-actions";
import { calculateOrderCostEstimate } from "@/lib/order-cost-estimate";
import {
  calculateRoofingMaterialEstimate,
  roofingTileTypes,
  type RoofingMaterialPriceRow,
  type RoofingTileType
} from "@/lib/roofing-material-estimate";
import {
  customerDisplayName,
  customerTypeLabels,
  orderPriorityLabels,
  orderStatusLabels,
  orderTypeLabels
} from "@/lib/order-labels";
import type { Customer, CustomerType, OrderPriority, OrderStatus, OrderType, Profile } from "@/types/app";

type CustomerOption = Pick<
  Customer,
  "id" | "company" | "first_name" | "last_name" | "contact_person" | "jobsite_address" | "billing_address"
>;

type OrderWizardFormProps = {
  customers: CustomerOption[];
  employees: Profile[];
  defaultCustomerId?: string;
  defaultWastePercent: number;
  materialPriceOptions: RoofingMaterialPriceRow[];
  calculationDefaults: {
    vatRate: number;
    internalLaborRateNet: number;
    laborRateNet: number;
    travelRatePerKm: number;
    travelFlatRate: number;
  };
};

const orderTypes = Object.keys(orderTypeLabels) as OrderType[];
const orderStatuses = Object.keys(orderStatusLabels) as OrderStatus[];
const orderPriorities = Object.keys(orderPriorityLabels) as OrderPriority[];
const customerTypes = Object.keys(customerTypeLabels) as CustomerType[];

function decimalValue(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveDecimal(value: string) {
  const parsed = decimalValue(value);
  return parsed && parsed > 0 ? parsed : 0;
}

function defaultRoofWastePercent(value: number) {
  return Math.min(20, Math.max(10, Number.isFinite(value) ? value : 15));
}

function money(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR"
  }).format(value);
}

export function OrderWizardForm({
  customers,
  employees,
  defaultCustomerId,
  defaultWastePercent,
  materialPriceOptions,
  calculationDefaults
}: OrderWizardFormProps) {
  const initialCustomerId = defaultCustomerId && customers.some((customer) => customer.id === defaultCustomerId)
    ? defaultCustomerId
    : customers[0]?.id ?? "new";
  const initialCustomer = customers.find((customer) => customer.id === initialCustomerId);
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [jobsiteAddress, setJobsiteAddress] = useState(
    initialCustomer?.jobsite_address ?? initialCustomer?.billing_address ?? ""
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tileType, setTileType] = useState<RoofingTileType>("tonziegel_doppelmulde");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [area, setArea] = useState("");
  const [roofPitch, setRoofPitch] = useState("");
  const [eavesLength, setEavesLength] = useState("");
  const [ridgeLength, setRidgeLength] = useState("");
  const [vergeLength, setVergeLength] = useState("");
  const [valleyLength, setValleyLength] = useState("");
  const [hipLength, setHipLength] = useState("");
  const [wastePercent, setWastePercent] = useState(String(defaultRoofWastePercent(defaultWastePercent)).replace(".", ","));
  const [materialCostPerM2, setMaterialCostPerM2] = useState("");
  const [materialManualTotalNet, setMaterialManualTotalNet] = useState("");
  const [laborHours, setLaborHours] = useState("");
  const [laborEmployeeCount, setLaborEmployeeCount] = useState("1");
  const [internalLaborRateNet, setInternalLaborRateNet] = useState(String(calculationDefaults.internalLaborRateNet).replace(".", ","));
  const [laborRateNet, setLaborRateNet] = useState(String(calculationDefaults.laborRateNet).replace(".", ","));
  const [travelKm, setTravelKm] = useState("");
  const [travelTripCount, setTravelTripCount] = useState("1");
  const [travelRatePerKm, setTravelRatePerKm] = useState(String(calculationDefaults.travelRatePerKm).replace(".", ","));
  const [travelFlatRate, setTravelFlatRate] = useState(String(calculationDefaults.travelFlatRate).replace(".", ","));
  const [machineExtraTotalNet, setMachineExtraTotalNet] = useState("");
  const [vatRate, setVatRate] = useState(String(calculationDefaults.vatRate || 19).replace(".", ","));

  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const customerPreviewName = customerId === "new"
    ? "Neuer Kunde wird beim Speichern angelegt"
    : selectedCustomer
      ? customerDisplayName(selectedCustomer)
      : "Kunde noch nicht ausgewählt";
  const calculatedArea = useMemo(() => {
    const lengthValue = decimalValue(length);
    const widthValue = decimalValue(width);

    if (!lengthValue || !widthValue) return "";
    return String(Math.round(lengthValue * widthValue * 100) / 100).replace(".", ",");
  }, [length, width]);
  const areaValue = area || calculatedArea;
  const roofingMaterialEstimate = useMemo(
    () =>
      calculateRoofingMaterialEstimate(
        {
          areaM2: positiveDecimal(areaValue),
          roofPitch: positiveDecimal(roofPitch),
          tileType,
          eavesLengthM: positiveDecimal(eavesLength),
          ridgeLengthM: positiveDecimal(ridgeLength),
          vergeLengthM: positiveDecimal(vergeLength),
          valleyLengthM: positiveDecimal(valleyLength),
          hipLengthM: positiveDecimal(hipLength),
          wastePercent: positiveDecimal(wastePercent) || 15
        },
        materialPriceOptions
      ),
    [
      areaValue,
      roofPitch,
      tileType,
      eavesLength,
      ridgeLength,
      vergeLength,
      valleyLength,
      hipLength,
      wastePercent,
      materialPriceOptions
    ]
  );
  const manualMaterialTotal = positiveDecimal(materialManualTotalNet);
  const calculatedMaterialTotal = roofingMaterialEstimate.purchaseTotal;
  const effectiveMaterialManualTotal = manualMaterialTotal > 0 ? manualMaterialTotal : calculatedMaterialTotal;
  const costEstimate = useMemo(
    () =>
      calculateOrderCostEstimate({
        areaM2: positiveDecimal(areaValue),
        materialCostPerM2: effectiveMaterialManualTotal > 0 ? 0 : positiveDecimal(materialCostPerM2),
        materialManualTotalNet: effectiveMaterialManualTotal,
        laborHours: positiveDecimal(laborHours),
        laborEmployeeCount: positiveDecimal(laborEmployeeCount) || 1,
        internalLaborRateNet: positiveDecimal(internalLaborRateNet),
        laborRateNet: positiveDecimal(laborRateNet),
        travelKm: positiveDecimal(travelKm),
        travelTripCount: positiveDecimal(travelTripCount) || 1,
        travelRatePerKm: positiveDecimal(travelRatePerKm),
        travelFlatRate: positiveDecimal(travelFlatRate),
        machineExtraTotalNet: positiveDecimal(machineExtraTotalNet),
        vatRate: positiveDecimal(vatRate) || 19
      }),
    [
      areaValue,
      materialCostPerM2,
      effectiveMaterialManualTotal,
      laborHours,
      laborEmployeeCount,
      internalLaborRateNet,
      laborRateNet,
      travelKm,
      travelTripCount,
      travelRatePerKm,
      travelFlatRate,
      machineExtraTotalNet,
      vatRate
    ]
  );

  function updateCustomer(nextCustomerId: string) {
    setCustomerId(nextCustomerId);
    const customer = customers.find((item) => item.id === nextCustomerId);
    setJobsiteAddress(customer?.jobsite_address ?? customer?.billing_address ?? "");
  }

  function updateLength(value: string) {
    setLength(value);
    const widthValue = decimalValue(width);
    const lengthValue = decimalValue(value);
    if (lengthValue && widthValue) setArea(String(Math.round(lengthValue * widthValue * 100) / 100).replace(".", ","));
  }

  function updateWidth(value: string) {
    setWidth(value);
    const widthValue = decimalValue(value);
    const lengthValue = decimalValue(length);
    if (lengthValue && widthValue) setArea(String(Math.round(lengthValue * widthValue * 100) / 100).replace(".", ","));
  }

  function scrollToEditing() {
    document.getElementById("order-editing-area")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function printOfferPreview() {
    document.body.classList.add("offer-print-mode");

    const cleanup = () => {
      document.body.classList.remove("offer-print-mode");
      window.removeEventListener("afterprint", cleanup);
    };

    window.addEventListener("afterprint", cleanup);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(cleanup, 1000);
    }, 0);
  }

  const estimatedMarginTotal = costEstimate.laborMarginTotal;
  const estimatedMarginPercent = costEstimate.subtotalNet > 0
    ? Math.round((estimatedMarginTotal / costEstimate.subtotalNet) * 1000) / 10
    : 0;

  return (
    <form action={createOrderAction} className="space-y-5">
      <section id="order-editing-area" className="surface p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-mint text-moss">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="meta-label">Schritt 1</p>
            <h2 className="section-title">Kunde</h2>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="field-label">Kunde auswählen</span>
            <select
              className="field-input"
              name="customer_id"
              value={customerId}
              onChange={(event) => updateCustomer(event.target.value)}
              required
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customerDisplayName(customer)}
                  {customer.contact_person ? ` · ${customer.contact_person}` : ""}
                </option>
              ))}
              <option value="new">Neuen Kunden anlegen</option>
            </select>
          </label>

          {customerId === "new" ? (
            <>
              <label>
                <span className="field-label">Kundentyp</span>
                <select className="field-input" name="new_customer_type" defaultValue="privatkunde">
                  {customerTypes.map((type) => (
                    <option key={type} value={type}>
                      {customerTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">Firma</span>
                <input className="field-input" name="new_customer_company" placeholder="optional" />
              </label>
              <label>
                <span className="field-label">Vorname</span>
                <input className="field-input" name="new_customer_first_name" />
              </label>
              <label>
                <span className="field-label">Nachname</span>
                <input className="field-input" name="new_customer_last_name" />
              </label>
              <label>
                <span className="field-label">Ansprechpartner</span>
                <input className="field-input" name="new_customer_contact_person" />
              </label>
              <label>
                <span className="field-label">Telefon</span>
                <input className="field-input" name="new_customer_phone" type="tel" />
              </label>
              <label>
                <span className="field-label">E-Mail</span>
                <input className="field-input" name="new_customer_email" type="email" />
              </label>
              <div>
                <VoiceInputField label="Rechnungsadresse" name="new_customer_billing_address" />
              </div>
              <p className="field-help sm:col-span-2">
                Für neue Kunden bitte mindestens Firma, Vorname oder Nachname eintragen.
              </p>
            </>
          ) : selectedCustomer ? (
            <div className="rounded-md border border-line bg-fog p-3 text-sm text-slate-600 sm:col-span-2">
              <p className="font-black text-ink">{customerDisplayName(selectedCustomer)}</p>
              {selectedCustomer.contact_person ? <p>Ansprechpartner: {selectedCustomer.contact_person}</p> : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="surface p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-steel/10 text-steel">
            <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="meta-label">Schritt 2</p>
            <h2 className="section-title">Auftrag</h2>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <VoiceInputField
              label="Auftragstitel"
              name="title"
              value={title}
              onValueChange={setTitle}
              placeholder="z. B. Sanierung Hauptdach Müller"
              required
            />
          </div>
          <label>
            <span className="field-label">Auftragsart</span>
            <select className="field-input" name="order_type" defaultValue="steildach">
              {orderTypes.map((type) => (
                <option key={type} value={type}>
                  {orderTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Status</span>
            <select className="field-input" name="status" defaultValue="anfrage" required>
              {orderStatuses.map((status) => (
                <option key={status} value={status}>
                  {orderStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Priorität</span>
            <select className="field-input" name="priority" defaultValue="normal">
              {orderPriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {orderPriorityLabels[priority]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Start</span>
            <input className="field-input" name="start_date" type="date" required />
          </label>
          <label>
            <span className="field-label">Ende</span>
            <input className="field-input" name="end_date" type="date" />
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <VoiceTextarea
              label="Baustellenadresse"
              name="jobsite_address"
              value={jobsiteAddress}
              onValueChange={setJobsiteAddress}
              rows={3}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <VoiceTextarea
              label="Beschreibung"
              name="description"
              value={description}
              onValueChange={setDescription}
              rows={5}
              placeholder="Leistungsumfang, Zustand, Kundenwunsch"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <VoiceTextarea label="Interne Chef-Notizen" name="internal_notes" rows={5} placeholder="Nur für Chef/Admin" />
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="field-label">Mitarbeiter zuordnen</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {employees.map((employee) => (
              <label key={employee.id} className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  name="assigned_employee_ids"
                  value={employee.id}
                  className="h-4 w-4 rounded border-line text-moss"
                />
                <span>{employee.full_name || employee.email}</span>
              </label>
            ))}
          </div>
          {employees.length === 0 ? <p className="field-help">Noch keine Mitarbeiter oder Vorarbeiter vorhanden.</p> : null}
        </fieldset>
      </section>

      <section className="surface p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-signal/15 text-amber-700">
            <Calculator className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="meta-label">Schritt 3</p>
            <h2 className="section-title">Maße und Material</h2>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className="field-label">Länge m</span>
            <input className="field-input" name="length_m" inputMode="decimal" value={length} onChange={(event) => updateLength(event.target.value)} />
          </label>
          <label>
            <span className="field-label">Breite m</span>
            <input className="field-input" name="width_m" inputMode="decimal" value={width} onChange={(event) => updateWidth(event.target.value)} />
          </label>
          <label>
            <span className="field-label">Fläche m²</span>
            <input
              className="field-input"
              name="area_m2"
              inputMode="decimal"
              value={area || calculatedArea}
              onChange={(event) => setArea(event.target.value)}
              placeholder="automatisch"
            />
          </label>
          <label>
            <span className="field-label">Ziegelart</span>
            <select
              className="field-input"
              name="tile_type"
              value={tileType}
              onChange={(event) => setTileType(event.target.value as RoofingTileType)}
            >
              {roofingTileTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Verschnitt %</span>
            <input
              className="field-input"
              name="waste_percent"
              inputMode="decimal"
              value={wastePercent}
              onChange={(event) => setWastePercent(event.target.value)}
            />
          </label>
          <label>
            <span className="field-label">Dachneigung °</span>
            <input className="field-input" name="roof_pitch" inputMode="decimal" value={roofPitch} onChange={(event) => setRoofPitch(event.target.value)} />
          </label>
          <label>
            <span className="field-label">Traufe m</span>
            <input className="field-input" name="eaves_length_m" inputMode="decimal" value={eavesLength} onChange={(event) => setEavesLength(event.target.value)} />
          </label>
          <label>
            <span className="field-label">First m</span>
            <input className="field-input" name="ridge_length_m" inputMode="decimal" value={ridgeLength} onChange={(event) => setRidgeLength(event.target.value)} />
          </label>
          <label>
            <span className="field-label">Ortgang m</span>
            <input className="field-input" name="verge_length_m" inputMode="decimal" value={vergeLength} onChange={(event) => setVergeLength(event.target.value)} />
          </label>
          <label>
            <span className="field-label">Kehle m</span>
            <input className="field-input" name="valley_length_m" inputMode="decimal" value={valleyLength} onChange={(event) => setValleyLength(event.target.value)} />
          </label>
          <label>
            <span className="field-label">Grat m</span>
            <input className="field-input" name="hip_length_m" inputMode="decimal" value={hipLength} onChange={(event) => setHipLength(event.target.value)} />
          </label>
          <label>
            <span className="field-label">Wandanschluss m</span>
            <input className="field-input" name="wall_connection_length_m" inputMode="decimal" />
          </label>
          <label>
            <span className="field-label">Gebäudehöhe m</span>
            <input className="field-input" name="building_height_m" inputMode="decimal" />
          </label>
          <label>
            <span className="field-label">Fallrohrlänge m</span>
            <input className="field-input" name="downpipe_length_m" inputMode="decimal" />
          </label>
          <label>
            <span className="field-label">Dachfenster</span>
            <input className="field-input" name="roof_windows_count" inputMode="numeric" />
          </label>
          <label>
            <span className="field-label">Durchdringungen</span>
            <input className="field-input" name="penetrations_count" inputMode="numeric" />
          </label>
          <label>
            <span className="field-label">Dachabläufe</span>
            <input className="field-input" name="roof_drains_count" inputMode="numeric" />
          </label>
          <label>
            <span className="field-label">Notüberläufe</span>
            <input className="field-input" name="emergency_overflows_count" inputMode="numeric" />
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <VoiceInputField label="Notizen zur Berechnung" name="dimension_notes" />
          </div>
        </div>

      </section>

      <section className="surface p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-mint text-moss">
            <Calculator className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="meta-label">Schritt 4</p>
            <h2 className="section-title">Direkte Kostenkalkulation</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Nur für Chef/Admin. Mitarbeiter sehen diese Kosten und EK-Werte nicht.
            </p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label>
                <span className="field-label">Fallback Material €/m² netto</span>
                <input
                  className="field-input"
                  name="material_cost_per_m2"
                  inputMode="decimal"
                  value={materialCostPerM2}
                  onChange={(event) => setMaterialCostPerM2(event.target.value)}
                  placeholder="wenn Lagerpreise fehlen"
                />
              </label>
            <label>
              <span className="field-label">Material pauschal netto</span>
              <input
                className="field-input"
                name="material_manual_total_net"
                inputMode="decimal"
                value={materialManualTotalNet}
                onChange={(event) => setMaterialManualTotalNet(event.target.value)}
                placeholder="optional überschreiben"
              />
            </label>
            <label>
              <span className="field-label">Arbeitsstunden je Mitarbeiter</span>
              <input
                className="field-input"
                name="labor_hours_estimated"
                inputMode="decimal"
                value={laborHours}
                onChange={(event) => setLaborHours(event.target.value)}
              />
            </label>
            <label>
              <span className="field-label">Anzahl Mitarbeiter</span>
              <input
                className="field-input"
                name="labor_employee_count"
                inputMode="numeric"
                value={laborEmployeeCount}
                onChange={(event) => setLaborEmployeeCount(event.target.value)}
              />
            </label>
            <label>
              <span className="field-label">Interner Stundenlohn netto</span>
              <input
                className="field-input"
                name="internal_labor_rate_net"
                inputMode="decimal"
                value={internalLaborRateNet}
                onChange={(event) => setInternalLaborRateNet(event.target.value)}
              />
            </label>
            <label>
              <span className="field-label">VK-Stundensatz netto</span>
              <input
                className="field-input"
                name="labor_rate_net"
                inputMode="decimal"
                value={laborRateNet}
                onChange={(event) => setLaborRateNet(event.target.value)}
              />
            </label>
            <div className="rounded-md border border-line bg-white p-3 lg:col-span-3">
              <p className="meta-label">Arbeitskosten</p>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-4">
                <div>
                  <p className="font-semibold text-slate-500">Personenstunden</p>
                  <p className="font-black text-ink">{costEstimate.laborPersonHours.toLocaleString("de-DE")} h</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-500">Interne Kosten</p>
                  <p className="font-black text-ink">{money(costEstimate.laborInternalTotalNet)}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-500">VK Arbeitsleistung</p>
                  <p className="font-black text-ink">{money(costEstimate.laborSalesTotalNet)}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-500">Marge</p>
                  <p className={costEstimate.laborMarginTotal < 0 ? "font-black text-red-700" : "font-black text-primary-dark"}>
                    {money(costEstimate.laborMarginTotal)}
                  </p>
                </div>
              </div>
            </div>
            <label>
              <span className="field-label">Entfernung einfach km</span>
              <input
                className="field-input"
                name="travel_km"
                inputMode="decimal"
                value={travelKm}
                onChange={(event) => setTravelKm(event.target.value)}
              />
              <span className="field-help">Basis: {jobsiteAddress || "Baustellenadresse oben eintragen"}</span>
            </label>
            <label>
              <span className="field-label">Anzahl Fahrten</span>
              <input
                className="field-input"
                name="travel_trip_count"
                inputMode="numeric"
                value={travelTripCount}
                onChange={(event) => setTravelTripCount(event.target.value)}
              />
            </label>
            <label>
              <span className="field-label">Fahrt €/km netto</span>
              <input
                className="field-input"
                name="travel_rate_per_km"
                inputMode="decimal"
                value={travelRatePerKm}
                onChange={(event) => setTravelRatePerKm(event.target.value)}
              />
            </label>
            <label>
              <span className="field-label">Fahrtpauschale netto</span>
              <input
                className="field-input"
                name="travel_flat_rate"
                inputMode="decimal"
                value={travelFlatRate}
                onChange={(event) => setTravelFlatRate(event.target.value)}
              />
            </label>
            <label>
              <span className="field-label">Maschinen/Extras netto</span>
              <input
                className="field-input"
                name="machine_extra_total_net"
                inputMode="decimal"
                value={machineExtraTotalNet}
                onChange={(event) => setMachineExtraTotalNet(event.target.value)}
              />
            </label>
            <label>
              <span className="field-label">MwSt %</span>
              <input
                className="field-input"
                name="vat_rate"
                inputMode="decimal"
                value={vatRate}
                onChange={(event) => setVatRate(event.target.value)}
              />
            </label>
            <div className="rounded-md border border-line bg-white p-3 lg:col-span-3">
              <p className="meta-label">Fahrtkosten</p>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-4">
                <div>
                  <p className="font-semibold text-slate-500">Einfache Strecke</p>
                  <p className="font-black text-ink">{positiveDecimal(travelKm).toLocaleString("de-DE")} km</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-500">Hin/Rück x Fahrten</p>
                  <p className="font-black text-ink">2 x {Math.max(1, Math.round(positiveDecimal(travelTripCount) || 1))}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-500">Abrechenbare km</p>
                  <p className="font-black text-ink">{costEstimate.travelBillableKm.toLocaleString("de-DE")} km</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-500">Fahrt netto</p>
                  <p className="font-black text-primary-dark">{money(costEstimate.travelTotalNet)}</p>
                </div>
              </div>
            </div>
            </div>

            <div className="rounded-lg border border-line bg-fog p-3">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="meta-label">Dachdecker-Materialbedarf</p>
                  <h3 className="text-base font-black text-ink">Automatisch aus den Dachmaßen berechnet</h3>
                </div>
                <p className="text-sm font-black text-primary-dark">{money(roofingMaterialEstimate.purchaseTotal)} EK netto</p>
              </div>

              {roofingMaterialEstimate.items.length === 0 ? (
                <p className="rounded-md border border-dashed border-line bg-white p-3 text-sm font-semibold text-slate-600">
                  Trage Dachfläche oder Kantenmeter ein. Danach erscheinen Dachziegel, Lattung, Unterspannbahn und Zubehör automatisch.
                </p>
              ) : (
                <div className="grid gap-2">
                  {roofingMaterialEstimate.items.map((item) => (
                    <div key={item.key} className="rounded-md border border-line bg-white p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-black text-ink">{item.materialName}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            Grund {item.baseQuantity.toLocaleString("de-DE")} {item.unit} · +{item.wastePercent.toLocaleString("de-DE")} % Verschnitt · Gesamt{" "}
                            {item.totalQuantity.toLocaleString("de-DE")} {item.unit}
                          </p>
                          {item.locationName ? <p className="mt-1 text-xs font-semibold text-slate-500">Lager: {item.locationName}</p> : null}
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-sm font-black text-ink">
                            {item.purchaseTotal === null ? "Preis fehlt" : money(item.purchaseTotal)}
                          </p>
                          {item.purchasePrice !== null ? (
                            <p className="text-xs font-semibold text-slate-500">{money(item.purchasePrice)} / {item.unit}</p>
                          ) : null}
                        </div>
                      </div>
                      {item.warning ? (
                        <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">{item.warning}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {roofingMaterialEstimate.warnings.length > 0 ? (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-black text-amber-900">Preiswarnungen</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs font-semibold text-amber-800">
                    {roofingMaterialEstimate.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          <aside className="rounded-lg border border-primary/20 bg-mint p-4 shadow-sm">
            <p className="meta-label text-primary-dark">Live-Kalkulation</p>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-primary-dark">Material</span>
                <span className="font-black text-ink">{money(costEstimate.materialTotalNet)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-primary-dark">Arbeit VK</span>
                <span className="font-black text-ink">{money(costEstimate.laborSalesTotalNet)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-primary-dark">Arbeitsmarge</span>
                <span className={costEstimate.laborMarginTotal < 0 ? "font-black text-red-700" : "font-black text-ink"}>
                  {money(costEstimate.laborMarginTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-primary-dark">Fahrt</span>
                <span className="font-black text-ink">
                  {money(costEstimate.travelTotalNet)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-primary-dark">Maschinen/Extras</span>
                <span className="font-black text-ink">{money(costEstimate.machineExtraTotalNet)}</span>
              </div>
              <div className="my-1 border-t border-primary/20" />
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-primary-dark">Netto</span>
                <span className="font-black text-ink">{money(costEstimate.subtotalNet)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-primary-dark">MwSt {String(costEstimate.vatRate).replace(".", ",")} %</span>
                <span className="font-black text-ink">{money(costEstimate.vatTotal)}</span>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="meta-label">Brutto-Gesamtpreis</p>
                <p className="mt-1 text-2xl font-black text-primary-dark">{money(costEstimate.totalGross)}</p>
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-5 rounded-lg border border-line bg-white p-4">
          <p className="meta-label">Kalkulation bereit für die Vorschau</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            Prüfe im nächsten Abschnitt Kunde, Leistung und Summen. Erst danach speicherst du den Auftrag.
          </p>
        </div>
      </section>

      <section className="surface offer-print-area p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="meta-label">Schritt 5</p>
            <h2 className="section-title">Angebotsvorschau</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Klare Chef-Ansicht vor dem Speichern. Preise bleiben für Mitarbeiter verborgen.
            </p>
          </div>
          <div className="rounded-md bg-mint px-3 py-2 text-sm font-black text-primary-dark">
            Brutto {money(costEstimate.totalGross)}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-3">
            <div className="rounded-lg border border-line bg-fog p-4">
              <p className="meta-label">Kunde und Baustelle</p>
              <h3 className="mt-1 text-lg font-black text-ink">{customerPreviewName}</h3>
              <p className="mt-2 whitespace-pre-line text-sm font-semibold text-slate-700">
                {jobsiteAddress || "Baustellenadresse noch nicht eingetragen"}
              </p>
            </div>

            <div className="rounded-lg border border-line bg-white p-4">
              <p className="meta-label">Leistungen</p>
              <h3 className="mt-1 text-lg font-black text-ink">{title.trim() || "Auftragstitel noch offen"}</h3>
              <p className="mt-2 whitespace-pre-line text-sm font-semibold text-slate-700">
                {description.trim() || "Beschreibung noch offen"}
              </p>
              <div className="mt-3 grid gap-2 text-xs font-bold text-slate-600 sm:grid-cols-3">
                <span className="rounded-md bg-fog px-2 py-1">Fläche: {positiveDecimal(areaValue).toLocaleString("de-DE")} m²</span>
                <span className="rounded-md bg-fog px-2 py-1">Verschnitt: {positiveDecimal(wastePercent).toLocaleString("de-DE")} %</span>
                <span className="rounded-md bg-fog px-2 py-1">Materialpositionen: {roofingMaterialEstimate.items.length}</span>
              </div>
            </div>

            {roofingMaterialEstimate.warnings.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-black text-amber-900">Hinweise vor Angebotserstellung</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs font-semibold text-amber-800">
                  {roofingMaterialEstimate.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-primary/20 bg-mint p-4">
            <p className="meta-label text-primary-dark">Angebotssumme</p>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-primary-dark">Materialkosten</span>
                <span className="font-black text-ink">{money(costEstimate.materialTotalNet)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-primary-dark">Arbeitskosten</span>
                <span className="font-black text-ink">{money(costEstimate.laborSalesTotalNet)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-primary-dark">Fahrtkosten</span>
                <span className="font-black text-ink">{money(costEstimate.travelTotalNet)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-primary-dark">Extras</span>
                <span className="font-black text-ink">{money(costEstimate.machineExtraTotalNet)}</span>
              </div>
              <div className="my-1 border-t border-primary/20" />
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-primary-dark">Netto</span>
                <span className="font-black text-ink">{money(costEstimate.subtotalNet)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-primary-dark">MwSt {String(costEstimate.vatRate).replace(".", ",")} %</span>
                <span className="font-black text-ink">{money(costEstimate.vatTotal)}</span>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="meta-label">Brutto</p>
                <p className="mt-1 text-3xl font-black text-primary-dark">{money(costEstimate.totalGross)}</p>
              </div>
              <div className="rounded-md border border-primary/20 bg-white p-3">
                <p className="meta-label">Geschätzte Marge</p>
                <p className={estimatedMarginTotal < 0 ? "mt-1 text-xl font-black text-red-700" : "mt-1 text-xl font-black text-primary-dark"}>
                  {money(estimatedMarginTotal)}
                  <span className="ml-2 text-sm font-bold text-slate-500">({estimatedMarginPercent.toLocaleString("de-DE")} % netto)</span>
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Basis: VK-Arbeit minus interner Lohnkosten. Material/Fahrt/Extras werden aktuell als Durchlaufpositionen gerechnet.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="offer-print-actions mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button className="btn-secondary" type="button" onClick={scrollToEditing}>
            <PencilLine className="h-4 w-4" aria-hidden="true" />
            Bearbeiten
          </button>
          <button className="btn-secondary" type="button" onClick={printOfferPreview}>
            <FileText className="h-4 w-4" aria-hidden="true" />
            Angebot als PDF erstellen
          </button>
          <SubmitButton>
            <Calculator className="h-4 w-4" aria-hidden="true" />
            Auftrag speichern
          </SubmitButton>
        </div>
      </section>
    </form>
  );
}
