"use client";

import { useEffect, useState } from "react";
import { APP_URL, APP_LIVE } from "../lib/api";

const links = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
];

/** Floating "dynamic island" nav — a centered pill that condenses as you scroll. */
export function IslandNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed inset-x-0 top-3 z-50 flex justify-center px-3">
      <nav
        className={`island-in flex items-center rounded-full border border-white/10 bg-[var(--background)]/70 backdrop-blur-xl transition-all duration-300 ${
          scrolled
            ? "gap-0.5 px-2 py-1.5 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.85)]"
            : "gap-1 px-3 py-2 shadow-[0_8px_30px_-14px_rgba(109,94,252,0.5)]"
        }`}
      >
        <a href="/" className="flex items-center gap-2 rounded-full px-2 py-1 font-semibold">
          <span className="inline-block h-4 w-4 rotate-45 rounded-sm bg-gradient-to-br from-violet-400 to-[var(--signal)]" />
          <span className={scrolled ? "hidden lg:inline" : ""}>Cortex</span>
        </a>

        <span className="mx-1 hidden h-5 w-px bg-white/10 md:block" />

        <div className="hidden items-center md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-3 py-1.5 text-sm text-[var(--muted)] transition hover:bg-white/5 hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>

        <span className="mx-1 hidden h-5 w-px bg-white/10 md:block" />

        {APP_LIVE ? (
          <a
            href={`${APP_URL}/login`}
            className="hidden rounded-full px-3 py-1.5 text-sm text-[var(--muted)] transition hover:text-white sm:inline"
          >
            Sign in
          </a>
        ) : null}
        <a
          href="#waitlist"
          className="shine brand-gradient rounded-full px-4 py-1.5 text-sm font-bold text-white transition hover:brightness-110"
        >
          Join
        </a>
      </nav>
    </div>
  );
}
