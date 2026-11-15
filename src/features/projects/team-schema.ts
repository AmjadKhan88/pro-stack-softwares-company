import { z } from "zod";
import { isObjectId } from "@/lib/object-id";

export { pickFields } from "@/lib/form-fields";

export const teamMemberSchema = z.strictObject({
  projectId: z.string().refine(isObjectId, "Invalid project."),
  userId: z.string().refine(isObjectId, "Choose a team member."),
});

export const TEAM_FIELDS = ["projectId", "userId"] as const;
