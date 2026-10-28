import { cn } from "@/lib/utils";

interface Props {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function AuthCard({ title, description, children, footer, className }: Props) {
  return (
    <div className={cn("border-border bg-surface w-full max-w-md rounded-xl border p-6 sm:p-8", className)}>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? (
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{description}</p>
      ) : null}
      <div className="mt-6">{children}</div>
      {footer ? (
        <div className="border-border text-muted-foreground mt-6 border-t pt-4 text-sm">{footer}</div>
      ) : null}
    </div>
  );
}
