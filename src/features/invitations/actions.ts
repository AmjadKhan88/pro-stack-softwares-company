"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthEnv, getServerEnv } from "@/lib/env";
import { logger } from "@/server/logger";
import { getAuth } from "@/server/auth/auth";
import { ForbiddenError, assertPermission } from "@/server/auth/session";
import { sendEmail } from "@/server/email/send";
import { invitationEmail } from "@/server/email/templates";
import { getMongoDb } from "@/server/db/mongo-client";
import { canAssignRole } from "@/server/policies/permissions";
import { recordAudit } from "@/features/audit/service";
import { ROLE_LABELS } from "./rules";
import { ACCEPT_FIELDS, INVITE_FIELDS, acceptSchema, inviteSchema, pickFields } from "./schema";
import { claimInvitation, createInvitation, releaseInvitation, revokeInvitation } from "./service";
import type { AcceptState, InviteState } from "./state";

function firstErrors<K extends string>(error: z.ZodError): Partial<Record<K, string>> {
  const { fieldErrors } = z.flattenError(error);
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([key, messages]) => [key, (messages as string[] | undefined)?.[0]]),
  ) as Partial<Record<K, string>>;
}

export async function inviteUser(_previous: InviteState, formData: FormData): Promise<InviteState> {
  try {
    const actor = await assertPermission("users.manage");
    const parsed = inviteSchema.safeParse(pickFields(formData, INVITE_FIELDS));
    if (!parsed.success) {
      return {
        status: "error",
        message: "Please fix the highlighted fields.",
        fieldErrors: firstErrors(parsed.error),
      };
    }
    const { email, role } = parsed.data;
    if (!canAssignRole(actor.role, role)) {
      return {
        status: "error",
        message: "You can't invite that role.",
        fieldErrors: { role: "Not allowed for your role." },
      };
    }

    const result = await createInvitation({ actor: { id: actor.id, email: actor.email }, email, role });
    if (!result.ok) {
      return {
        status: "error",
        message: "That email address already has an account.",
        fieldErrors: { email: "Already has an account." },
      };
    }

    const url = `${requireAuthEnv().baseURL}/accept-invite?token=${encodeURIComponent(result.token)}`;
    await sendEmail({
      to: email,
      ...invitationEmail({ inviterName: actor.name, roleLabel: ROLE_LABELS[role], url }),
    });

    revalidatePath("/admin/users");
    const emailConfigured = Boolean(getServerEnv().RESEND_API_KEY);
    return {
      status: "success",
      message: emailConfigured
        ? `Invitation sent to ${email}. The link works once and expires in 7 days.`
        : `Invitation created for ${email}. No email provider is configured, so the link was printed in the server console instead of being sent.`,
    };
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "invitation failed");
    return { status: "error", message: "We couldn't create the invitation. Please try again." };
  }
}

export async function revokeInvite(formData: FormData): Promise<void> {
  const actor = await assertPermission("users.manage");
  const id = formData.get("id");
  if (typeof id !== "string" || !/^[a-f0-9]{24}$/i.test(id)) return;
  await revokeInvitation(id, { id: actor.id, email: actor.email });
  revalidatePath("/admin/users");
}

export async function acceptInvite(_previous: AcceptState, formData: FormData): Promise<AcceptState> {
  const parsed = acceptSchema.safeParse(pickFields(formData, ACCEPT_FIELDS));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: firstErrors(parsed.error),
    };
  }
  const { token, name, password } = parsed.data;

  // Only one request can win this claim, so a link can never create two accounts.
  const invitation = await claimInvitation(token);
  if (!invitation) {
    return {
      status: "error",
      message: "This invitation is invalid, has expired or was already used. Ask for a new one.",
    };
  }

  try {
    const created = await getAuth().api.createUser({
      body: { email: invitation.email, password, name, role: invitation.role },
    });
    // Following the emailed link proves control of the address, so the email counts as verified.
    await getMongoDb()
      .collection("user")
      .updateOne({ email: invitation.email }, { $set: { emailVerified: true } });
    await recordAudit({
      actor: { id: created.user.id, email: invitation.email },
      action: "invitation.accepted",
      target: { type: "invitation", id: invitation.id },
      metadata: { role: invitation.role },
    });
  } catch (error) {
    await releaseInvitation(invitation.id).catch(() => undefined);
    logger.error({ err: error }, "accepting invitation failed");
    return {
      status: "error",
      message: "We couldn't create your account. Please try again or ask for a new invitation.",
    };
  }
  redirect("/login?invited=1");
}
