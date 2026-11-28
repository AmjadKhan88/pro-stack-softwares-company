import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderForm } from "@/components/showcase/order-form";
import { PaymentDetails } from "@/components/showcase/payment-details";
import { getActiveOffer, listActiveOffers } from "@/features/showcase/public-reads";
import { formatPkr } from "@/features/showcase/rules";

export async function generateStaticParams() {
  const offers = await listActiveOffers();
  return offers.length > 0 ? offers.map((offer) => ({ slug: offer.slug })) : [{ slug: "not-found" }];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const offer = await getActiveOffer(slug);
  if (!offer) return { title: "Project not found", robots: { index: false } };
  return {
    title: offer.title,
    description: offer.summary,
    alternates: { canonical: `/showcase/${offer.slug}` },
  };
}

const STEPS = [
  "Pay the price to one of the accounts below.",
  "Fill in the form with your details and a screenshot of your payment.",
  "We check your payment by hand.",
  "We email the source code to the address you gave us.",
];

export default async function ShowcaseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const offer = await getActiveOffer(slug);
  if (!offer) notFound();

  const paragraphs = offer.description.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-12 px-4 py-16 sm:px-8">
      <Link href="/showcase" className="text-accent text-sm font-medium hover:underline">
        ← All projects
      </Link>

      <header className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">{offer.title}</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">{offer.summary}</p>
        {offer.techStack.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Technologies">
            {offer.techStack.map((tech) => (
              <li key={tech} className="bg-surface-muted rounded-full px-3 py-1 text-sm">
                {tech}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
          {offer.liveUrl ? (
            <a
              href={offer.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              View live demo ↗
            </a>
          ) : null}
          {offer.caseStudySlug ? (
            <Link href={`/work/${offer.caseStudySlug}`} className="text-accent hover:underline">
              Read the case study →
            </Link>
          ) : null}
        </div>
      </header>

      {paragraphs.length > 0 ? (
        <section aria-label="About this project" className="space-y-4">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="leading-relaxed whitespace-pre-wrap">
              {paragraph}
            </p>
          ))}
        </section>
      ) : null}

      <section aria-labelledby="get-code" className="space-y-8">
        <div className="space-y-2">
          <h2 id="get-code" className="text-2xl font-semibold tracking-tight">
            Get the source code
          </h2>
          <p className="text-lg">
            Price: <strong className="tabular-nums">{formatPkr(offer.priceMinor)}</strong>
          </p>
        </div>

        <ol className="space-y-2">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm leading-relaxed">
              <span className="bg-accent/15 text-accent grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        <PaymentDetails />
        <OrderForm offerId={offer.id} offerTitle={offer.title} priceLabel={formatPkr(offer.priceMinor)} />
      </section>
    </div>
  );
}
