"use client";

import { useEffect, useState } from "react";

const KEY = "cortex.cookie-consent";

export type Consent = "accepted" | "declined";

/** Read the stored consent choice (null = not yet decided). */
export function getConsent(): Consent | null {
  if (typeof localStorage === "undefined") return null;
  const v = localStorage.getItem(KEY);
  return v === "accepted" || v === "declined" ? v : null;
}

/** True only if the visitor accepted non-essential (analytics) cookies. */
export function hasAnalyticsConsent(): boolean {
  return getConsent() === "accepted";
}

/** Re-open the banner so a visitor can change their choice (GDPR: withdrawable). */
export function openCookieSettings() {
  window.dispatchEvent(new Event("cortex:open-consent"));
}

export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show until a choice is made; nothing non-essential runs before then.
    if (!getConsent()) setShow(true);
    const reopen = () => setShow(true);
    window.addEventListener("cortex:open-consent", reopen);
    return () => window.removeEventListener("cortex:open-consent", reopen);
  }, []);

  function choose(choice: Consent) {
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      /* ignore */
    }
    setShow(false);
    // Let analytics loaders react to a fresh "accepted" without a reload.
    window.dispatchEvent(new CustomEvent("cortex:consent", { detail: choice }));
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4"
    >
      <div className="glass mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-white/10 p-5 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--muted)]">
          We use essential cookies to make this site work. With your consent we&apos;d also use
          analytics cookies to improve Cortex — never for ads. See our{" "}
          <a href="/privacy" className="text-cyan-300 hover:underline">
            Privacy &amp; Cookies
          </a>{" "}
          policy.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => choose("declined")}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium transition hover:bg-white/5"
          >
            Decline
          </button>
          <button
            onClick={() => choose("accepted")}
            className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
