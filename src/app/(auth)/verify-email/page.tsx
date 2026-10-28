import Link from "next/link";
import { z } from "zod";
import { AuthCard } from "@/components/auth/auth-card";
import { ResendVerification } from "@/components/auth/resend-verification";

export const metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const params = await searchParams;
  const email = z.email().safeParse(params.email).data;

  if (params.error) {
    return (
      <AuthCard title="Link expired">
        <p role="alert" className="text-sm leading-relaxed">
          That verification link is invalid or has expired.{" "}
          <Link href="/login" className="text-accent font-medium hover:underline">
            Sign in
          </Link>{" "}
          and we&apos;ll send a fresh one.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Check your email"
      description={
        email
          ? `We sent a verification link to ${email}. Open it to finish signing in. It expires in 1 hour.`
          : "We sent you a verification link. Open it to finish signing in. It expires in 1 hour."
      }
      footer={
        <Link href="/login" className="text-accent font-medium hover:underline">
          Back to sign in
        </Link>
      }
    >
      {email ? <ResendVerification email={email} /> : null}
    </AuthCard>
  );
}
