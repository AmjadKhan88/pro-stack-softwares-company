import { can } from "@/server/policies/permissions";

export interface DashboardSections {
  leads: boolean;
  proposals: boolean;
  projects: boolean;
  clients: boolean;
  activity: boolean;
}

/**
 * Which parts of the admin overview a role gets. A role only ever sees numbers about data it may open on its
 * own screens, so the dashboard can never reveal more than the rest of the admin does.
 */
export function dashboardSections(role: unknown): DashboardSections {
  return {
    leads: can(role, "leads.read"),
    proposals: can(role, "proposals.manage"),
    projects: can(role, "projects.read.all") || can(role, "projects.read.assigned"),
    clients: can(role, "clients.manage"),
    activity: can(role, "audit.read"),
  };
}

export function hasAnySection(sections: DashboardSections): boolean {
  return Object.values(sections).some(Boolean);
}
