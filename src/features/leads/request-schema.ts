import { z } from "zod";
import { BUDGET_RANGES, PROJECT_TYPES, TIMEFRAMES } from "./schema";

export { pickFields } from "@/lib/form-fields";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

/** What a client types. Their name, email and organization are never taken from the form. */
export const portalRequestSchema = z.strictObject({
  projectType: z.enum(PROJECT_TYPES, { error: "Choose a project type." }),
  budgetRange: z.preprocess(
    emptyToUndefined,
    z.enum(BUDGET_RANGES, { error: "Choose a budget range." }).optional(),
  ),
  timeframe: z.preprocess(emptyToUndefined, z.enum(TIMEFRAMES, { error: "Choose a timeframe." }).optional()),
  message: z
    .string()
    .trim()
    .min(20, "Please describe what you need in at least 20 characters.")
    .max(4000, "Please keep the description under 4,000 characters."),
});

export type PortalRequestInput = z.infer<typeof portalRequestSchema>;
export type PortalRequestField = keyof PortalRequestInput;
export const REQUEST_FIELDS = ["projectType", "budgetRange", "timeframe", "message"] as const;

export type RequestState =
  | { status: "idle" }
  | { status: "success"; referenceCode: string }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<PortalRequestField, string>>;
      values?: Partial<Record<PortalRequestField, string>>;
    };

export const initialRequestState: RequestState = { status: "idle" };
