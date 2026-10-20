import { cn } from "@/lib/utils";

/** Scrolls horizontally inside its own container so the page never scrolls sideways. */
export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto" tabIndex={0} role="region" aria-label="Data table">
      <table className={cn("w-full min-w-[560px] border-collapse text-sm", className)} {...props} />
    </div>
  );
}
export function Th({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "border-border text-muted-foreground border-y px-4 py-2.5 text-left text-xs font-medium tracking-wider uppercase",
        className,
      )}
      {...props}
    />
  );
}
export function Td({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("border-border border-b px-4 py-3", className)} {...props} />;
}
