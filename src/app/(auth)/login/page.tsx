import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/server/auth/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  if (await getCurrentUser()) redirect("/continue");
  const params = await searchParams;
  return (
    <AuthCard title="Sign in" description="Access the client portal or the team workspace.">
      <LoginForm
        next={safeRedirectPath(params.next)}
        notice={params.reset === "1" ? "Your password was updated. Sign in with the new password." : null}
      />
    </AuthCard>
  );
}
