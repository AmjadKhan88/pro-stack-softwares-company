import Link from "next/link";
import { ArrowRight, Briefcase, ShieldCheck, Palette } from "lucide-react";
import { siteConfig } from "@/config/site";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const previews = [
  {
    href: "/portal",
    title: "Client portal shell",
    body: "Light sidebar layout for the future client workspace.",
    Icon: Briefcase,
  },
  {
    href: "/admin",
    title: "Admin shell",
    body: "Dark ink sidebar layout for the staff workspace.",
    Icon: ShieldCheck,
  },
  {
    href: "/design-system",
    title: "Design system",
    body: "Tokens and components used across all three areas.",
    Icon: Palette,
  },
];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
        <Badge>Draft copy — final wording coming in Phase 2</Badge>
        <h1 className="mt-5 max-w-3xl text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl">
          Software built to solve real business problems.
        </h1>
        <p className="text-muted-foreground mt-5 max-w-xl text-base leading-relaxed">
          {siteConfig.name} designs and builds reliable software with clear communication and realistic
          delivery estimates.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="accent" size="lg">
            <a href={`mailto:${siteConfig.email}?subject=Project%20inquiry`}>
              Email us about a project <ArrowRight className="size-4" aria-hidden />
            </a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href={siteConfig.whatsappUrl} target="_blank" rel="noopener noreferrer">
              WhatsApp <span className="sr-only">(opens in a new tab)</span>
            </a>
          </Button>
        </div>
      </section>

      <section aria-labelledby="foundation" className="border-border bg-surface border-t">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
          <h2
            id="foundation"
            className="text-muted-foreground text-sm font-semibold tracking-[0.14em] uppercase"
          >
            Phase 1 foundation preview
          </h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {previews.map(({ href, title, body, Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="focus-visible:ring-accent/25 block h-full rounded-xl focus-visible:ring-4 focus-visible:outline-none"
                >
                  <Card className="hover:border-muted-foreground h-full transition-colors">
                    <CardContent className="space-y-2 py-5">
                      <Icon className="text-accent size-5" aria-hidden />
                      <h3 className="font-semibold">{title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
