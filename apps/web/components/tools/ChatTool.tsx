"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, type ChatResponse, type ChatSource, type WorkspaceDetail } from "../../lib/api";
import { Markdown } from "../Markdown";
import { Button, Input } from "../ui";

interface Msg {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
}

const EXAMPLES = [
  "How do we run billing tests?",
  "What are the known risks in the payments repo?",
  "What changed recently and why?",
];

/** Chat grounded in a project's approved memories. Requires an Anthropic key. */
export function ChatTool({ workspaceId }: { workspaceId: string }) {
  const { data: ws } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => api<WorkspaceDetail>(`/workspaces/${workspaceId}`),
    enabled: !!workspaceId,
  });
  const hasKey = ws?.hasAnthropicKey ?? false;
  const ready = !!ws; // wait for the flag before deciding

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !workspaceId || !hasKey) return;
    const question = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: question }]);
    setLoading(true);
    try {
      const res = await api<ChatResponse>(`/workspaces/${workspaceId}/chat`, {
        method: "POST",
        body: JSON.stringify({ message: question }),
      });
      setMessages((m) => [...m, { role: "assistant", content: res.answer, sources: res.sources }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: err instanceof Error ? err.message : "Something went wrong" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const disabled = !ready || !hasKey;

  return (
    <div className="mx-auto flex h-[calc(100vh-230px)] max-w-3xl flex-col">
      <div className="flex flex-1 flex-col overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <span
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: "var(--accent-soft)" }}
              aria-hidden
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 21 12Z"
                  stroke="var(--accent)"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h3 className="font-display text-lg font-semibold">Ask your project’s memory</h3>
            <p className="mt-1 max-w-md text-sm text-[var(--muted)]">
              Answers are grounded in this project’s approved memories, with sources.
            </p>
            {hasKey ? (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setInput(ex)}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-white"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    m.role === "user"
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <Markdown>{m.content}</Markdown>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                  {m.sources?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {m.sources.map((s) => (
                        <Link
                          key={s.id}
                          href={`/repos/${s.repoId}/memories`}
                          className="rounded-md border border-[var(--border)] bg-black/30 px-2 py-0.5 text-xs text-[var(--muted)] hover:text-white"
                          title={`${s.type} · ${s.repo}`}
                        >
                          {s.title}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--muted)] [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--muted)] [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--muted)]" />
                </span>
                Thinking…
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* No API key → make it obvious chat is unavailable and where to fix it. */}
      {ready && !hasKey ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-[var(--signal)]/30 bg-[var(--signal-soft)] px-4 py-3 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-sm text-[var(--text)]">
            Chat needs an Anthropic API key for this project.
          </p>
          <Link
            href={`/projects/${workspaceId}?tab=Settings`}
            className="shrink-0 rounded-lg border border-[var(--signal)]/40 px-3 py-1.5 text-xs font-medium text-[var(--signal)] transition hover:bg-[var(--signal)]/10"
          >
            Add a key in Settings →
          </Link>
        </div>
      ) : null}

      <form onSubmit={send} className="mt-4 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={hasKey ? "Ask about your repos…" : "Add an Anthropic key to start chatting"}
          className="flex-1"
          disabled={disabled}
        />
        <Button type="submit" disabled={disabled || !input.trim()} loading={loading}>
          Send
        </Button>
      </form>
    </div>
  );
}
