"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "../lib/api";

// Baseline so early signups see momentum, not an empty room.
const BASE_SIGNUPS = 1843;

export function WaitlistForm({ source = "landing" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/waitlist/count`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCount(d.count))
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/waitlist`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Something went wrong");
      }
      const data = await res.json();
      setCount(data.count ?? null);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  }

  const total = BASE_SIGNUPS + (count ?? 0);

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
