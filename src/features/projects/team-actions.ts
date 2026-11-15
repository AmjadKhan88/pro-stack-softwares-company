"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@/server/logger";
import { ForbiddenError, assertPermission } from "@/server/auth/session";
import { TEAM_FIELDS, pickFields, teamMemberSchema } from "./team-schema";
import { assignMember, removeMember } from "./team-service";
import type { ProjectActionState } from "./state";

function firstMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check your input.";
}

function refresh() {
  revalidatePath("/admin/projects", "layout");
}

export async function assignMemberAction(
  _previous: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  try {
    const actor = await assertPermission("projects.manage");
    const parsed = teamMemberSchema.safeParse(pickFields(formData, TEAM_FIELDS));
    if (!parsed.success) return { status: "error", message: firstMessage(parsed.error) };

    const result = await assignMember({
      actor: { id: actor.id, email: actor.email },
      projectId: parsed.data.projectId,
      userId: parsed.data.userId,
    });
    if (!result.ok) {
      const messages = {
        "project-not-found": "That project no longer exists.",
        "project-closed": "This project is closed, so people can't be added.",
        "user-not-assignable": "That person can't be added to a project team.",
        "already-member": "That person is already on the team.",
      } as const;
      return { status: "error", message: messages[result.reason] };
    }
    refresh();
    return { status: "success", message: "Added to the team." };
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "assigning team member failed");
    return { status: "error", message: "We couldn't add them. Please try again." };
  }
}

export async function removeMemberAction(
  _previous: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  try {
    const actor = await assertPermission("projects.manage");
    const parsed = teamMemberSchema.safeParse(pickFields(formData, TEAM_FIELDS));
    if (!parsed.success) return { status: "error", message: firstMessage(parsed.error) };

    const result = await removeMember({
      actor: { id: actor.id, email: actor.email },
      projectId: parsed.data.projectId,
      userId: parsed.data.userId,
    });
    if (!result.ok) {
      return {
        status: "error",
        message:
          result.reason === "not-a-member"
            ? "That person isn't on the team."
            : "That project no longer exists.",
      };
    }
    refresh();
    return { status: "success", message: "Removed from the team." };
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "removing team member failed");
    return { status: "error", message: "We couldn't remove them. Please try again." };
  }
}
