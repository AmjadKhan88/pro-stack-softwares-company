"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function ResendVerification({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "pending" | "sent">("idle");

  async function resend() {
    setState("pending");
    await authClient.sendVerificationEmail({ email, callbackURL: "/continue" });
    setState("sent");
  }

  return state === "sent" ? (
    <p role="status" className="text-sm">
      If that address needs verifying, a new link is on its way.
    </p>
  ) : (
    <Button type="button" variant="outline" onClick={resend} disabled={state === "pending"}>
      {state === "pending" ? "Sending…" : "Send a new link"}
    </Button>
  );
}
