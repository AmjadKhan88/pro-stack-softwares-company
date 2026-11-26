import "server-only";
import { notifyNewWebsiteLead } from "@/features/notifications/events";
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
      const created = await Lead.create({
        ...input,
        referenceCode,
        ipHash,
        source: "contact-form",
        status: "new",
      });
      // Tell the team. This never blocks or breaks the visitor's submission.
      await notifyNewWebsiteLead({ id: String(created._id), label: input.company || input.name });
      return { referenceCode };
    } catch (error) {
      if (isDuplicateKey(error) && attempt < 4) continue; // code collision: try another
      throw error;
    }
  }
  throw new Error("Could not allocate a unique reference code");
}
