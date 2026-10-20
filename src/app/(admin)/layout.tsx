import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { adminNav } from "@/config/navigation";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell variant="dark" groups={adminNav} sublabel="Studio console" areaLabel="Admin" homeHref="/admin">
      {children}
    </AppShell>
  );
}
