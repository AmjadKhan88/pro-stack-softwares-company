import { INQUIRY_FIELDS, type InquiryField } from "./schema";

export type InquiryValues = Partial<Record<InquiryField, string>>;

/** Picks only known fields. Next.js adds internal "$ACTION_*" entries to FormData; we ignore them. */
export function formDataToValues(formData: FormData): InquiryValues {
  const values: InquiryValues = {};
  for (const field of INQUIRY_FIELDS) {
    const raw = formData.get(field);
    if (typeof raw === "string" && raw.trim() !== "") values[field] = raw;
  }
  return values;
}