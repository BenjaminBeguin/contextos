"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Workspace } from "../lib/api";
import { Button, Card, Input } from "./ui";

/** Create-or-join project (workspace) forms, shared by the dashboard and the rail modal. */
export function ProjectForms({ onDone }: { onDone?: (workspaceId?: string) => void }) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["me"] });
    qc.invalidateQueries({ queryKey: ["workspaces"] });
    qc.invalidateQueries({ queryKey: ["repos"] });
  };

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api<Workspace>("/workspaces", {
        method: "POST",
        body: JSON.stringify({ name, slug: slug || name.toLowerCase().replace(/[^a-z0-9-]/g, "-") }),
      }),
    onSuccess: (ws) => {
      refresh();
      onDone?.(ws.id);
    },
  });

  const join = useMutation({
    mutationFn: () =>
      api<{ id?: string }>("/workspaces/join", {
        method: "POST",
        body: JSON.stringify({ joinCode }),
      }),
    onSuccess: (res) => {
      refresh();
      onDone?.(res?.id);
    },
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="p-6">
        <h2 className="font-semibold">Create a project</h2>
        <div className="mt-4 space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" />
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug (optional)" />
          <Button onClick={() => create.mutate()} disabled={!name} loading={create.isPending}>
            {create.isPending ? "Creating…" : "Create project"}
          </Button>
          {create.isError ? (
            <p className="text-sm text-red-400">{(create.error as Error).message}</p>
          ) : null}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold">Join a project</h2>
        <div className="mt-4 space-y-3">
          <Input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Join code (e.g. WS-1A2B3C4D)"
          />
          <Button onClick={() => join.mutate()} disabled={!joinCode} loading={join.isPending}>
            {join.isPending ? "Joining…" : "Join project"}
          </Button>
          {join.isError ? <p className="text-sm text-red-400">{(join.error as Error).message}</p> : null}
        </div>
      </Card>
    </div>
  );
}
