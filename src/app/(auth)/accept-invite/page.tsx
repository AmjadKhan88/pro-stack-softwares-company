import Link from "next/link";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";
import { AuthCard } from "@/components/auth/auth-card";
import { ROLE_LABELS } from "@/features/invitations/rules";
import { peekInvitation } from "@/features/invitations/service";

export const metadata = { title: "Accept invitation" };

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const invitation =
    typeof token === "string" && token.length >= 20 && token.length <= 200
      ? await peekInvitation(token)
      : null;

  if (!invitation || !token) {
    return (
      <AuthCard title="Invitation not valid">
        <p role="alert" className="text-sm leading-relaxed">
          This invitation link is invalid, has expired or was already used. Ask the team to send you a new
          one, or{" "}
          <Link href="/login" className="text-accent font-medium hover:underline">
            sign in
          </Link>{" "}
          if you already have an account.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Accept your invitation"
      description={`You're joining as ${ROLE_LABELS[invitation.role]} with ${invitation.email}. Choose a password to finish.`}
    >
      <AcceptInviteForm token={token} />
    </AuthCard>
  );
}
