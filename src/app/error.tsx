"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

export default function GlobalSegmentError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    // Phase 8 wires this to error tracking. Never show raw error details to users.
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-16">
      <ErrorState action={<Button onClick={() => retry()}>Try again</Button>} />
    </main>
  );
}
