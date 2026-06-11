"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, type Me, type ChatResponse, type ChatSource } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { Markdown } from "../../components/Markdown";
import { Button, Card } from "../../components/ui";

interface Msg {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
}

export default function ChatPage() {
  return (
    <AppShell>
      <Chat />
    </AppShell>
  );
}

function Chat() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  const [ws, setWs] = useState<string>("");
  const activeWs = ws || me?.workspaces[0]?.id || "";

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !activeWs) return;
    const question = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: question }]);
    setLoading(true);
    try {
      const res = await api<ChatResponse>(`/workspaces/${activeWs}/chat`, {
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

  if (me && me.workspaces.length === 0) {
    return (
      <p className="text-[var(--muted)]">
        No workspace yet.{" "}
        <Link href="/dashboard" className="text-[var(--accent)]">
          Create one →
        </Link>
      </p>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-140px)] max-w-3xl flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Chat with your memory</h1>
          <p className="text-sm text-[var(--muted)]">
            Answers are grounded in this workspace&apos;s approved memories.
          </p>
        </div>
        <select
          value={activeWs}
          onChange={(e) => setWs(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-sm"
        >
          {me?.workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <Card className="p-8 text-center text-sm text-[var(--muted)]">
            Ask things like “How do we run billing tests?” or “What are the known risks in the
            payments repo?”
          </Card>
        ) : null}
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
        {loading ? <p className="text-sm text-[var(--muted)]">Thinking…</p> : null}
      </div>

      <form onSubmit={send} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your repos…"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
