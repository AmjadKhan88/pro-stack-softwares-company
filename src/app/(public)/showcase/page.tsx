import type { Metadata } from "next";
import { OfferCard } from "@/components/showcase/offer-card";
import { EmptyState } from "@/components/ui/empty-state";
import { listActiveOffers } from "@/features/showcase/public-reads";

export const metadata: Metadata = {
  title: "Project showcase",
  description: "Projects we have built. If one fits what you need, you can buy its source code.",
  alternates: { canonical: "/showcase" },
};

export default async function ShowcasePage() {
  const offers = await listActiveOffers();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-16 sm:px-8">
      <header className="max-w-2xl space-y-3">
        <p className="text-accent text-xs font-semibold tracking-[0.18em] uppercase">Project showcase</p>
        <h1 className="text-4xl font-semibold tracking-tight">Projects you can take home</h1>
        <p className="text-muted-foreground leading-relaxed">
          Browse projects we have built. If one fits what you need, you can buy its source code. You pay by
          bank transfer or JazzCash, we check the payment by hand, and we email you the code.
        </p>
      </header>
      {offers.length === 0 ? (
        <EmptyState
          title="No projects are listed yet"
          description="Please check back soon, or contact us about a project you need."
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </div>
  );
}
