import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatusPill } from "@/components/admin/showcase/order-status-pill";
import { Pagination } from "@/components/lists/pagination";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { canManageSales } from "@/features/showcase/access";
import { countByStatus, listOrders } from "@/features/showcase/order-service";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, formatPkr, isOrderStatus } from "@/features/showcase/rules";
import { paymentMethodLabel } from "@/config/payments";
import { formatDateTimeUtc } from "@/lib/format";
import { firstParam, parsePageParam } from "@/lib/search";
import { requireStaff } from "@/server/auth/session";

export const metadata = { title: "Source code requests" };

export default async function SourceRequestsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff("/admin/source-code");
  if (!canManageSales(user.role)) notFound();

  const params = await props.searchParams;
  const raw = firstParam(params.status);
  const status = raw === "all" ? null : isOrderStatus(raw) ? raw : "pending";
  const page = parsePageParam(params.page);
  const [counts, list] = await Promise.all([countByStatus(), listOrders({ status, page })]);

  const tab = "rounded-full border px-3 py-1 text-sm transition-colors";
  const idle = `${tab} border-border bg-surface text-muted-foreground hover:text-foreground`;
  const active = `${tab} border-primary bg-primary text-primary-foreground`;
  const current = status ?? "all";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sales"
        title="Source code requests"
        description="Buyers who paid for a project's source code. Check the payment, approve it, then email the code and mark it as sent."
        actions={
          <Link href="/admin/source-code/offers" className="text-accent text-sm font-medium hover:underline">
            Projects for sale
          </Link>
        }
      />

      <nav aria-label="Filter requests" className="flex flex-wrap gap-2">
        {ORDER_STATUSES.map((value) => (
          <Link
            key={value}
            href={`/admin/source-code?status=${value}`}
            className={current === value ? active : idle}
            aria-current={current === value ? "true" : undefined}
          >
            {ORDER_STATUS_LABELS[value]} ({counts[value]})
          </Link>
        ))}
        <Link
          href="/admin/source-code?status=all"
          className={current === "all" ? active : idle}
          aria-current={current === "all" ? "true" : undefined}
        >
          All
        </Link>
      </nav>

      <Card>
        {list.rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No requests here"
              description="When a buyer sends a request with their payment screenshot, it appears here and you get a notification."
            />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Buyer</Th>
                <Th>Project</Th>
                <Th>Amount</Th>
                <Th>Paid with</Th>
                <Th>Date</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((order) => (
                <tr key={order.id}>
                  <Td className="font-medium">
                    <Link href={`/admin/source-code/${order.id}`} className="hover:underline">
                      {order.reference}
                    </Link>
                  </Td>
                  <Td>
                    <span className="block">{order.buyerName}</span>
                    <span className="text-muted-foreground block text-xs">{order.buyerEmail}</span>
                  </Td>
                  <Td>{order.offerTitle}</Td>
                  <Td className="tabular-nums">{formatPkr(order.priceMinor)}</Td>
                  <Td>{paymentMethodLabel(order.paymentMethod)}</Td>
                  <Td className="whitespace-nowrap tabular-nums">{formatDateTimeUtc(order.createdAt)}</Td>
                  <Td>
                    <OrderStatusPill status={order.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Pagination
        basePath="/admin/source-code"
        params={{ status: current }}
        page={list.page}
        pageCount={list.pageCount}
        total={list.total}
        noun={["request", "requests"]}
      />
    </div>
  );
}
