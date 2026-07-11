import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SessionProvider } from "@/lib/session";
import AudioControls from "@/components/AudioControls";
import InviteWatcher from "@/components/InviteWatcher";
import InstallPrompt from "@/components/InstallPrompt";
import AccessibilityToolbar from "@/components/AccessibilityToolbar";

export const metadata: Metadata = {
  applicationName: "Accessible Board Games",
  title: "Accessible Board Games | PlayVerse Arcade - Inclusive, Multiplayer",
  description:
    "Fully accessible board games - Ludo, Carrom, Snake & Ladder, Chess, Memory, 2048, Tic-Tac-Toe. WCAG 2.1 AA, keyboard, screen reader, high contrast, multiplayer rooms, voice chat.",
  keywords: ["accessible", "board games", "ludo", "carrom", "chess", "a11y", "inclusive", "multiplayer"],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Accessible Games",
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <a href="#main" className="skip-link">Skip to main content</a>
        <SessionProvider>
          <AccessibilityToolbar />
          <main id="main">
            {children}
          </main>
          <InviteWatcher />
          <AudioControls />
          <InstallPrompt />
        </SessionProvider>
      </body>
    </html>
  );
}
