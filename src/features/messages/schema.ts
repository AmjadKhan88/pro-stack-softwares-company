import { z } from "zod";
import { isObjectId } from "@/lib/object-id";
import { MAX_MESSAGE_LENGTH, cleanMessageBody } from "./rules";

export { pickFields } from "@/lib/form-fields";

export const sendMessageSchema = z.strictObject({
  projectId: z.string().refine(isObjectId, "That conversation isn't valid."),
  body: z
    .string({ error: "Write a message first." })
    .max(MAX_MESSAGE_LENGTH * 2, "That message is too long.")
    .transform(cleanMessageBody)
    .pipe(
      z
        .string()
        .min(1, "Write a message first.")
        .max(
          MAX_MESSAGE_LENGTH,
          `Keep messages under ${MAX_MESSAGE_LENGTH.toLocaleString("en")} characters.`,
        ),
    ),
});

export const SEND_FIELDS = ["projectId", "body"] as const;
