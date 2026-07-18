import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { CookieBanner } from "../components/CookieBanner";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Memmo — Long-term memory for AI coding agents",
  description:
    "Memmo is operational memory for AI coding agents. It turns your repo, agent sessions, docs, and past mistakes into living context — so Claude Code walks in already knowing how your code works.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
