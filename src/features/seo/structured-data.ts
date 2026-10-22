import { siteConfig } from "@/config/site";

const CONTEXT = "https://schema.org";

// Only facts we actually have. No ratings, reviews, awards, logos or social profiles are invented.
export function organizationSchema(siteUrl: string) {
  return {
    "@context": CONTEXT,
    "@type": "ProfessionalService",
    "@id": `${siteUrl}/#organization`,
    name: siteConfig.name,
    url: siteUrl,
    description: siteConfig.description,
    email: siteConfig.email,
    telephone: siteConfig.phoneTel,
    address: { "@type": "PostalAddress", addressLocality: "Peshawar", addressCountry: "PK" },
  };
}

export function websiteSchema(siteUrl: string) {
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: siteConfig.name,
    url: siteUrl,
    publisher: { "@id": `${siteUrl}/#organization` },
  };
}

export function breadcrumbSchema(siteUrl: string, items: { name: string; path: string }[]) {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${siteUrl}${item.path}`,
    })),
  };
}

/** Render only for real (non-sample) services. */
export function serviceSchema(
  siteUrl: string,
  service: { slug: string; title: string; description: string },
) {
  return {
    "@context": CONTEXT,
    "@type": "Service",
    name: service.title,
    description: service.description,
    url: `${siteUrl}/services/${service.slug}`,
    provider: { "@id": `${siteUrl}/#organization` },
  };
}

/** Render only when the questions and answers are real and visible on the page. */
export function faqSchema(items: { question: string; answer: string }[]) {
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
