import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const pill = cva("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    status: {
      live: "border-success/30 bg-success/10 text-success",
      review: "border-warning/30 bg-warning/10 text-warning",
      blocked: "border-danger/30 bg-danger/10 text-danger",
      archived: "border-border bg-surface-muted text-foreground",
      draft: "border-border bg-surface text-muted-foreground",
    },
  },
  defaultVariants: { status: "draft" },
});

const dot = {
  live: "bg-success",
  review: "bg-warning",
  blocked: "bg-danger",
  archived: "bg-muted-foreground",
  draft: "bg-muted-foreground",
} as const;

export type StatusPillProps = VariantProps<typeof pill> & { className?: string; children: React.ReactNode };

/** Status is conveyed by a dot AND a text label, never colour alone. */
export function StatusPill({ status, className, children }: StatusPillProps) {
  return (
    <span className={cn(pill({ status }), className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", dot[status ?? "draft"])} />
      {children}
    </span>
  );
}

export function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "bg-surface-muted text-foreground inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}
