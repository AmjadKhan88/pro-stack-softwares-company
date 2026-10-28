import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { TwoFactorForm } from "@/components/auth/two-factor-form";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/server/auth/session";

export const metadata = { title: "Two-factor verification" };

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/continue");
  const { next } = await searchParams;
  const target = safeRedirectPath(next);
  return (
    <AuthCard
      title="Two-factor verification"
      description="Enter the code from your authenticator app to finish signing in."
    >
      <TwoFactorForm next={target ? `/continue?next=${encodeURIComponent(target)}` : "/continue"} />
    </AuthCard>
  );
}
