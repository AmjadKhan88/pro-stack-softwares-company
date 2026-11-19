import { JsonLd } from "@/components/shared/json-ld";
import { breadcrumbSchema } from "@/features/seo/structured-data";
import { getSiteUrl } from "@/lib/seo";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  getCaseStudies,
  getCaseStudyBySlug,
  getCaseStudyRedirect,
  getServiceBySlug,
} from "@/features/content/repository";
import { Breadcrumbs } from "@/components/public-site/breadcrumbs";
import { CaseStudyBody } from "@/components/public-site/case-study-detail";
import { CtaBand } from "@/components/public-site/cta-band";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = (await getCaseStudies()).map((c) => ({ slug: c.slug }));
  // Next.js needs at least one known address to check the route at build time. Unknown addresses
  // (including ones published later) are rendered on request and then cached.
  return slugs.length > 0 ? slugs : [{ slug: "not-found" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const study = await getCaseStudyBySlug(slug);
  if (!study) return {};
  return {
    title: study.seo?.title ?? study.title,
    description: study.seo?.description ?? study.summary,
    alternates: { canonical: `/work/${study.slug}` },
    robots: study.isDemo || study.seo?.noindex ? { index: false, follow: true } : undefined,
  };
}

export default async function CaseStudyPage({ params }: Props) {
  const { slug } = await params;
  const study = await getCaseStudyBySlug(slug);
  if (!study) {
    // A renamed case study keeps working: send visitors and search engines to its new address.
    const target = await getCaseStudyRedirect(slug);
    if (target) permanentRedirect(`/work/${target}`);
    notFound();
  }
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
        <CaseStudyBody study={study} service={service} />
      </article>
      <CtaBand />
    </>
  );
}
