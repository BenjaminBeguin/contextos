"use client";

import { useQuery } from "@tanstack/react-query";
import { getSession, type SessionSpan } from "../lib/api";
import { Spinner } from "./ui";

const TYPE_COLOR: Record<string, string> = {
  command: "var(--accent-cyan)",
  file_changed: "var(--accent)",
  error: "var(--alert)",
  memory_used: "var(--signal)",
};

function dotColor(e: SessionSpan): string {
  if (e.status === "error") return "var(--alert)";
  if (e.status === "warning") return "var(--signal)";
  return TYPE_COLOR[e.type] ?? "var(--muted)";
}

function label(e: SessionSpan): string {
  if (e.name) return e.name;
  const p = e.payload ?? {};
  return (
    (p.command as string) ??
    (p.path as string) ??
    (p.message as string) ??
    e.type.replace(/_/g, " ")
  );
}

function ms(n?: number | null): string | null {
  if (n == null) return null;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${n}ms`;
}

/** A session's events rendered as a vertical timeline (span view). */
export function SessionTimeline({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => getSession(sessionId),
  });

  if (isLoading)
    return (
      <p className="flex items-center gap-2 py-2 text-xs text-[var(--muted)]">
        <Spinner /> Loading timeline…
      </p>
    );
  const events = data?.events ?? [];
  if (events.length === 0)
    return <p className="py-2 text-xs text-[var(--muted)]">No events recorded for this session.</p>;

  return (
    <ol className="relative ml-1 space-y-2.5 border-l border-[var(--border)] pl-4 pt-1">
      {events.map((e) => {
        const d = ms(e.durationMs);
        return (
          <li key={e.id} className="relative">
            <span
              className="absolute -left-[1.28rem] top-1 h-2 w-2 rounded-full"
              style={{ background: dotColor(e), boxShadow: `0 0 6px ${dotColor(e)}` }}
              aria-hidden
            />
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-xs">
                <span className="text-[var(--faint)]">{e.type}</span>{" "}
                <span className="text-[var(--text)]">{label(e)}</span>
              </span>
              {d ? <span className="shrink-0 font-mono text-[10px] text-[var(--faint)]">{d}</span> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
