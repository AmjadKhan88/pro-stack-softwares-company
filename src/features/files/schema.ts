import { z } from "zod";
import { isObjectId } from "@/lib/object-id";
import { isOwnFilePublicId } from "./rules";

export { pickFields } from "@/lib/form-fields";

const objectId = (message: string) => z.string().refine(isObjectId, message);

export const requestFileUploadSchema = z.strictObject({
  projectId: objectId("Invalid project."),
  deliverableId: objectId("Invalid deliverable.").optional(),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(100),
  size: z.number().int().min(1).max(1_000_000_000),
  clientVisible: z.boolean(),
});

export const finalizeFileSchema = z.strictObject({
  publicId: z.string().refine(isOwnFilePublicId, "That upload isn't valid."),
});

export const fileIdSchema = z.strictObject({ fileId: objectId("Invalid file.") });
export const fileVisibilitySchema = z.strictObject({
  fileId: objectId("Invalid file."),
  visible: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const FILE_ID_FIELDS = ["fileId"] as const;
export const FILE_VISIBILITY_FIELDS = ["fileId", "visible"] as const;
