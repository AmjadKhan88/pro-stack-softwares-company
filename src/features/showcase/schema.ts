import { z } from "zod";
import { PAYMENT_METHOD_IDS } from "@/config/payments";
import { isObjectId } from "@/lib/object-id";
import {
  NAME_PATTERN,
  OFFER_STATUSES,
  ORDER_STATUSES,
  PHONE_PATTERN,
  REFERENCE_NOTE_PATTERN,
  cleanText,
  isSafeHttpsUrl,
  isValidSlug,
  parseTechStack,
  rupeesToMinor,
} from "./rules";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

/** The first problem for each field, ready to show next to that field. */
export function firstErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in result)) result[key] = issue.message;
  }
  return result;
}

// ---- A buyer's request -------------------------------------------------------------------------------------

export const ORDER_FIELDS = [
  "offerId",
  "name",
  "email",
  "phone",
  "paymentMethod",
  "transactionRef",
  "note",
  "agree",
] as const;

export const orderSchema = z.strictObject({
  offerId: z.string({ error: "Please choose a project." }).refine(isObjectId, "Please choose a project."),
  name: z
    .string({ error: "Please enter your name." })
    .trim()
    .min(2, "Please enter your name.")
    .regex(NAME_PATTERN, "Please use letters only in your name."),
  email: z
    .string({ error: "Please enter your email." })
    .trim()
    .toLowerCase()
    .max(120, "That email is too long.")
    .pipe(z.email("Please enter a valid email address.")),
  phone: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .regex(PHONE_PATTERN, "Please enter a valid phone number, or leave it empty.")
      .optional(),
  ),
  paymentMethod: z.enum(PAYMENT_METHOD_IDS, { error: "Please choose how you paid." }),
  transactionRef: z.preprocess(
    emptyToUndefined,
    z.string().trim().regex(REFERENCE_NOTE_PATTERN, "Use letters, numbers and dashes only.").optional(),
  ),
  note: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .max(1000, "Please keep your note under 500 characters.")
      .transform(cleanText)
      .pipe(z.string().max(500, "Please keep your note under 500 characters."))
      .optional(),
  ),
  agree: z.literal("on", { error: "Please tick the box to continue." }),
});
export type OrderInput = z.infer<typeof orderSchema>;

// ---- A project for sale (admin) ------------------------------------------------------------------------------

export const OFFER_FIELDS = [
  "id",
  "title",
  "slug",
  "summary",
  "description",
  "techStack",
  "liveUrl",
  "caseStudySlug",
  "price",
  "status",
  "sortOrder",
] as const;

export const offerSchema = z.strictObject({
  id: z.preprocess(emptyToUndefined, z.string().refine(isObjectId, "That project isn't valid.").optional()),
  title: z
    .string({ error: "Enter a title." })
    .trim()
    .min(3, "The title is too short.")
    .max(100, "Keep the title under 100 characters."),
  slug: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .toLowerCase()
      .refine(isValidSlug, "Use lowercase letters, numbers and hyphens only.")
      .optional(),
  ),
  summary: z
    .string({ error: "Write a short summary." })
    .trim()
    .min(10, "Write at least a short sentence.")
    .max(300, "Keep the summary under 300 characters."),
  description: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(5000, "Keep the description under 5,000 characters.")
      .transform(cleanText)
      .optional(),
  ),
  techStack: z
    .preprocess(emptyToUndefined, z.string().max(600, "That list is too long.").optional())
    .transform((value) => parseTechStack(value ?? "")),
  liveUrl: z.preprocess(
    emptyToUndefined,
    z.string().trim().refine(isSafeHttpsUrl, "Enter a full link starting with https://").optional(),
  ),
  caseStudySlug: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .toLowerCase()
      .refine(isValidSlug, "Use lowercase letters, numbers and hyphens only.")
      .optional(),
  ),
  price: z
    .string({ error: "Enter the price." })
    .refine((value) => rupeesToMinor(value) !== null, "Enter the price in rupees, for example 15000.")
    .transform((value) => rupeesToMinor(value) as number),
  status: z.enum(OFFER_STATUSES, { error: "Choose a status." }),
  sortOrder: z
    .preprocess(
      emptyToUndefined,
      z
        .string()
        .regex(/^\d{1,3}$/, "Use a number from 0 to 999.")
        .optional(),
    )
    .transform((value) => (value === undefined ? 0 : Number(value))),
});
export type OfferInput = z.infer<typeof offerSchema>;

// ---- Changing a request's status (admin) ---------------------------------------------------------------------

export const STATUS_FIELDS = ["id", "to", "note"] as const;

export const statusChangeSchema = z
  .strictObject({
    id: z.string().refine(isObjectId, "That request isn't valid."),
    to: z.enum(ORDER_STATUSES, { error: "Choose a status." }),
    note: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .max(600)
        .transform(cleanText)
        .pipe(z.string().max(300, "Keep the note under 300 characters."))
        .optional(),
    ),
  })
  .refine((data) => data.to !== "rejected" || (data.note?.length ?? 0) >= 3, {
    path: ["note"],
    message: "Please write a short reason.",
  });
export type StatusChangeInput = z.infer<typeof statusChangeSchema>;
