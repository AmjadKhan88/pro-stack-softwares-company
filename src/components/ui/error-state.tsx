import { cn } from "@/lib/utils";

interface Props {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this page. Please try again.",
  action,
  className,
}: Props) {
  return (
    <div
      role="alert"
      className={cn(
        "border-danger/30 bg-danger/5 flex flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center",
        className,
      )}
    >
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">{description}</p>
      {action}
    </div>
  );
}
