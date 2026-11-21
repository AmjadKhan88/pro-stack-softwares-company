import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { CmsPageView } from "@/components/public-site/cms-page-view";
import { CtaBand } from "@/components/public-site/cta-band";
import { PageIntro } from "@/components/public-site/page-intro";
import { cmsPageMetadata } from "@/features/content/metadata";
import { getPage } from "@/features/content/repository";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("about");
  if (page) return cmsPageMetadata(page);
  return {
    title: "About",
    description: `About ${siteConfig.name}, a software company based in ${siteConfig.location}.`,
    alternates: { canonical: "/about" },
  };
}

const principles = [
  { title: "Technical competence", body: "We choose proven tools and build things that are maintainable." },
  {
    title: "Honest communication",
    body: "We tell you what is going well, what is not, and what we do not yet know.",
  },
  {
    title: "Realistic estimates",
    body: "We would rather give you a trustworthy timeline than an optimistic one.",
  },
  { title: "Careful delivery", body: "We test what matters and release deliberately." },
];

export default async function AboutPage() {
  const page = await getPage("about");
  if (page) return <CmsPageView page={page} />;
  return (
    <>
      <PageIntro
        eyebrow="About"
        title={`About ${siteConfig.name}`}
        description={`A software company based in ${siteConfig.location}, building reliable software for real business problems.`}
      />
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12 sm:px-8">
        <section aria-labelledby="principles">
          <h2 id="principles" className="text-2xl font-semibold tracking-tight">
            How we work
          </h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {principles.map((p) => (
              <li key={p.title} className="border-border bg-surface rounded-xl border p-5">
                <h3 className="font-semibold">{p.title}</h3>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{p.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="story" className="max-w-2xl">
          <h2 id="story" className="text-2xl font-semibold tracking-tight">
            Our story
          </h2>
          <p className="border-border text-muted-foreground mt-4 rounded-xl border border-dashed p-5 text-sm leading-relaxed">
            Placeholder: add the story of the company, who is behind it and why it exists. Only include facts
            you can stand behind. (Publish a page with the address &ldquo;about&rdquo; in the admin to replace
            this page.)
          </p>
        </section>
      </div>
      <CtaBand />
    </>
  );
}
