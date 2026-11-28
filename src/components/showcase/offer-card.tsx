import Link from "next/link";
import { formatPkr } from "@/features/showcase/rules";
import type { PublicOffer } from "@/features/showcase/types";

export function OfferCard({ offer }: { offer: PublicOffer }) {
  return (
    <article className="border-border bg-surface flex flex-col gap-4 rounded-2xl border p-6">
      <div
        className="bg-accent/10 text-accent grid h-24 place-items-center rounded-xl text-4xl font-semibold"
        aria-hidden
      >
        {offer.title.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">
          <Link href={`/showcase/${offer.slug}`} className="hover:underline">
            {offer.title}
          </Link>
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">{offer.summary}</p>
        {offer.techStack.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Technologies">
            {offer.techStack.map((tech) => (
              <li key={tech} className="bg-surface-muted rounded-full px-2.5 py-0.5 text-xs">
                {tech}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">
          <span className="text-muted-foreground">Source code </span>
          <span className="font-semibold tabular-nums">{formatPkr(offer.priceMinor)}</span>
        </p>
        <Link href={`/showcase/${offer.slug}`} className="text-accent text-sm font-medium hover:underline">
          View details →
        </Link>
      </div>
    </article>
  );
}
