import type { Metadata } from "next";
import { Brand } from "@/components/layout/brand";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";

export const metadata: Metadata = {
  title: { default: "Account", template: "%s | Account" },
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
        <Brand />
        <ThemeSwitcher />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-12">
        {children}
      </main>
    </div>
  );
}
