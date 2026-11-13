// Project, milestone and deliverable lifecycles as small pure state machines (no I/O).

export const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed", "cancelled"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PROJECT_STATUS_TONE: Record<
  ProjectStatus,
  "draft" | "live" | "review" | "archived" | "blocked"
> = {
  planning: "draft",
  active: "live",
  on_hold: "review",
  completed: "archived",
  cancelled: "blocked",
};

const PROJECT_MOVES: Record<ProjectStatus, readonly ProjectStatus[]> = {
  planning: ["active", "cancelled"],
  active: ["on_hold", "completed", "cancelled"],
  on_hold: ["active", "cancelled"],
  completed: [],
  cancelled: [],
};

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === "string" && (PROJECT_STATUSES as readonly string[]).includes(value);
}

export function canMoveProject(from: ProjectStatus, to: ProjectStatus): boolean {
  return PROJECT_MOVES[from].includes(to);
}

export function projectMovesFrom(from: ProjectStatus): readonly ProjectStatus[] {
  return PROJECT_MOVES[from];
}

/** Completed and cancelled projects are closed: nothing inside them can change any more. */
export function isProjectOpen(status: ProjectStatus): boolean {
  return status !== "completed" && status !== "cancelled";
}

export const MILESTONE_STATUSES = ["planned", "in_progress", "done"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const DELIVERABLE_STATUSES = ["planned", "in_progress", "delivered"] as const;
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];

export type ItemKind = "milestone" | "deliverable";

export const ITEM_STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  in_progress: "In progress",
  done: "Done",
  delivered: "Delivered",
};

/** Button wording for each possible move. */
export const ITEM_MOVE_LABELS: Record<string, string> = {
  planned: "Back to planned",
  in_progress: "Mark in progress",
  done: "Mark done",
  delivered: "Mark delivered",
};

export const ITEM_STATUS_TONE: Record<string, "draft" | "review" | "live"> = {
  planned: "draft",
  in_progress: "review",
  done: "live",
  delivered: "live",
};

const ITEM_MOVES: Record<ItemKind, Record<string, readonly string[]>> = {
  milestone: { planned: ["in_progress"], in_progress: ["done", "planned"], done: ["in_progress"] },
  deliverable: {
    planned: ["in_progress"],
    in_progress: ["delivered", "planned"],
    delivered: ["in_progress"],
  },
};

export function isItemStatus(kind: ItemKind, value: unknown): boolean {
  return typeof value === "string" && value in ITEM_MOVES[kind];
}

export function itemMovesFrom(kind: ItemKind, from: string): readonly string[] {
  return ITEM_MOVES[kind][from] ?? [];
}

export function canMoveItem(kind: ItemKind, from: string, to: string): boolean {
  return itemMovesFrom(kind, from).includes(to);
}

/** Progress for the client: only milestones they can see count. */
export function milestoneProgress(statuses: readonly string[]): {
  done: number;
  total: number;
  percent: number;
} {
  const total = statuses.length;
  const done = statuses.filter((status) => status === "done").length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/**
 * The ONLY filter client code may use to read projects. Always scoped to the client's own organization,
 * which comes from their signed-in account, never from the URL or a form.
 */
export function clientProjectFilter(organizationId: string, projectId?: string) {
  if (!organizationId) throw new Error("A client project query needs an organization id.");
  return { organizationId, ...(projectId ? { _id: projectId } : {}) };
}

/** Clients only ever see milestones and deliverables that staff have explicitly made visible. */
export function clientVisibleChildFilter(projectId: string) {
  if (!projectId) throw new Error("A client query needs a project id.");
  return { projectId, clientVisible: true as const };
}
