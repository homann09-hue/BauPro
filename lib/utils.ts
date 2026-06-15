import { clsx, type ClassValue } from "clsx";
import type { Role } from "@/types/app";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function isManager(role?: Role | null) {
  return role === "admin" || role === "chef";
}

export function isForeman(role?: Role | null) {
  return role === "vorarbeiter";
}

export function canOperate(role?: Role | null) {
  return isManager(role) || isForeman(role);
}

export function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    throw new Error(`Pflichtfeld fehlt: ${key}`);
  }

  return value;
}

export function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export function optionalDate(formData: FormData, key: string) {
  const value = optionalString(formData, key);
  return value || null;
}

export function optionalNumber(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").replace(",", ".").trim();
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function numberOrZero(formData: FormData, key: string) {
  return optionalNumber(formData, key) ?? 0;
}

export function toBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

export function formIds(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => String(value))
    .filter(Boolean);
}

export function formatDate(value?: string | null) {
  if (!value) return "Keine Angabe";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Keine Angabe";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatMoney(value?: number | null) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR"
  }).format(value);
}

export function getInitials(name?: string | null, fallback?: string | null) {
  const source = name || fallback || "BP";
  return source
    .split(/[ @.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function searchParamMessage(searchParams?: Record<string, string | string[] | undefined>) {
  const error = searchParams?.error;
  const success = searchParams?.success;
  return {
    error: typeof error === "string" ? error : null,
    success: typeof success === "string" ? success : null
  };
}
