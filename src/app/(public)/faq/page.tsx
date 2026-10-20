import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { getFaqs } from "@/features/content/repository";
import { CtaBand } from "@/components/public-site/cta-band";
import { DemoNotice } from "@/components/public-site/demo-notice";
import { PageIntro } from "@/components/public-site/page-intro";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Common questions about starting a project with us.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const faqs = await getFaqs();
  return (
    <>
      <PageIntro eyebrow="FAQ" title="Frequently asked questions">
        <DemoNotice>Draft answers. Replace them with your real policies before launch.</DemoNotice>
      </PageIntro>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
        <div className="border-border divide-border divide-y rounded-xl border">
          {faqs.map((f) => (
            <details key={f.question} className="group px-5 py-4">
              <summary className="focus-visible:ring-accent/25 flex cursor-pointer list-none items-center justify-between gap-4 rounded-md font-medium focus-visible:ring-4 focus-visible:outline-none">
                {f.question}
                <ChevronDown
                  className="size-4 shrink-0 transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="text-muted-foreground mt-3 leading-relaxed">{f.answer}</p>
            </details>
          ))}
        </div>
      </div>
      <CtaBand />
    </>
  );
}
