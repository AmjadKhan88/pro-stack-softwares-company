import type { Metadata } from "next";
import { getProcessSteps } from "@/features/content/repository";
import { CtaBand } from "@/components/public-site/cta-band";
import { DemoNotice } from "@/components/public-site/demo-notice";
import { PageIntro } from "@/components/public-site/page-intro";

export const metadata: Metadata = {
  title: "Process",
  description: "How a project runs from discovery to launch and support.",
  alternates: { canonical: "/process" },
};

export default async function ProcessPage() {
  const steps = await getProcessSteps();
  return (
    <>
      <PageIntro
        eyebrow="Process"
        title="How we work"
        description="A clear path from the first conversation to a released product."
      >
        <DemoNotice>Draft wording. Adjust it to how you really work.</DemoNotice>
      </PageIntro>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
        <ol className="space-y-6">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-5">
              <span className="text-accent w-8 shrink-0 text-lg font-semibold tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{s.title}</h2>
                <p className="text-muted-foreground mt-1 leading-relaxed">{s.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <CtaBand />
    </>
  );
}
