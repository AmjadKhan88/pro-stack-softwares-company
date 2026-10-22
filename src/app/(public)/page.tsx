import { JsonLd } from "@/components/shared/json-ld";
import { organizationSchema, websiteSchema } from "@/features/seo/structured-data";
import { getSiteUrl } from "@/lib/seo";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { siteConfig } from "@/config/site";
import { getCaseStudies, getProcessSteps, getServices } from "@/features/content/repository";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CtaBand } from "@/components/public-site/cta-band";
import { DemoNotice } from "@/components/public-site/demo-notice";

export default async function HomePage() {
  const [services, steps, studies] = await Promise.all([getServices(), getProcessSteps(), getCaseStudies()]);
  const siteUrl = getSiteUrl();
  return (
    <>
      <JsonLd data={organizationSchema(siteUrl)} />
      <JsonLd data={websiteSchema(siteUrl)} />
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
        <Badge>Draft copy</Badge>
        <h1 className="mt-5 max-w-3xl text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl">
          Software built to solve real business problems.
        </h1>
        <p className="text-muted-foreground mt-5 max-w-xl text-base leading-relaxed">
          {siteConfig.name} designs and builds reliable software with clear communication and realistic
          delivery estimates.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="accent" size="lg">
            <Link href="/contact">
              Start a project <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/services">Explore services</Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="services" className="border-border bg-surface border-t">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="services" className="text-2xl font-semibold tracking-tight">
              What we build
            </h2>
            <Link href="/services" className="text-accent text-sm font-medium hover:underline">
              All services →
            </Link>
          </div>
          <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/services/${s.slug}`}
                  className="focus-visible:ring-accent/25 block h-full rounded-xl focus-visible:ring-4 focus-visible:outline-none"
                >
                  <Card className="bg-background hover:border-muted-foreground h-full transition-colors">
                    <CardContent className="space-y-1.5 py-5">
                      <h3 className="font-semibold">{s.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{s.summary}</p>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="process" className="mx-auto max-w-6xl px-4 py-14 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="process" className="text-2xl font-semibold tracking-tight">
            How a project runs
          </h2>
          <Link href="/process" className="text-accent text-sm font-medium hover:underline">
            Full process →
          </Link>
        </div>
        <ol className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title}>
              <span className="text-accent text-sm font-semibold tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-1 font-semibold">{s.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{s.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="work" className="border-border bg-surface border-t">
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-14 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="work" className="text-2xl font-semibold tracking-tight">
              Selected work
            </h2>
            <Link href="/work" className="text-accent text-sm font-medium hover:underline">
              All work →
            </Link>
          </div>
          <DemoNotice>Layout examples only. Real projects will replace these.</DemoNotice>
          <ul className="grid gap-4 md:grid-cols-2">
            {studies.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/work/${c.slug}`}
                  className="focus-visible:ring-accent/25 block h-full rounded-xl focus-visible:ring-4 focus-visible:outline-none"
                >
                  <Card className="bg-background hover:border-muted-foreground h-full transition-colors">
                    <CardContent className="space-y-2 py-5">
                      <Badge>{c.category}</Badge>
                      <h3 className="font-semibold">{c.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{c.summary}</p>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
