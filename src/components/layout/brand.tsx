import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export function Brand({
  sublabel,
  inverse = false,
  href = "/",
}: {
  sublabel?: string;
  inverse?: boolean;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="focus-visible:ring-accent/25 flex items-center gap-2.5 rounded-md focus-visible:ring-4 focus-visible:outline-none"
    >
      <span
        aria-hidden
        className="bg-ember-500 text-ink-950 grid size-9 place-items-center rounded-[10px] text-base font-semibold"
      >
        P
      </span>
      <span className="leading-none">
        <span
          className={cn(
            "block text-[15px] font-semibold tracking-tight",
            inverse ? "text-bone-50" : "text-foreground",
          )}
        >
          {siteConfig.name}
        </span>
        {sublabel ? (
          <span
            className={cn(
              "mt-1 block text-[10px] tracking-[0.2em] uppercase",
              inverse ? "text-bone-400" : "text-muted-foreground",
            )}
          >
            {sublabel}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
