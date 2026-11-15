import { z } from "zod";
import { firstParam, parsePageParam } from "@/lib/search";
import { isObjectId } from "@/lib/object-id";
import { isRole, type Role } from "@/server/policies/permissions";
import { ROLE_CHANGE_OPTIONS } from "./rules";

export { pickFields } from "@/lib/form-fields";

const userId = z.string().refine(isObjectId, "Invalid account.");
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const changeRoleSchema = z.strictObject({
  userId,
  role: z.enum(ROLE_CHANGE_OPTIONS, { error: "Choose a role." }),
});

export const accountStatusSchema = z.strictObject({
  userId,
  action: z.enum(["disable", "enable"], { error: "Choose an action." }),
  reason: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(200, "Keep the reason under 200 characters.").optional(),
  ),
});

export const CHANGE_ROLE_FIELDS = ["userId", "role"] as const;
export const STATUS_FIELDS = ["userId", "action", "reason"] as const;

export type UserActionState =
  { status: "idle" } | { status: "success"; message: string } | { status: "error"; message: string };

export const initialUserActionState: UserActionState = { status: "idle" };

export interface AccountFilters {
  q?: string;
  role?: Role;
  status?: "active" | "disabled";
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

/** Reads ?q=&role=&status=&page= defensively: anything invalid is ignored rather than trusted. */
export function parseAccountFilters(params: RawParams): AccountFilters {
  const role = firstParam(params.role);
  const status = firstParam(params.status);
  const q = (firstParam(params.q) ?? "").trim().slice(0, 100);
  return {
    q: q || undefined,
    role: isRole(role) ? role : undefined,
    status: status === "active" || status === "disabled" ? status : undefined,
    page: parsePageParam(params.page),
  };
}

export function accountsHref(filters: AccountFilters, overrides: Partial<AccountFilters> = {}): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.role) params.set("role", merged.role);
  if (merged.status) params.set("status", merged.status);
  if (merged.page > 1) params.set("page", String(merged.page));
  const query = params.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}
