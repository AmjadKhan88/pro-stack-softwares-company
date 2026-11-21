import Link from "next/link";
import { parseRichText, type BlockNode, type Inline } from "@/features/cms/richtext";
import { cn } from "@/lib/utils";

function Inlines({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((item, index) => (
        <InlineView key={index} item={item} />
      ))}
    </>
  );
}

function InlineView({ item }: { item: Inline }) {
  switch (item.type) {
    case "text":
      return <>{item.text}</>;
    case "strong":
      return (
        <strong className="font-semibold">
          <Inlines items={item.children} />
        </strong>
      );
    case "em":
      return (
        <em>
          <Inlines items={item.children} />
        </em>
      );
    case "code":
      return <code className="bg-surface-muted rounded px-1 py-0.5 text-[0.9em]">{item.text}</code>;
    case "link": {
      const className = "text-accent font-medium underline-offset-2 hover:underline";
      // The address was already checked: only this site, https, mailto and tel get this far.
      if (item.href.startsWith("/")) {
        return (
          <Link href={item.href} className={className}>
            <Inlines items={item.children} />
          </Link>
        );
      }
      return (
        <a href={item.href} className={className} rel="noopener noreferrer">
          <Inlines items={item.children} />
        </a>
      );
    }
  }
}

function NodeView({ node }: { node: BlockNode }) {
  switch (node.type) {
    case "paragraph":
      return (
        <p>
          <Inlines items={node.children} />
        </p>
      );
    case "heading":
      return node.level === 2 ? (
        <h2 className="pt-4 text-2xl font-semibold tracking-tight">
          <Inlines items={node.children} />
        </h2>
      ) : (
        <h3 className="pt-2 text-xl font-semibold tracking-tight">
          <Inlines items={node.children} />
        </h3>
      );
    case "list": {
      const items = node.items.map((children, index) => (
        <li key={index}>
          <Inlines items={children} />
        </li>
      ));
      return node.ordered ? (
        <ol className="list-decimal space-y-1.5 pl-6">{items}</ol>
      ) : (
        <ul className="list-disc space-y-1.5 pl-6">{items}</ul>
      );
    }
    case "quote":
      return (
        <blockquote className="border-border text-muted-foreground border-l-4 pl-4 italic">
          <Inlines items={node.children} />
        </blockquote>
      );
  }
}

/** Draws rich text. Text is only ever drawn as text; there is no way to produce HTML from here. */
export function RichText({ source, className }: { source: string; className?: string }) {
  const nodes = parseRichText(source);
  return (
    <div className={cn("space-y-4 leading-relaxed", className)}>
      {nodes.map((node, index) => (
        <NodeView key={index} node={node} />
      ))}
    </div>
  );
}
