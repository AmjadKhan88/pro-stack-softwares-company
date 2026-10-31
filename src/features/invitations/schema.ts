import { z } from "zod";
import { INVITABLE_ROLES } from "./rules";

export const inviteSchema = z.strictObject({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Email is too long.")
    .pipe(z.email("Enter a valid email address.")),
  role: z.enum(INVITABLE_ROLES, { error: "Choose a role." }),
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

export const INVITE_FIELDS = ["email", "role"] as const;
export const ACCEPT_FIELDS = ["token", "name", "password", "confirm"] as const;

/** Picks only known fields from FormData (Next.js adds internal "$ACTION_*" entries). */
export function pickFields<const T extends readonly string[]>(
  formData: FormData,
  fields: T,
): Record<T[number], string> {
  const values = {} as Record<T[number], string>;
  for (const field of fields) {
    const raw = formData.get(field);
    if (typeof raw === "string") values[field as T[number]] = raw;
  }
  return values;
}
