"use client";

import { useState } from "react";

export function CopyButton({ value, className = "" }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <button
      onClick={copy}
      className={`rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] transition hover:text-white ${className}`}
      title="Copy"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}
