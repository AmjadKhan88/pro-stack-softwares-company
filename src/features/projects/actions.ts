"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logger } from "@/server/logger";
import { ForbiddenError, assertPermission, type SessionUser } from "@/server/auth/session";
import {
  CONVERT_FIELDS,
  DELIVERABLE_FIELDS,
  ITEM_STATUS_FIELDS,
  MILESTONE_FIELDS,
  PROJECT_STATUS_FIELDS,
  VISIBILITY_FIELDS,
  convertSchema,
  deliverableSchema,
  itemStatusSchema,
  milestoneSchema,
  pickFields,
  projectStatusSchema,
  visibilitySchema,
} from "./schema";
import {
  addDeliverable,
  addMilestone,
  changeDeliverableStatus,
  changeMilestoneStatus,
  changeProjectStatus,
  convertProposalToProject,
  setItemVisibility,
  type ItemResult,
} from "./service";
import type { ProjectActionState } from "./state";

function firstMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check your input.";
}

const ITEM_MESSAGES = {
  "not-found": "That item no longer exists.",
  "project-closed": "This project is closed, so it can't be changed.",
  "invalid-transition": "That change isn't allowed from the current status.",
  "changed-elsewhere": "Someone else just changed this. Reload the page and try again.",
} as const;

function describe(result: ItemResult, success: string): ProjectActionState {
  return result.ok
    ? { status: "success", message: success }
    : { status: "error", message: ITEM_MESSAGES[result.reason] };
}

/** Runs a staff action after checking the permission on the server, with consistent error handling. */
async function guarded(
  work: (actor: SessionUser) => Promise<ProjectActionState>,
  paths: string[],
): Promise<ProjectActionState> {
  try {
    const actor = await assertPermission("projects.manage");
    const state = await work(actor);
    if (state.status === "success") for (const path of paths) revalidatePath(path);
    return state;
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "project action failed");
    return { status: "error", message: "We couldn't complete that. Please try again." };
  }
}

const who = (actor: SessionUser) => ({ id: actor.id, email: actor.email });

export async function convertProposalAction(
  _previous: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  let projectId: string;
  try {
    const actor = await assertPermission("projects.manage");
    const parsed = convertSchema.safeParse(pickFields(formData, CONVERT_FIELDS));
    if (!parsed.success) return { status: "error", message: firstMessage(parsed.error) };
    const result = await convertProposalToProject({ proposalId: parsed.data.proposalId, actor: who(actor) });
    if (!result.ok) {
      const messages = {
        "not-found": "That proposal no longer exists.",
        "not-accepted": "Only an accepted proposal can be converted to a project.",
        "already-converted": "This proposal has already been converted to a project.",
        "lead-not-ready": "The lead must be qualified and linked to a client organization first.",
        "changed-elsewhere": "Someone else just changed this. Reload the page and try again.",
      } as const;
      return { status: "error", message: messages[result.reason] };
    }
    projectId = result.projectId;
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "converting proposal failed");
    return { status: "error", message: "We couldn't create the project. Please try again." };
  }
  revalidatePath("/admin/proposals");
  revalidatePath("/admin/projects");
  revalidatePath("/admin/leads");
  redirect(`/admin/projects/${projectId}`);
}

export async function projectStatusAction(
  _previous: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const parsed = projectStatusSchema.safeParse(pickFields(formData, PROJECT_STATUS_FIELDS));
  if (!parsed.success) return { status: "error", message: firstMessage(parsed.error) };
  const { projectId, to } = parsed.data;
  return guarded(
    async (actor) =>
      describe(
        await changeProjectStatus({ actor: who(actor), id: projectId, to }),
        "Project status updated.",
      ),
    ["/admin/projects", `/admin/projects/${projectId}`, "/portal/projects", `/portal/projects/${projectId}`],
  );
}

export async function addMilestoneAction(
  _previous: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const parsed = milestoneSchema.safeParse(pickFields(formData, MILESTONE_FIELDS));
  if (!parsed.success) return { status: "error", message: firstMessage(parsed.error) };
  const data = parsed.data;
  return guarded(
    async (actor) => describe(await addMilestone({ actor: who(actor), ...data }), "Milestone added."),
    [`/admin/projects/${data.projectId}`, `/portal/projects/${data.projectId}`],
  );
}

export async function addDeliverableAction(
  _previous: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const parsed = deliverableSchema.safeParse(pickFields(formData, DELIVERABLE_FIELDS));
  if (!parsed.success) return { status: "error", message: firstMessage(parsed.error) };
  const data = parsed.data;
  return guarded(
    async (actor) => describe(await addDeliverable({ actor: who(actor), ...data }), "Deliverable added."),
    [`/admin/projects/${data.projectId}`, `/portal/projects/${data.projectId}`],
  );
}

export async function itemStatusAction(
  _previous: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const parsed = itemStatusSchema.safeParse(pickFields(formData, ITEM_STATUS_FIELDS));
  if (!parsed.success) return { status: "error", message: firstMessage(parsed.error) };
  const { kind, id, to } = parsed.data;
  return guarded(
    async (actor) => {
      const result =
        kind === "milestone"
          ? await changeMilestoneStatus({ actor: who(actor), id, to })
          : await changeDeliverableStatus({ actor: who(actor), id, to });
      return describe(result, "Status updated.");
    },
    ["/admin/projects", "/portal/projects"],
  );
}

export async function visibilityAction(
  _previous: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const parsed = visibilitySchema.safeParse(pickFields(formData, VISIBILITY_FIELDS));
  if (!parsed.success) return { status: "error", message: firstMessage(parsed.error) };
  const { kind, id, visible } = parsed.data;
  return guarded(
    async (actor) =>
      describe(
        await setItemVisibility({ actor: who(actor), kind, id, visible }),
        visible ? "Now visible to the client." : "Now hidden from the client.",
      ),
    ["/admin/projects", "/portal/projects"],
  );
}
