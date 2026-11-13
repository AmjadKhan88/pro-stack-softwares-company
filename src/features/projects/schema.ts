import { z } from "zod";
import { isObjectId } from "@/lib/object-id";
import { PROJECT_STATUSES, isItemStatus } from "./status";

export { pickFields } from "@/lib/form-fields";

const objectId = (message: string) => z.string().refine(isObjectId, message);
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

function isRealDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

const optionalText = (max: number, message: string) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max, message).optional());

const optionalDate = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD.")
    .refine(isRealDate, "That date doesn't exist.")
    .transform((value) => new Date(`${value}T00:00:00.000Z`))
    .optional(),
);

/** An unticked checkbox sends nothing at all, so "absent" means false. */
const checkbox = z.preprocess((value) => value === "on", z.boolean());

export const milestoneSchema = z.strictObject({
  projectId: objectId("Invalid project."),
  title: z
    .string()
    .trim()
    .min(2, "Give the milestone a title.")
    .max(160, "Keep the title under 160 characters."),
  description: optionalText(1000, "Keep the description under 1,000 characters."),
  dueDate: optionalDate,
  clientVisible: checkbox,
});

export const deliverableSchema = z.strictObject({
  projectId: objectId("Invalid project."),
  milestoneId: z.preprocess(emptyToUndefined, objectId("Invalid milestone.").optional()),
  title: z
    .string()
    .trim()
    .min(2, "Give the deliverable a title.")
    .max(200, "Keep the title under 200 characters."),
  description: optionalText(1000, "Keep the description under 1,000 characters."),
  clientVisible: checkbox,
});

export const projectStatusSchema = z.strictObject({
  projectId: objectId("Invalid project."),
  to: z.enum(PROJECT_STATUSES, { error: "Choose a status." }),
});

export const itemStatusSchema = z
  .strictObject({
    kind: z.enum(["milestone", "deliverable"]),
    id: objectId("Invalid item."),
    to: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!isItemStatus(data.kind, data.to)) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "That status isn't valid." });
    }
  });

export const visibilitySchema = z.strictObject({
  kind: z.enum(["milestone", "deliverable"]),
  id: objectId("Invalid item."),
  visible: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const convertSchema = z.strictObject({ proposalId: objectId("Invalid proposal.") });

export const MILESTONE_FIELDS = ["projectId", "title", "description", "dueDate", "clientVisible"] as const;
export const DELIVERABLE_FIELDS = [
  "projectId",
  "milestoneId",
  "title",
  "description",
  "clientVisible",
] as const;
export const PROJECT_STATUS_FIELDS = ["projectId", "to"] as const;
export const ITEM_STATUS_FIELDS = ["kind", "id", "to"] as const;
export const VISIBILITY_FIELDS = ["kind", "id", "visible"] as const;
export const CONVERT_FIELDS = ["proposalId"] as const;
