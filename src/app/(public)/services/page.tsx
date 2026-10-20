import type { Metadata } from "next";
import Link from "next/link";
import { getServices } from "@/features/content/repository";
import { Card, CardContent } from "@/components/ui/card";
import { CtaBand } from "@/components/public-site/cta-band";
import { DemoNotice } from "@/components/public-site/demo-notice";
import { PageIntro } from "@/components/public-site/page-intro";

export const metadata: Metadata = {
  title: "Services",
  description: "Web applications, websites, mobile apps, e-commerce, internal tools and integrations.",
  alternates: { canonical: "/services" },
};

export default async function ServicesPage() {
  const services = await getServices();
  return (
    <>
      <PageIntro
        eyebrow="Services"
        title="What we build"
        description="Software for real business problems, from first idea to a working release."
      >
        <DemoNotice>Draft service descriptions. Replace them with your real offering.</DemoNotice>
      </PageIntro>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/services/${s.slug}`}
                className="focus-visible:ring-accent/25 block h-full rounded-xl focus-visible:ring-4 focus-visible:outline-none"
              >
                <Card className="hover:border-muted-foreground h-full transition-colors">
                  <CardContent className="space-y-2 py-5">
                    <h2 className="font-semibold">{s.title}</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed">{s.summary}</p>
                    <p className="text-accent text-sm font-medium">Learn more →</p>
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
