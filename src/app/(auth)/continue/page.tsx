import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { homeFor } from "@/server/policies/access";
import { getCurrentUser } from "@/server/auth/session";

export const metadata = { title: "Continue" };

/** Post-login router: sends each person to the area their role belongs to (or the page they asked for). */
export default async function ContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}): Promise<never> {
  const { next, error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(error ? "/verify-email?error=1" : "/login");
  redirect(safeRedirectPath(next) ?? homeFor(user.role));
}
