import { Lock } from "lucide-react";

export function AccessNotice({ area }: { area: string }) {
  return (
    <div role="note" className="border-border bg-surface flex items-start gap-3 rounded-xl border p-4">
      <Lock className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="text-sm leading-relaxed">
        <span className="font-medium">Sign-in is not available yet.</span>{" "}
        <span className="text-muted-foreground">
          Authentication and access control arrive in Phase 3. This {area} shell shows no real data and must
          not be treated as protected.
        </span>
      </p>
    </div>
  );
}
