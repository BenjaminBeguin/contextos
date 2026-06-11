"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MEMORY_TYPES } from "@contextos/shared";
import { api, type Memory } from "../lib/api";
import { Badge, StatusBadge, Button, Card } from "./ui";

export function MemoryCard({ memory }: { memory: Memory }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(memory.title);
  const [content, setContent] = useState(memory.content);
  const [type, setType] = useState(memory.type);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["memories", memory.repoId] });

  const setStatus = useMutation({
    mutationFn: (action: "approve" | "reject" | "archive") =>
      api(`/memories/${memory.id}/${action}`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const save = useMutation({
    mutationFn: () =>
      api(`/memories/${memory.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title, content, type }),
      }),
    onSuccess: () => {
      setEditing(false);
      invalidate();
    },
  });

  if (editing) {
    return (
      <Card className="p-5">
        <div className="space-y-3">
          <div className="flex gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            >
              {MEMORY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={!title || !content || save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setTitle(memory.title);
                setContent(memory.content);
                setType(memory.type);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge label={memory.type} />
            <StatusBadge status={memory.status} />
            <span className="text-xs text-[var(--muted)]">
              conf {Math.round(memory.confidence * 100)}%
            </span>
          </div>
          <h3 className="font-semibold">{memory.title}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{memory.content}</p>
          {memory.evidence?.length ? (
            <div className="mt-3 border-l-2 border-[var(--border)] pl-3">
              {memory.evidence.map((e) => (
                <p key={e.id} className="text-xs text-[var(--muted)]">
                  <span className="text-white/70">{e.kind}:</span> {e.content}
                </p>
              ))}
            </div>
          ) : null}
        </div>
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 text-xs text-[var(--muted)] hover:text-white"
        >
          Edit
        </button>
      </div>
      <div className="mt-4 flex gap-2">
        {memory.status !== "approved" ? (
          <Button onClick={() => setStatus.mutate("approve")} disabled={setStatus.isPending}>
            Approve
          </Button>
        ) : null}
        {memory.status !== "rejected" ? (
          <Button variant="danger" onClick={() => setStatus.mutate("reject")} disabled={setStatus.isPending}>
            Reject
          </Button>
        ) : null}
        {memory.status !== "archived" ? (
          <Button variant="ghost" onClick={() => setStatus.mutate("archive")} disabled={setStatus.isPending}>
            Archive
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
