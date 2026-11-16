import { PAGE_SIZE } from "./search";

/** Builds "/path?a=1&b=2" from only the values that are set. Page 1 and empty values are left out. */
export function listHref(basePath: string, params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    if (key === "page" && Number(value) <= 1) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Turns a total and a requested page into safe numbers (the requested page is clamped to what exists). */
export function paginate(total: number, requestedPage: number, pageSize = PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(requestedPage) || 1), pageCount);
  return { page, pageCount, skip: (page - 1) * pageSize, limit: pageSize };
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageCount: number;
}
