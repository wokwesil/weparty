import type { Metadata, Viewport } from "next";
import "@fontsource-variable/unbounded";
import "@fontsource-variable/inter";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { SiteTracker } from "@/components/SiteTracker";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: { default: "WeParty — Where We All Control the Vibes", template: "%s · WeParty" },
  description: "Scan. Connect. Select. Vote. Party. Replay. The social music queue for parties. Powered by Offtrack.",
  applicationName: "We Party",
  appleWebApp: { capable: true, title: "We Party", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // Older iPhones only look for the Apple spelling of "can run full screen".
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#07060c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <AppShell />
        <SiteTracker />
      </body>
    </html>
  );
}
