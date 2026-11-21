import Link from "next/link";
import { ContentImage } from "@/components/public-site/content-image";
import { RichText } from "@/components/public-site/rich-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PublicBlock } from "@/features/content/types";

function BlockView({ block }: { block: PublicBlock }) {
  switch (block.type) {
    case "richtext":
      return <RichText source={block.text} />;
    case "image":
      return (
        <figure>
          <ContentImage image={block.image} />
          {block.caption ? (
            <figcaption className="text-muted-foreground mt-2 text-sm">{block.caption}</figcaption>
          ) : null}
        </figure>
      );
    case "steps":
      return (
        <section>
          {block.heading ? <h2 className="text-2xl font-semibold tracking-tight">{block.heading}</h2> : null}
          <ol className="mt-4 space-y-6">
            {block.items.map((step, index) => (
              <li key={`${index}-${step.title}`} className="flex gap-5">
                <span className="text-accent w-8 shrink-0 text-lg font-semibold tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">{step.title}</h3>
                  {step.description ? (
                    <p className="text-muted-foreground mt-1 leading-relaxed">{step.description}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      );
    case "technologies":
      return (
        <section>
          {block.heading ? <h2 className="text-2xl font-semibold tracking-tight">{block.heading}</h2> : null}
          <ul className="mt-4 flex flex-wrap gap-2">
            {block.items.map((item, index) => (
              <li key={`${index}-${item}`}>
                <Badge>{item}</Badge>
              </li>
            ))}
          </ul>
        </section>
      );
    case "cta": {
      // The address was already checked: only this site, https, mailto and tel get this far.
      const internal = block.buttonHref.startsWith("/");
      return (
        <section className="border-border bg-surface rounded-xl border p-6">
          <h2 className="text-xl font-semibold tracking-tight">{block.heading}</h2>
          {block.text ? <p className="text-muted-foreground mt-2 leading-relaxed">{block.text}</p> : null}
          <div className="mt-4">
            <Button asChild variant="accent">
              {internal ? (
                <Link href={block.buttonHref}>{block.buttonLabel}</Link>
              ) : (
                <a href={block.buttonHref} rel="noopener noreferrer">
                  {block.buttonLabel}
                </a>
              )}
            </Button>
          </div>
        </section>
      );
    }
  }
}

export function Blocks({ blocks }: { blocks: PublicBlock[] }) {
  return (
    <div className="space-y-8">
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
}
