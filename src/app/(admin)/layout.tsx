import type { Metadata } from "next";
import { StaffShell } from "@/components/layout/shell-gates";
import { adminNav } from "@/config/navigation";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

export const instant = false;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffShell groups={adminNav} sublabel="Studio console" areaLabel="Admin" homeHref="/admin">
      {children}
    </StaffShell>
  );
}
