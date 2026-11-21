import { JsonLd } from "@/components/shared/json-ld";
import { faqSchema } from "@/features/seo/structured-data";
import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { faqAnswerText } from "@/features/cms/mapping";
import { getFaqs } from "@/features/content/repository";
import { CtaBand } from "@/components/public-site/cta-band";
import { DemoNotice } from "@/components/public-site/demo-notice";
import { PageIntro } from "@/components/public-site/page-intro";
import { RichText } from "@/components/public-site/rich-text";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Common questions about starting a project with us.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const faqs = await getFaqs();
  const realFaqs = faqs.filter((f) => !f.isDemo);
  return (
    <>
      {realFaqs.length > 0 ? (
        <JsonLd
          data={faqSchema(realFaqs.map((f) => ({ question: f.question, answer: faqAnswerText(f.answer) })))}
        />
      ) : null}
      <PageIntro eyebrow="FAQ" title="Frequently asked questions">
        {faqs.some((f) => f.isDemo) ? (
          <DemoNotice>Draft answers. Replace them with your real policies before launch.</DemoNotice>
        ) : null}
      </PageIntro>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
        {faqs.length === 0 ? (
          <p className="text-muted-foreground">No questions yet. Contact us and we&apos;ll gladly help.</p>
        ) : (
          <div className="border-border divide-border divide-y rounded-xl border">
            {faqs.map((f, index) => (
              <details key={`${index}-${f.question}`} className="group px-5 py-4">
                <summary className="focus-visible:ring-accent/25 flex cursor-pointer list-none items-center justify-between gap-4 rounded-md font-medium focus-visible:ring-4 focus-visible:outline-none">
                  {f.question}
                  <ChevronDown
                    className="size-4 shrink-0 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <RichText source={f.answer} className="text-muted-foreground mt-3" />
              </details>
            ))}
          </div>
        )}
      </div>
      <CtaBand />
    </>
  );
}
