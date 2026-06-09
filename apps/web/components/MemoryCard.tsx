"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Memory } from "../lib/api";
import { Badge, StatusBadge, Button, Card } from "./ui";

export function MemoryCard({ memory }: { memory: Memory }) {
  const qc = useQueryClient();

  const setStatus = useMutation({
    mutationFn: (action: "approve" | "reject" | "archive") =>
      api(`/memories/${memory.id}/${action}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memories", memory.repoId] });
    },
  });

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
