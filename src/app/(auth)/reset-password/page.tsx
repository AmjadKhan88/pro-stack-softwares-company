import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const usable = typeof token === "string" && token.length > 0 && !error;
  return (
    <AuthCard title="Choose a new password">
      {usable ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p role="alert" className="text-sm leading-relaxed">
          This reset link is invalid or has expired.{" "}
          <Link href="/forgot-password" className="text-accent font-medium hover:underline">
            Request a new one
          </Link>
          .
        </p>
      )}
    </AuthCard>
  );
}
