import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCaseStudies, getServiceBySlug, getServices } from "@/features/content/repository";
import { Breadcrumbs } from "@/components/public-site/breadcrumbs";
import { CtaBand } from "@/components/public-site/cta-band";
import { DemoNotice } from "@/components/public-site/demo-notice";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getServices()).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) return {};
  return {
    title: service.title,
    description: service.summary,
    alternates: { canonical: `/services/${service.slug}` },
    robots: service.isDemo ? { index: false, follow: true } : undefined,
  };
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) notFound();
  const related = (await getCaseStudies()).filter((c) => c.serviceSlug === service.slug);

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Services", href: "/services" },
            { label: service.title },
          ]}
        />
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
      </div>
      <CtaBand />
    </>
  );
}
