// Root layout for every page (GEN-17 typography, .md section 9 SEO metadata).
// Pages choose their own shell (PublicShell, AppShell, DashboardShell, AuthLayout);
// this file only sets the font, the dark theme and the global providers.
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

// Self-hosted by Next.js at build time: no request to Google when the app runs.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  // Makes relative canonical / Open Graph URLs absolute (.md section 9 SEO); NEXT_PUBLIC_SITE_URL.
  metadataBase: siteUrl(),
  title: {
    default: "Yallaway",
    template: "%s · Yallaway",
  },
  description:
    "Plan trips, book flights and hotels, and share itineraries with fellow travelers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${jakarta.variable}`}>
      <body className="min-h-dvh">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
