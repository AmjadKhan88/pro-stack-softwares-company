import type { Metadata } from "next";
import { ClientShell } from "@/components/layout/shell-gates";
import { portalNav } from "@/config/navigation";

export const metadata: Metadata = {
  title: { default: "Client portal", template: "%s | Client portal" },
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientShell groups={portalNav} sublabel="Client portal" areaLabel="Client portal" homeHref="/portal">
      {children}
    </ClientShell>
  );
}
