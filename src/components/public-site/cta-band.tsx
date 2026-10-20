import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CtaBand({
  title = "Have a project in mind?",
  description = "Tell us what you're trying to build and we'll reply by email.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="border-border bg-surface border-t">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-12 sm:px-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="text-muted-foreground mt-2 max-w-lg text-sm leading-relaxed">{description}</p>
        </div>
        <Button asChild variant="accent" size="lg">
          <Link href="/contact">Start a conversation</Link>
        </Button>
      </div>
    </section>
  );
}
