import { cacheLife } from "next/cache";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { siteConfig } from "@/config/site";

async function getCurrentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export async function PublicFooter() {
  const year = await getCurrentYear();
  return (
    <footer className="border-border bg-surface border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-8 md:grid-cols-[1.5fr_1fr]">
        <div>
          <p className="text-base font-semibold tracking-tight">{siteConfig.name}</p>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
            {siteConfig.description}
          </p>
          <p className="text-muted-foreground mt-4 text-sm">{siteConfig.location}</p>
        </div>
        <ul className="space-y-3 text-sm">
          <li>
            <a className="inline-flex items-center gap-2 hover:underline" href={`mailto:${siteConfig.email}`}>
              <Mail className="size-4" aria-hidden /> {siteConfig.email}
            </a>
          </li>
          <li>
            <a className="inline-flex items-center gap-2 hover:underline" href={`tel:${siteConfig.phoneTel}`}>
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
        </ul>
      </div>
      <div className="border-border text-muted-foreground border-t px-4 py-4 text-center text-xs">
        &copy; {year} {siteConfig.name}
      </div>
    </footer>
  );
}
