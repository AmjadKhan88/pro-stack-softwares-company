import Link from "next/link";
import type { CaseStudy, Service } from "@/features/content/types";
import { Badge } from "@/components/ui/badge";
import { DemoNotice } from "@/components/public-site/demo-notice";

/** Paragraphs are separated by blank lines. Text is rendered as text, never as HTML. */
function Paragraphs({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="leading-relaxed whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </>
  );
}

export function CaseStudyBody({ study, service }: { study: CaseStudy; service: Service | null }) {
  return (
    <>
      <header className="space-y-3">
        <Badge>{study.category}</Badge>
        <h1 className="text-4xl font-semibold tracking-tight">{study.title}</h1>
        <p className="text-muted-foreground text-base leading-relaxed">{study.summary}</p>
      </header>
      {study.isDemo ? (
        <DemoNotice>This case study is a layout example, not a real client project.</DemoNotice>
      ) : null}

      <section aria-labelledby="challenge" className="space-y-2">
        <h2 id="challenge" className="text-xl font-semibold tracking-tight">
          The challenge
        </h2>
        <Paragraphs text={study.challenge} />
      </section>

      <section aria-labelledby="approach" className="space-y-2">
        <h2 id="approach" className="text-xl font-semibold tracking-tight">
          Our approach
        </h2>
        <Paragraphs text={study.approach} />
      </section>

      <section aria-labelledby="features" className="space-y-3">
        <h2 id="features" className="text-xl font-semibold tracking-tight">
          Core features
        </h2>
        <ul className="list-disc space-y-1.5 pl-5">
          {study.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="stack" className="space-y-3">
        <h2 id="stack" className="text-xl font-semibold tracking-tight">
          Technology
        </h2>
        <ul className="flex flex-wrap gap-2">
          {study.stack.map((t) => (
            <li key={t}>
              <Badge>{t}</Badge>
            </li>
          ))}
        </ul>
      </section>

      {/* Shown only when real, verified results exist. */}
      {study.outcomes.length > 0 ? (
        <section aria-labelledby="outcomes" className="space-y-3">
          <h2 id="outcomes" className="text-xl font-semibold tracking-tight">
            Verified outcomes
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            {study.outcomes.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {service ? (
        <p className="text-sm">
          Related service:{" "}
          <Link href={`/services/${service.slug}`} className="text-accent font-medium hover:underline">
            {service.title}
          </Link>
        </p>
      ) : null}
    </>
  );
}
