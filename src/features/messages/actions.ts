"use server";

import { revalidatePath } from "next/cache";
import { logger } from "@/server/logger";
import { hashIdentifier } from "@/server/security/ip";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { authorizeConversation } from "./access";
import { MESSAGE_LIMIT, MESSAGE_WINDOW_SECONDS, canClientMessage } from "./rules";
import { SEND_FIELDS, pickFields, sendMessageSchema } from "./schema";
import { postMessage } from "./service";
import type { MessageState } from "./state";

/** Sends a message. Who the person is, and which side they are on, come from their account, never from the form. */
export async function sendMessageAction(_previous: MessageState, formData: FormData): Promise<MessageState> {
  const raw = pickFields(formData, SEND_FIELDS);
  const typed = typeof raw.body === "string" ? raw.body : "";

  const parsed = sendMessageSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Please check your message.",
      body: typed,
    };
  }

  try {
    const access = await authorizeConversation(parsed.data.projectId);
    if (!access.ok) return { status: "error", message: "That conversation isn't available.", body: typed };
    if (access.side === "client" && !canClientMessage(access.project.status)) {
      return { status: "error", message: "This project is closed, so messages can't be sent.", body: typed };
    }

    const limit = await consumeRateLimit({
      scope: "message",
      identifier: hashIdentifier(access.user.id),
      limit: MESSAGE_LIMIT,
      windowSeconds: MESSAGE_WINDOW_SECONDS,
    });
    if (!limit.allowed) {
      return {
        status: "error",
        message: "You've sent a lot of messages. Please wait a few minutes.",
        body: typed,
      };
    }

    await postMessage({
      project: access.project,
      author: { id: access.user.id, name: access.user.name, side: access.side },
      body: parsed.data.body,
    });
    revalidatePath(`/portal/projects/${access.project.id}/messages`);
    revalidatePath(`/admin/projects/${access.project.id}/messages`);
    revalidatePath("/admin/messages");
    return { status: "success", sent: Date.now() };
  } catch (error) {
    logger.error({ err: error }, "sending a message failed");
    return { status: "error", message: "We couldn't send your message. Please try again.", body: typed };
  }
}
