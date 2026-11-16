import { AUDIT_ACTIONS, type AuditAction } from "@/features/audit/types";
import { PROJECT_STATUSES, type ProjectStatus } from "@/features/projects/status";
import { PROPOSAL_STATUSES, type ProposalStatus } from "@/features/proposals/status";
import { firstParam, parsePageParam } from "@/lib/search";

type Raw = Record<string, string | string[] | undefined>;

function text(value: string | string[] | undefined): string | undefined {
  return (firstParam(value) ?? "").trim().slice(0, 100) || undefined;
}

function oneOf<T extends string>(allowed: readonly T[], value: string | string[] | undefined): T | undefined {
  const candidate = firstParam(value);
  return allowed.find((option) => option === candidate);
}

export interface ProjectListFilters {
  q?: string;
  status?: ProjectStatus;
  page: number;
}
export function parseProjectFilters(params: Raw): ProjectListFilters {
  return {
    q: text(params.q),
    status: oneOf(PROJECT_STATUSES, params.status),
    page: parsePageParam(params.page),
  };
}

export interface ProposalListFilters {
  q?: string;
  status?: ProposalStatus;
  page: number;
}
export function parseProposalFilters(params: Raw): ProposalListFilters {
  return {
    q: text(params.q),
    status: oneOf(PROPOSAL_STATUSES, params.status),
    page: parsePageParam(params.page),
  };
}

export interface OrganizationListFilters {
  q?: string;
  status?: "active" | "archived";
  page: number;
}
export function parseOrganizationFilters(params: Raw): OrganizationListFilters {
  return {
    q: text(params.q),
    status: oneOf(["active", "archived"] as const, params.status),
    page: parsePageParam(params.page),
  };
}

export interface AuditListFilters {
  q?: string;
  action?: AuditAction;
  page: number;
}
export function parseAuditFilters(params: Raw): AuditListFilters {
  return {
    q: text(params.q),
    action: oneOf(AUDIT_ACTIONS, params.action),
    page: parsePageParam(params.page),
  };
}
