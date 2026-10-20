import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { siteConfig } from "@/config/site";
import { ContactForm } from "@/components/public-site/contact-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Contact",
  description: `Tell ${siteConfig.name} about your project. Send an inquiry or reach us by email, phone or WhatsApp.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-8 lg:grid-cols-[1.4fr_1fr] lg:py-16">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight">Tell us about your project</h1>
        <p className="text-muted-foreground mt-3 max-w-xl text-base leading-relaxed">
          Share what you&apos;re trying to build. The more detail you give, the more useful our first reply
          will be.
        </p>
        <div className="mt-8">
          <ContactForm />
        </div>
      </div>

      <aside aria-labelledby="direct" className="lg:pt-24">
        <Card>
          <CardContent className="space-y-4 py-5">
            <h2 id="direct" className="text-sm font-semibold">
              Prefer to talk directly?
            </h2>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  className="inline-flex items-center gap-2 hover:underline"
                  href={`mailto:${siteConfig.email}`}
                >
                  <Mail className="size-4" aria-hidden /> {siteConfig.email}
                </a>
              </li>
              <li>
                <a
                  className="inline-flex items-center gap-2 hover:underline"
                  href={`tel:${siteConfig.phoneTel}`}
                >
                  <Phone className="size-4" aria-hidden /> {siteConfig.phoneDisplay}
                </a>
              </li>
              <li>
                <a
                  className="inline-flex items-center gap-2 hover:underline"
                  href={siteConfig.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="size-4" aria-hidden /> WhatsApp
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
              <li className="text-muted-foreground inline-flex items-center gap-2">
                <MapPin className="size-4" aria-hidden /> {siteConfig.location}
              </li>
            </ul>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
