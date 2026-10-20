import { z } from "zod";

export const PROJECT_TYPES = [
  "website",
  "web-app",
  "mobile-app",
  "ecommerce",
  "internal-tool",
  "integration",
  "other",
] as const;
export const BUDGET_RANGES = ["under-1k", "1k-5k", "5k-15k", "15k-plus", "unsure"] as const;
export const TIMEFRAMES = ["asap", "1-3-months", "3-6-months", "flexible"] as const;

// Edit these labels freely (e.g. change the currency) without touching validation.
export const projectTypeLabels: Record<(typeof PROJECT_TYPES)[number], string> = {
  website: "Website",
  "web-app": "Web application",
  "mobile-app": "Mobile app",
  ecommerce: "E-commerce",
  "internal-tool": "Internal tool or dashboard",
  integration: "API or integration",
  other: "Something else",
};
export const budgetLabels: Record<(typeof BUDGET_RANGES)[number], string> = {
  "under-1k": "Under $1,000",
  "1k-5k": "$1,000 – $5,000",
  "5k-15k": "$5,000 – $15,000",
  "15k-plus": "$15,000+",
  unsure: "Not sure yet",
};
export const timeframeLabels: Record<(typeof TIMEFRAMES)[number], string> = {
  asap: "As soon as possible",
  "1-3-months": "1–3 months",
  "3-6-months": "3–6 months",
  flexible: "Flexible",
};

export const INQUIRY_FIELDS = [
  "name",
  "email",
  "company",
  "projectType",
  "budgetRange",
  "timeframe",
  "message",
] as const;
export type InquiryField = (typeof INQUIRY_FIELDS)[number];

export const inquirySchema = z.strictObject({
  name: z.string().trim().min(2, "Enter your name.").max(100, "Name is too long."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Email is too long.")
    .pipe(z.email("Enter a valid email address.")),
  company: z.string().trim().max(120, "Company name is too long.").optional(),
  projectType: z.enum(PROJECT_TYPES, { error: "Choose a project type." }),
  budgetRange: z.enum(BUDGET_RANGES, { error: "Choose a budget range." }).optional(),
  timeframe: z.enum(TIMEFRAMES, { error: "Choose a timeframe." }).optional(),
  message: z
    .string()
    .trim()
    .min(20, "Please describe your project in at least 20 characters.")
    .max(4000, "Please keep the description under 4,000 characters."),
});

export type InquiryInput = z.infer<typeof inquirySchema>;
