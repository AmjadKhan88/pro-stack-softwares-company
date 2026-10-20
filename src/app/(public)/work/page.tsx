import type { Metadata } from "next";
import Link from "next/link";
import { getCaseStudies } from "@/features/content/repository";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CtaBand } from "@/components/public-site/cta-band";
import { DemoNotice } from "@/components/public-site/demo-notice";
import { PageIntro } from "@/components/public-site/page-intro";

export const metadata: Metadata = {
  title: "Work",
  description: "Selected projects and case studies.",
  alternates: { canonical: "/work" },
};

export default async function WorkPage() {
  const studies = await getCaseStudies();
  return (
    <>
      <PageIntro
        eyebrow="Work"
        title="Selected projects"
        description="How we approach problems and what we build."
      >
        <DemoNotice>These are sample layouts only. No real client work is shown yet.</DemoNotice>
      </PageIntro>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
        <ul className="grid gap-4 md:grid-cols-2">
          {studies.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/work/${c.slug}`}
                className="focus-visible:ring-accent/25 block h-full rounded-xl focus-visible:ring-4 focus-visible:outline-none"
              >
                <Card className="hover:border-muted-foreground h-full transition-colors">
                  <CardContent className="space-y-3 py-5">
                    <Badge>{c.category}</Badge>
                    <h2 className="font-semibold">{c.title}</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed">{c.summary}</p>
                    <p className="text-accent text-sm font-medium">View case study →</p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <CtaBand />
    </>
  );
}
