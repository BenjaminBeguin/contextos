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
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3"
    >
      <div className="glass mx-auto flex max-w-2xl flex-col gap-2.5 rounded-xl border border-white/10 px-4 py-3 shadow-xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[var(--muted)]">
          Essential cookies keep this site working; with your consent we also use analytics to
          improve Cortex — never ads.{" "}
          <a href="/privacy" className="text-[var(--muted)] underline underline-offset-2 hover:text-white">
            Privacy &amp; Cookies
          </a>
          .
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => choose("declined")}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:text-white"
          >
            Decline
          </button>
          <button
            onClick={() => choose("accepted")}
            className="rounded-lg bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
