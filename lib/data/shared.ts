import { postgrestIlikeAnyFilter, postgrestSearchPattern } from "@/lib/text/german";

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export function stringParam(params: SearchParamsRecord, key: string) {
  const value = params[key];
  return typeof value === "string" ? value.trim() : "";
}

export function pageParam(params: SearchParamsRecord) {
  const parsed = Number(stringParam(params, "page"));
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1;
}

export function pageRange(page: number, pageSize: number) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function totalPages(totalCount: number, pageSize: number) {
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

export function searchPattern(value: string) {
  return postgrestSearchPattern(value);
}

export function searchOrFilter(fields: string[], value: string) {
  return postgrestIlikeAnyFilter(fields, value);
}
