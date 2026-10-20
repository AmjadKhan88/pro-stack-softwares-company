import "server-only";
import { connectToDatabase } from "@/server/db/mongoose";
import { Lead } from "./models/lead";
import { generateReferenceCode } from "./reference-code";
import type { InquiryInput } from "./schema";

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function createLead(input: InquiryInput, ipHash: string): Promise<{ referenceCode: string }> {
  await connectToDatabase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const referenceCode = generateReferenceCode();
    try {
      await Lead.create({ ...input, referenceCode, ipHash, source: "contact-form", status: "new" });
      return { referenceCode };
    } catch (error) {
      if (isDuplicateKey(error) && attempt < 4) continue; // code collision: try another
      throw error;
    }
  }
  throw new Error("Could not allocate a unique reference code");
}
