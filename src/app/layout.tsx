import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { getSiteUrl, isIndexingAllowed } from "@/lib/seo";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { Toaster } from "@/components/shared/toaster";

const roboto = Roboto({ subsets: ["latin"], variable: "--font-roboto", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  // Blocked everywhere until NEXT_PUBLIC_ALLOW_INDEXING=true, so sample content can't be indexed by accident.
  robots: isIndexingAllowed() ? undefined : { index: false, follow: false },
  // No title/description here on purpose: each page's own title and description are inherited automatically.
  openGraph: { type: "website", siteName: siteConfig.name },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3efe7" },
    { media: "(prefers-color-scheme: dark)", color: "#121310" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning is required by next-themes: it sets the theme class before hydration.
    <html lang="en" suppressHydrationWarning className={roboto.variable}>
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
