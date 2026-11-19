import { firstParam, parsePageParam } from "@/lib/search";
import { CONTENT_STATUSES, type ContentStatus } from "./types";

export interface ContentFilters {
  q?: string;
  status?: ContentStatus;
  page: number;
}

/** Reads ?q=&status=&page= defensively: anything invalid is ignored rather than trusted. */
export function parseContentFilters(params: Record<string, string | string[] | undefined>): ContentFilters {
  const status = firstParam(params.status);
  const q = (firstParam(params.q) ?? "").trim().slice(0, 100);
  return {
    q: q || undefined,
    status: CONTENT_STATUSES.find((option) => option === status),
    page: parsePageParam(params.page),
  };
}
