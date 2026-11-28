"use client";

import { useState } from "react";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* the number is visible, so it can still be copied by hand */
        }
      }}
      className="border-border text-muted-foreground hover:text-foreground focus-visible:ring-accent/25 rounded-md border px-2 py-0.5 text-xs focus-visible:ring-4 focus-visible:outline-none"
      aria-label={`Copy ${label}`}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
