import type { Metadata } from "next";
import "./globals.css";
import { CookieBanner } from "../components/CookieBanner";

export const metadata: Metadata = {
  title: "Cortex — Operational memory for AI coding agents",
  description:
    "Cortex turns your repo, agent sessions, docs, and past mistakes into living operational context for AI coding agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
