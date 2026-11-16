import Link from "next/link";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  href,
  attention = false,
}: {
  label: string;
  value: number;
  hint?: string;
  href?: string;
  /** Highlights a number that needs someone to act. */
  attention?: boolean;
}) {
  const body = (
    <>
      <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">{label}</p>
      <p
        className={cn(
          "mt-2 text-3xl font-semibold tracking-tight tabular-nums",
          attention && value > 0 && "text-accent",
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
    </>
  );
  return (
    <div role="group" aria-label={label} className="border-border bg-surface rounded-xl border">
      {href ? (
        <Link
          href={href}
          className="hover:bg-surface-muted focus-visible:ring-accent/25 block rounded-xl p-5 transition-colors focus-visible:ring-4 focus-visible:outline-none"
        >
          {body}
        </Link>
      ) : (
        <div className="p-5">{body}</div>
      )}
    </div>
  );
}
