import "server-only";
import mongoose from "mongoose";
import { recordAudit } from "@/features/audit/service";
import { isObjectId } from "@/lib/object-id";
import { connectToDatabase } from "@/server/db/mongoose";
import { clientRequestStatus } from "./client-view";
import { Lead } from "./models/lead";
import { LeadActivity } from "./models/lead-activity";
import { normalizeLeadStatus, type LeadStatus } from "./pipeline";
import type { PortalRequestInput } from "./request-schema";
import { generateReferenceCode } from "./reference-code";
import type { PROJECT_TYPES } from "./schema";

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

/**
 * A signed-in client asks for a new project. It becomes a lead already linked to their organization, so staff can
 * qualify it and write a proposal. The lead, its history note and the audit record commit together.
 */
export async function createPortalRequest(input: {
  organization: { id: string; name: string };
  user: { id: string; name: string; email: string };
  content: PortalRequestInput;
}): Promise<{ referenceCode: string }> {
  await connectToDatabase();
  for (let attempt = 0; attempt < 3; attempt++) {
    const session = await mongoose.startSession();
    try {
      const referenceCode = generateReferenceCode();
      await session.withTransaction(async () => {
        const [lead] = await Lead.create(
          [
            {
              referenceCode,
              name: input.user.name.slice(0, 100),
              email: input.user.email,
              company: input.organization.name.slice(0, 120),
              projectType: input.content.projectType,
              budgetRange: input.content.budgetRange,
              timeframe: input.content.timeframe,
              message: input.content.message,
              status: "new" as const,
              organizationId: input.organization.id,
              requestedBy: input.user.id,
              source: "client-portal",
            },
          ],
          { session },
        );
        const leadId = String(lead._id);
        await LeadActivity.create(
          [
            {
              leadId,
              type: "note" as const,
              body: `Submitted from the client portal by ${input.user.name} for ${input.organization.name}.`,
              actorId: input.user.id,
              actorEmail: input.user.email,
            },
          ],
          { session },
        );
        await recordAudit(
          {
            actor: { id: input.user.id, email: input.user.email },
            action: "lead.created_from_portal",
            target: { type: "lead", id: leadId },
            metadata: { referenceCode, organizationId: input.organization.id },
          },
          session,
        );
      });
      return { referenceCode };
    } catch (error) {
      if (isDuplicateKey(error) && attempt < 2) continue; // reference code collision: try another
      throw error;
    } finally {
      await session.endSession();
    }
  }
  throw new Error("Could not allocate a unique reference code");
}

export interface ClientRequestRow {
  referenceCode: string;
  projectType: (typeof PROJECT_TYPES)[number];
  status: LeadStatus;
  preview: string;
  createdAt: Date;
}

/** Requests sent from the portal by the client's own organization. Only fields a client may see are returned. */
export async function listClientRequests(organizationId: string): Promise<ClientRequestRow[]> {
  if (!isObjectId(organizationId)) return [];
  await connectToDatabase();
  const docs = await Lead.find({
    organizationId,
    source: "client-portal",
    archivedAt: { $exists: false },
  })
    .select("referenceCode projectType status message createdAt")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return docs.map((doc) => ({
    referenceCode: doc.referenceCode,
    projectType: doc.projectType,
    status: normalizeLeadStatus(doc.status),
    preview: doc.message.length > 160 ? `${doc.message.slice(0, 160)}…` : doc.message,
    createdAt: (doc as unknown as { createdAt: Date }).createdAt,
  }));
}

export { clientRequestStatus };
