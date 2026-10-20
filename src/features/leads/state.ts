import type { InquiryValues } from "./form-data";
import type { InquiryField } from "./schema";

export type InquiryState =
  | { status: "idle" }
  | { status: "success"; referenceCode: string }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<InquiryField, string>>;
      values?: InquiryValues;
    };

export const initialInquiryState: InquiryState = { status: "idle" };
