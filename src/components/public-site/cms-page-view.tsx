import { Blocks } from "@/components/public-site/blocks";
import { CtaBand } from "@/components/public-site/cta-band";
import { PageIntro } from "@/components/public-site/page-intro";
import { siteConfig } from "@/config/site";
import type { CmsPage } from "@/features/content/types";

const EYEBROWS: Record<string, string> = {
  privacy: "Legal",
  terms: "Legal",
  about: "About",
  process: "Process",
};

export function CmsPageView({ page }: { page: CmsPage }) {
  return (
    <>
      <PageIntro
        eyebrow={Object.hasOwn(EYEBROWS, page.slug) ? EYEBROWS[page.slug] : siteConfig.name}
        title={page.title}
        description={page.summary || undefined}
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
        <Blocks blocks={page.blocks} />
      </div>
      <CtaBand />
    </>
  );
}
