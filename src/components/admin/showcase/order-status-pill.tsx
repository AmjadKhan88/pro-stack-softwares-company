import { ORDER_STATUS_LABELS, type OrderStatus } from "@/features/showcase/rules";

const STYLES: Record<OrderStatus, string> = {
  pending: "bg-surface-muted text-foreground",
  approved: "bg-accent/15 text-accent",
  sent: "bg-success/15 text-success",
  rejected: "bg-danger/15 text-danger",
};

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
