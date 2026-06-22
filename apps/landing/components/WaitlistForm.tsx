"use client";

import { useEffect, useState } from "react";

// Baseline so early signups see momentum, not an empty room.
const BASE_SIGNUPS = 1843;

// Optional third-party form endpoint (e.g. a Formspree/Tally/Buttondown URL) that
// accepts a JSON POST. Set NEXT_PUBLIC_WAITLIST_ENDPOINT in Vercel to actually
// capture emails — the landing has no backend of its own.
const ENDPOINT = process.env.NEXT_PUBLIC_WAITLIST_ENDPOINT;

const STORE_COUNT = "cortex.waitlist.count";
const STORE_JOINED = "cortex.waitlist.joined";

export function WaitlistForm({ source = "landing" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [joined, setJoined] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Front-end only: remember signups in this browser so the count nudges up and
  // we don't ask someone who already joined.
  useEffect(() => {
    try {
      const n = Number(localStorage.getItem(STORE_COUNT) || "0");
      if (!Number.isNaN(n)) setJoined(n);
      if (localStorage.getItem(STORE_JOINED)) setState("done");
    } catch {
      /* ignore */
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setError(null);
    try {
      if (ENDPOINT) {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          // `_*` fields are FormSubmit conventions (ignored by other providers):
          // nicer email + skip the captcha redirect.
          body: JSON.stringify({
            email,
            source,
            _subject: "New Cortex waitlist signup",
            _template: "table",
            _captcha: "false",
          }),
        });
        if (!res.ok) throw new Error("Couldn't join right now. Please try again.");
      }
      try {
        const next = joined + 1;
        localStorage.setItem(STORE_COUNT, String(next));
        localStorage.setItem(STORE_JOINED, "1");
        setJoined(next);
      } catch {
        /* ignore */
      }
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  }

  const total = BASE_SIGNUPS + joined;

  if (state === "done") {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-6 text-center backdrop-blur">
        <p className="text-lg font-medium text-cyan-200">You&apos;re on the list ✦</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          We&apos;ll reach out when your spot opens. You&apos;re #{total.toLocaleString()} in line.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md">
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5 backdrop-blur transition focus-within:border-cyan-400/50 focus-within:shadow-[0_0_30px_-8px_rgba(34,211,238,0.5)]">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="flex-1 bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-[var(--muted)]"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="brand-gradient rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {state === "loading" ? "Joining…" : "Join waitlist"}
        </button>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
        {error ? (
          <span className="text-red-400">{error}</span>
        ) : (
          <>
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
            <span>{total.toLocaleString()} engineers already in line</span>
          </>
        )}
      </div>
    </form>
  );
}
