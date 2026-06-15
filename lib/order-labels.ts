import type {
  Customer,
  CustomerStatus,
  CustomerType,
  OrderPriority,
  OrderStatus,
  OrderType,
  RoofType
} from "@/types/app";

export const customerTypeLabels: Record<CustomerType, string> = {
  privatkunde: "Privatkunde",
  gewerbekunde: "Gewerbekunde",
  hausverwaltung: "Hausverwaltung",
  architekt: "Architekt",
  versicherung: "Versicherung"
};

export const customerStatusLabels: Record<CustomerStatus, string> = {
  aktiv: "Aktiv",
  inaktiv: "Inaktiv"
};

export const orderTypeLabels: Record<OrderType, string> = {
  steildach: "Steildach",
  flachdach: "Flachdach",
  reparatur: "Reparatur",
  dachrinne: "Dachrinne/Entwässerung",
  blech: "Blech",
  wartung: "Wartung",
  sonstiges: "Sonstiges"
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  anfrage: "Anfrage",
  angebot: "Angebot",
  geplant: "Geplant",
  in_arbeit: "In Arbeit",
  fertig: "Fertig",
  abgerechnet: "Abgerechnet"
};

export const orderPriorityLabels: Record<OrderPriority, string> = {
  niedrig: "Niedrig",
  normal: "Normal",
  hoch: "Hoch"
};

export function customerDisplayName(customer: Pick<Customer, "company" | "first_name" | "last_name">) {
  const privateName = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim();
  return customer.company || privateName || "Kunde";
}

export function orderTypeToRoofType(orderType: OrderType): RoofType {
  if (orderType === "flachdach") return "flachdach";
  if (orderType === "dachrinne") return "entwaesserung";
  if (orderType === "blech") return "blech";
  if (orderType === "reparatur" || orderType === "wartung" || orderType === "sonstiges") return "reparatur";
  return "steildach";
}
