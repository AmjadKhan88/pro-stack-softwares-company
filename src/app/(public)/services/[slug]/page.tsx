import { JsonLd } from "@/components/shared/json-ld";
import { breadcrumbSchema, serviceSchema } from "@/features/seo/structured-data";
import { getSiteUrl } from "@/lib/seo";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  getCaseStudies,
  getServiceBySlug,
  getServiceRedirect,
  getServices,
} from "@/features/content/repository";
import { Breadcrumbs } from "@/components/public-site/breadcrumbs";
import { CtaBand } from "@/components/public-site/cta-band";
import { ServiceDetailBody } from "@/components/public-site/service-detail";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = (await getServices()).map((s) => ({ slug: s.slug }));
  // Next.js needs at least one known address to check the route at build time. Unknown addresses
  // (including ones published later) are rendered on request and then cached.
  return slugs.length > 0 ? slugs : [{ slug: "not-found" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) return {};
  return {
    title: service.seo?.title ?? service.title,
    description: service.seo?.description ?? service.summary,
    alternates: { canonical: `/services/${service.slug}` },
    robots: service.isDemo || service.seo?.noindex ? { index: false, follow: true } : undefined,
  };
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) {
    // A renamed service keeps working: send visitors and search engines to its new address.
    const target = await getServiceRedirect(slug);
    if (target) permanentRedirect(`/services/${target}`);
    notFound();
  }
  const related = (await getCaseStudies()).filter((c) => c.serviceSlug === service.slug);
  const siteUrl = getSiteUrl();
  return (
    <>
      <JsonLd
        data={breadcrumbSchema(siteUrl, [
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
          { name: service.title, path: `/services/${service.slug}` },
        ])}
      />
      {!service.isDemo ? <JsonLd data={serviceSchema(siteUrl, service)} /> : null}
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Services", href: "/services" },
            { label: service.title },
          ]}
        />
        <ServiceDetailBody service={service} related={related} />
      </div>
      <CtaBand />
    </>
  );
}
