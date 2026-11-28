import { can, isRole } from "@/server/policies/permissions";

/** Who may manage source-code sales: the same people who manage leads. */
export function canManageSales(role: unknown): boolean {
  return isRole(role) && can(role, "leads.manage");
}
