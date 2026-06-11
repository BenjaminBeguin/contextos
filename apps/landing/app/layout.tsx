import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContextOS — Operational memory for AI coding agents",
  description:
    "ContextOS turns your repo, agent sessions, docs, and past mistakes into living operational context for AI coding agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
