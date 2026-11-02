import { z } from "zod";
import { isObjectId } from "@/lib/object-id";
import { INVITABLE_ROLES } from "./rules";

export { pickFields } from "@/lib/form-fields";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const inviteSchema = z
  .strictObject({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "Email is too long.")
      .pipe(z.email("Enter a valid email address.")),
    role: z.enum(INVITABLE_ROLES, { error: "Choose a role." }),
    organizationId: z.preprocess(
      emptyToUndefined,
      z.string().refine(isObjectId, "Choose an organization.").optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.role === "client" && !data.organizationId) {
      ctx.addIssue({
        code: "custom",
        path: ["organizationId"],
        message: "Choose the client's organization.",
      });
    }
    if (data.role !== "client" && data.organizationId) {
      ctx.addIssue({
        code: "custom",
        path: ["organizationId"],
        message: "Only client accounts belong to an organization.",
      });
    }
  });

export const acceptSchema = z
  .strictObject({
    token: z.string().min(20).max(200),
    name: z.string().trim().min(2, "Enter your name.").max(100, "Name is too long."),
    password: z.string().min(12, "Use at least 12 characters.").max(128, "Password is too long."),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    path: ["confirm"],
    message: "The passwords don't match.",
  });

export type InviteInput = z.infer<typeof inviteSchema>;
export type AcceptInput = z.infer<typeof acceptSchema>;

export const INVITE_FIELDS = ["email", "role", "organizationId"] as const;
export const ACCEPT_FIELDS = ["token", "name", "password", "confirm"] as const;
