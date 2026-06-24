import { z } from "zod";
import { SafeActionError } from "@/lib/security/errors";

const uuidSchema = z.string().trim().uuid();
const nonEmptyStringSchema = z.string().trim().min(1);

function entryToString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export function requiredFormString(formData: FormData, key: string, label = key) {
  const result = nonEmptyStringSchema.safeParse(entryToString(formData.get(key)));
  if (!result.success) throw new SafeActionError(`Pflichtfeld fehlt: ${label}`);
  return result.data;
}

export function optionalFormString(formData: FormData, key: string) {
  const value = entryToString(formData.get(key));
  return value || null;
}

export function requiredFormUuid(formData: FormData, key: string, label = key) {
  const result = uuidSchema.safeParse(entryToString(formData.get(key)));
  if (!result.success) throw new SafeActionError(`Ungueltige ID fuer ${label}.`);
  return result.data;
}

export function optionalFormUuid(formData: FormData, key: string, label = key) {
  const value = entryToString(formData.get(key));
  if (!value) return null;

  const result = uuidSchema.safeParse(value);
  if (!result.success) throw new SafeActionError(`Ungueltige ID fuer ${label}.`);
  return result.data;
}

export function formUuidList(formData: FormData, key: string, label = key) {
  const ids = formData
    .getAll(key)
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  const uniqueIds = Array.from(new Set(ids));
  for (const id of uniqueIds) {
    if (!uuidSchema.safeParse(id).success) {
      throw new SafeActionError(`Ungueltige ID in ${label}.`);
    }
  }

  return uniqueIds;
}

export function enumFormValue<T extends readonly [string, ...string[]]>(
  formData: FormData,
  key: string,
  values: T,
  fallback: T[number]
) {
  const schema = z.enum(values);
  const result = schema.safeParse(entryToString(formData.get(key)) || fallback);
  return result.success ? result.data : fallback;
}

export function positiveFormNumber(formData: FormData, key: string, label = key) {
  const raw = entryToString(formData.get(key)).replace(",", ".");
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new SafeActionError(`${label} muss größer als 0 sein.`);
  }

  return parsed;
}
