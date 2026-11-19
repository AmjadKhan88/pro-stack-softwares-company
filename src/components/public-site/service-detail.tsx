import Link from "next/link";
import type { CaseStudy, Service } from "@/features/content/types";
import { DemoNotice } from "@/components/public-site/demo-notice";

export function ServiceDetailBody({ service, related }: { service: Service; related: CaseStudy[] }) {
  return (
    <>
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight">{service.title}</h1>
      <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">{service.description}</p>
      {service.isDemo ? <DemoNotice>Draft description for this service.</DemoNotice> : null}

      <section aria-labelledby="deliverables" className="pt-4">
        <h2 id="deliverables" className="text-xl font-semibold tracking-tight">
          What you get
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {service.deliverables.map((d) => (
            <li key={d} className="border-border bg-surface rounded-lg border px-4 py-3 text-sm">
              {d}
            </li>
          ))}
        </ul>
      </section>

      {related.length > 0 ? (
        <section aria-labelledby="related" className="pt-4">
          <h2 id="related" className="text-xl font-semibold tracking-tight">
            Related work
          </h2>
          <ul className="mt-4 space-y-2">
            {related.map((c) => (
              <li key={c.slug}>
                <Link href={`/work/${c.slug}`} className="text-accent font-medium hover:underline">
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
