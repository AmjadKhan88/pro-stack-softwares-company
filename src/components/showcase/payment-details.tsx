import { PAYMENT_METHODS } from "@/config/payments";
import { CopyButton } from "./copy-button";

function Row({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="flex items-center gap-2 text-sm font-medium tabular-nums">
        <span className="break-all">{value}</span>
        {copy ? <CopyButton value={value} label={label} /> : null}
      </dd>
    </div>
  );
}

export function PaymentDetails() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {PAYMENT_METHODS.map((method) => (
          <section
            key={method.id}
            aria-label={method.label}
            className="border-border bg-surface space-y-3 rounded-xl border p-5"
          >
            <h3 className="font-semibold">{method.label}</h3>
            <dl className="space-y-2">
              <Row label="Bank" value={method.bankName} />
              <Row label="Account name" value={method.accountTitle} />
              <Row label="Account number" value={method.accountNumber} copy />
              {method.iban ? <Row label="IBAN" value={method.iban} copy /> : null}
            </dl>
          </section>
        ))}
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Please check the account name before you send money, and pay only to the accounts shown here. We never
        ask you to pay anywhere else.
      </p>
    </div>
  );
}
