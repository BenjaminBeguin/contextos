"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MEMORY_TYPES } from "@cortex/shared";
import { api, isStaleMemory, STALE_DAYS, timeAgo, type Memory } from "../lib/api";
import { Badge, StatusBadge, Button, Card } from "./ui";

export function MemoryCard({ memory }: { memory: Memory }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(memory.title);
  const [content, setContent] = useState(memory.content);
  const [type, setType] = useState(memory.type);
  const [paths, setPaths] = useState((memory.paths ?? []).join(", "));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["memories"] });
    qc.invalidateQueries({ queryKey: ["workspace-memories"] });
    qc.invalidateQueries({ queryKey: ["workspaces"] }); // pending-review badges
    qc.invalidateQueries({ queryKey: ["workspace"] });
  };

  const setStatus = useMutation({
    mutationFn: (action: "approve" | "reject" | "archive") =>
      api(`/memories/${memory.id}/${action}`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const split = useMutation({
    mutationFn: () => api(`/memories/${memory.id}/split`, { method: "POST" }),
    onSuccess: invalidate,
  });
  const splittable = memory.content.length > 280;

  const save = useMutation({
    mutationFn: () =>
      api(`/memories/${memory.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          content,
          type,
          paths: paths
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean),
        }),
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
          <label className="block">
            <span className="text-xs text-[var(--muted)]">
              File paths / globs (comma-separated) — for just-in-time warnings, e.g.{" "}
              <code>billing/**, *webhook*</code>
            </span>
            <input
              value={paths}
              onChange={(e) => setPaths(e.target.value)}
              placeholder="src/billing/**, **/webhooks.ts"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>
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
                setPaths((memory.paths ?? []).join(", "));
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
            {isStaleMemory(memory) ? (
              <span
                className="inline-flex items-center rounded-full border border-yellow-500/30 bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-300"
                title={`Not used or edited in ${STALE_DAYS}+ days — re-review or archive`}
              >
                stale
              </span>
            ) : null}
            <span className="text-xs text-[var(--muted)]">
              conf {Math.round(memory.confidence * 100)}%
            </span>
            <span
              className="text-xs text-[var(--faint)]"
              title={new Date(memory.createdAt).toLocaleString()}
            >
              · {timeAgo(memory.createdAt)}
            </span>
          </div>
          <h3 className="font-semibold">{memory.title}</h3>
          {memory.duplicateOf ? (
            <p className="mt-1 inline-flex items-center gap-1 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-200">
              Possible duplicate of an approved memory: “{memory.duplicateOf.title}”. Approving
              supersedes it.
            </p>
          ) : null}
          <p className="mt-1 text-sm text-[var(--muted)]">{memory.content}</p>
          {memory.paths?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {memory.paths.map((p) => (
                <span
                  key={p}
                  className="rounded border border-[var(--border)] bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-cyan-200"
                >
                  {p}
                </span>
              ))}
            </div>
          ) : null}
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
        <div className="flex shrink-0 items-center gap-3 text-xs">
          {splittable ? (
            <button
              onClick={() => split.mutate()}
              disabled={split.isPending}
              title="Break this long memory into atomic, concise memories (proposed for review)"
              className="text-[var(--muted)] hover:text-white disabled:opacity-50"
            >
              {split.isPending ? "Splitting…" : "Split"}
            </button>
          ) : null}
          <button
            onClick={() => setEditing(true)}
            className="text-[var(--muted)] hover:text-white"
          >
            Edit
          </button>
        </div>
      </div>
      {split.isError ? (
        <p className="mt-2 text-xs text-red-400">{(split.error as Error).message}</p>
      ) : null}
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
