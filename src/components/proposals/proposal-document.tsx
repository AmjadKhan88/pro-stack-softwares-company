import { formatMoney } from "@/features/proposals/money";
import type { ProposalView } from "@/features/proposals/service";

type DocumentFields = Pick<
  ProposalView,
  | "code"
  | "title"
  | "summary"
  | "scope"
  | "deliverables"
  | "assumptions"
  | "exclusions"
  | "timelineSummary"
  | "estimatedWeeks"
  | "currency"
  | "totalMinor"
  | "paymentTerms"
>;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
      {items.map((item, index) => (
        <li key={`${index}-${item}`}>{item}</li>
      ))}
    </ul>
  );
}

/** The proposal as the client reads it. Used by both the admin preview and the client portal. */
export function ProposalDocument({ proposal }: { proposal: DocumentFields }) {
  return (
    <article className="border-border bg-surface space-y-8 rounded-xl border p-6 sm:p-8">
      <header className="space-y-2">
        <p className="text-muted-foreground font-mono text-xs">{proposal.code}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{proposal.title}</h1>
        <p className="text-muted-foreground leading-relaxed">{proposal.summary}</p>
      </header>

      <Section id="doc-scope" title="Scope">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{proposal.scope}</p>
      </Section>

      <Section id="doc-deliverables" title="Deliverables">
        <BulletList items={proposal.deliverables} />
      </Section>

      <Section id="doc-timeline" title="Timeline">
        <p className="text-sm font-medium tabular-nums">
          About {proposal.estimatedWeeks} {proposal.estimatedWeeks === 1 ? "week" : "weeks"}
        </p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{proposal.timelineSummary}</p>
      </Section>

      {proposal.assumptions.length > 0 ? (
        <Section id="doc-assumptions" title="Assumptions">
          <BulletList items={proposal.assumptions} />
        </Section>
      ) : null}

      {proposal.exclusions.length > 0 ? (
        <Section id="doc-exclusions" title="Not included">
          <BulletList items={proposal.exclusions} />
        </Section>
      ) : null}

      <Section id="doc-pricing" title="Pricing and payment">
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {formatMoney(proposal.totalMinor, proposal.currency)}
        </p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{proposal.paymentTerms}</p>
      </Section>
    </article>
  );
}
