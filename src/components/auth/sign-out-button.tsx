"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className={cn(
        "focus-visible:ring-accent/25 inline-flex items-center gap-1.5 rounded-md text-xs font-medium underline-offset-2 hover:underline focus-visible:ring-4 focus-visible:outline-none disabled:opacity-60",
        className,
      )}
    >
      <LogOut className="size-3.5" aria-hidden />
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
