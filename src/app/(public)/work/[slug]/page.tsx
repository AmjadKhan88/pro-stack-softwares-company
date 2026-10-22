import { JsonLd } from "@/components/shared/json-ld";
import { breadcrumbSchema } from "@/features/seo/structured-data";
import { getSiteUrl } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCaseStudies, getCaseStudyBySlug, getServiceBySlug } from "@/features/content/repository";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/public-site/breadcrumbs";
import { CtaBand } from "@/components/public-site/cta-band";
import { DemoNotice } from "@/components/public-site/demo-notice";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getCaseStudies()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const study = await getCaseStudyBySlug(slug);
  if (!study) return {};
  return {
    title: study.title,
    description: study.summary,
    alternates: { canonical: `/work/${study.slug}` },
    robots: study.isDemo ? { index: false, follow: true } : undefined,
  };
}

export default async function CaseStudyPage({ params }: Props) {
  const { slug } = await params;
  const study = await getCaseStudyBySlug(slug);
  if (!study) notFound();
  const service = study.serviceSlug ? await getServiceBySlug(study.serviceSlug) : null;
  const siteUrl = getSiteUrl();
  return (
    <>
      <JsonLd
        data={breadcrumbSchema(siteUrl, [
          { name: "Home", path: "/" },
          { name: "Work", path: "/work" },
          { name: study.title, path: `/work/${study.slug}` },
        ])}
      />
      <article className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-8">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Work", href: "/work" }, { label: study.title }]}
        />
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
          <p className="leading-relaxed">{study.challenge}</p>
        </section>

        <section aria-labelledby="approach" className="space-y-2">
          <h2 id="approach" className="text-xl font-semibold tracking-tight">
            Our approach
          </h2>
          <p className="leading-relaxed">{study.approach}</p>
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
      </article>
      <CtaBand />
    </>
  );
}
