import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { TwoFactorSetup } from "@/components/auth/two-factor-setup";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { requireUser } from "@/server/auth/session";
import { requiresTwoFactor } from "@/server/policies/permissions";

export const metadata = { title: "Two-factor authentication" };

export default async function TwoFactorSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = safeRedirectPath(next) ?? "/continue";
  const user = await requireUser("/security/two-factor");

  if (user.twoFactorEnabled) {
    return (
      <AuthCard title="Two-factor authentication is on">
        <p className="text-sm leading-relaxed">Your account is protected with an authenticator app.</p>
        <Link href={target} className="text-accent mt-4 inline-block text-sm font-medium hover:underline">
          Continue
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set up two-factor authentication"
      description={
        requiresTwoFactor(user.role)
          ? "Two-factor authentication is required for your role before you can use the workspace."
          : "Add a second step to sign-in using an authenticator app."
      }
      className="max-w-xl"
    >
      <TwoFactorSetup next={target} />
    </AuthCard>
  );
}
