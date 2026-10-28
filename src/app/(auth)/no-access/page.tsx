import { AuthCard } from "@/components/auth/auth-card";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "No access" };

export default async function NoAccessPage() {
  await requireUser("/no-access");
  return (
    <AuthCard
      title="No access yet"
      description="Your account is signed in but hasn't been given access to the portal or the workspace. Please contact the team."
    >
      <SignOutButton className="text-foreground text-sm" />
    </AuthCard>
  );
}
