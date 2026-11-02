import { z } from "zod";

export { pickFields } from "@/lib/form-fields";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const organizationSchema = z.strictObject({
  name: z.string().trim().min(2, "Enter the organization's name.").max(120, "Name is too long."),
  contactEmail: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "Email is too long.")
      .pipe(z.email("Enter a valid email address."))
      .optional(),
  ),
});

export type OrganizationInput = z.infer<typeof organizationSchema>;
export const ORGANIZATION_FIELDS = ["name", "contactEmail"] as const;

export type OrganizationState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<"name" | "contactEmail", string>> };

export const initialOrganizationState: OrganizationState = { status: "idle" };
