import { Suspense } from "react";
import type { NavGroup } from "@/config/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { requireClient, requireStaff } from "@/server/auth/session";
import { AppShell } from "./app-shell";

function ShellFallback() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-screen">
      <span className="sr-only">Checking your access…</span>
      <div className="bg-surface-muted hidden w-[248px] shrink-0 lg:block" />
      <div className="flex-1 space-y-4 p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

interface ShellProps {
  groups: NavGroup[];
  sublabel: string;
  areaLabel: string;
  homeHref: string;
  children: React.ReactNode;
}

async function StaffShellInner({ children, ...shell }: ShellProps) {
  const user = await requireStaff("/admin");
  return (
    <AppShell variant="dark" user={user} {...shell}>
      {children}
    </AppShell>
  );
}

async function ClientShellInner({ children, ...shell }: ShellProps) {
  const user = await requireClient("/portal");
  return (
    <AppShell variant="light" user={user} {...shell}>
      {children}
    </AppShell>
  );
}

// The session is read per request, so it must sit inside <Suspense> under Cache Components.
export function StaffShell(props: ShellProps) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <StaffShellInner {...props} />
    </Suspense>
  );
}

export function ClientShell(props: ShellProps) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <ClientShellInner {...props} />
    </Suspense>
  );
}
