import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { portalNav } from "@/config/navigation";

export const metadata: Metadata = {
  title: { default: "Client portal", template: "%s | Client portal" },
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      variant="light"
      groups={portalNav}
      sublabel="Client portal"
      areaLabel="Client portal"
      homeHref="/portal"
    >
      {children}
    </AppShell>
  );
}
