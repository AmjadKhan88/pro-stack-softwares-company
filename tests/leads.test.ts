import { describe, expect, it } from "vitest";
import { formDataToValues } from "@/features/leads/form-data";
import { generateReferenceCode } from "@/features/leads/reference-code";
import { inquirySchema } from "@/features/leads/schema";

const valid = {
  name: "Ayesha Khan",
  email: "Ayesha@Example.com",
  projectType: "web-app",
  message: "We need a booking system for our clinics with staff and patient logins.",
};

describe("inquiry validation", () => {
  it("accepts valid input and normalises the email", () => {
    const parsed = inquirySchema.parse(valid);
    expect(parsed.email).toBe("ayesha@example.com");
  });

  it("rejects malformed, short, oversized and unexpected input", () => {
    expect(inquirySchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
    expect(inquirySchema.safeParse({ ...valid, message: "too short" }).success).toBe(false);
    expect(inquirySchema.safeParse({ ...valid, message: "x".repeat(4001) }).success).toBe(false);
    expect(inquirySchema.safeParse({ ...valid, projectType: "hack" }).success).toBe(false);
    expect(inquirySchema.safeParse({ ...valid, role: "admin" }).success).toBe(false);
  });
});

describe("form data parsing", () => {
  it("keeps known fields, drops empty values and ignores framework fields", () => {
    const fd = new FormData();
    fd.set("name", "Ayesha");
    fd.set("company", "   ");
    fd.set("$ACTION_ID_abc", "x");
    fd.set("isAdmin", "true");
    expect(formDataToValues(fd)).toEqual({ name: "Ayesha" });
  });
});

describe("reference codes", () => {
  it("has a readable, unambiguous format and does not repeat", () => {
    const codes = new Set(Array.from({ length: 500 }, generateReferenceCode));
    expect(codes.size).toBe(500);
    for (const code of codes) expect(code).toMatch(/^PSC-[A-HJKMNP-Z2-9]{8}$/);
  });
});
