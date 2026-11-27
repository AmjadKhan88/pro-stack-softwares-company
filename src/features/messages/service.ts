import "server-only";
import mongoose from "mongoose";
import { notifyMessage } from "@/features/notifications/events";
import { projectRoom } from "@/lib/realtime/contract";
import { scheduleRealtimeEmit } from "@/server/realtime/emit";
import { organizationNamesById } from "@/features/organizations/names";
import { Project } from "@/features/projects/models/project";
import { isObjectId } from "@/lib/object-id";
import { connectToDatabase } from "@/server/db/mongoose";
import type { ConversationProject } from "./access";
import { Message } from "./models/message";
import { THREAD_SIZE, type Side } from "./rules";
import type { ConversationRow, MessageView } from "./state";

/** Saves the message and tells the other side in ONE transaction, so neither can exist without the other. */
export async function postMessage(input: {
  project: ConversationProject;
  author: { id: string; name: string; side: Side };
  body: string;
}): Promise<void> {
  await connectToDatabase();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Message.create(
        [
          {
            projectId: input.project.id,
            organizationId: input.project.organizationId,
            authorId: input.author.id,
            authorName: input.author.name.slice(0, 100),
            authorType: input.author.side,
            body: input.body,
          },
        ],
        { session },
      );
      await notifyMessage({
        projectId: input.project.id,
        side: input.author.side,
        actorId: input.author.id,
        session,
      });
    });
    // Only after the transaction has committed: tell anyone with this conversation open to look again.
    scheduleRealtimeEmit([
      {
        room: projectRoom(input.project.id),
        event: "message.created",
        data: { projectId: input.project.id },
      },
    ]);
  } finally {
    await session.endSession();
  }
}

/** The latest messages of a conversation, oldest first. The caller must already have authorized the project. */
export async function listMessages(
  projectId: string,
  viewerId: string,
): Promise<{ messages: MessageView[]; hasMore: boolean }> {
  await connectToDatabase();
  const docs = await Message.find({ projectId })
    .sort({ createdAt: -1 })
    .limit(THREAD_SIZE + 1)
    .lean();
  const hasMore = docs.length > THREAD_SIZE;
  const messages = docs
    .slice(0, THREAD_SIZE)
    .reverse()
    .map((doc) => ({
      id: String(doc._id),
      authorName: doc.authorName,
      authorType: doc.authorType,
      body: doc.body,
      createdAt: (doc as unknown as { createdAt: Date }).createdAt,
      mine: doc.authorId === viewerId,
    }));
  return { messages, hasMore };
}

/** Conversations that have at least one message. `projectIds` null means every project; otherwise only those. */
export async function listConversations(projectIds: string[] | null): Promise<ConversationRow[]> {
  await connectToDatabase();
  const groups = await Message.aggregate<{
    _id: string;
    last: Date;
    count: number;
    lastAuthorType: "client" | "staff";
  }>([
    { $match: projectIds ? { projectId: { $in: projectIds.filter(isObjectId) } } : {} },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id: "$projectId",
        last: { $last: "$createdAt" },
        count: { $sum: 1 },
        lastAuthorType: { $last: "$authorType" },
      },
    },
    { $sort: { last: -1 } },
    { $limit: 100 },
  ]);
  if (groups.length === 0) return [];

  const projects = await Project.find({ _id: { $in: groups.map((group) => group._id).filter(isObjectId) } })
    .select("title organizationId")
    .lean();
  const byId = new Map(projects.map((project) => [String(project._id), project]));
  const orgNames = await organizationNamesById(projects.map((project) => project.organizationId));

  return groups
    .filter((group) => byId.has(group._id))
    .map((group) => {
      const project = byId.get(group._id)!;
      return {
        projectId: group._id,
        projectTitle: project.title,
        organizationName: orgNames.get(project.organizationId) ?? null,
        count: group.count,
        lastAt: group.last,
        lastAuthorType: group.lastAuthorType,
      };
    });
}
