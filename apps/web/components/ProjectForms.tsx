"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Workspace } from "../lib/api";
import { Button, Card, Input } from "./ui";

/**
 * Create-or-join project (workspace) forms, shared by the dashboard and the rail
 * modal. When `org` is given, a new project is created inside that organization
 * (its billing container); otherwise it falls back to a standalone org.
 */
export function ProjectForms({
  onDone,
  org,
}: {
  onDone?: (workspaceId?: string) => void;
  org?: { id: string; name: string } | null;
}) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["me"] });
    qc.invalidateQueries({ queryKey: ["workspaces"] });
    qc.invalidateQueries({ queryKey: ["orgs"] });
    qc.invalidateQueries({ queryKey: ["repos"] });
  };

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const create = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({
        name,
        slug: slug || name.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      });
      // Scope the project to the current org; only fall back to a standalone org
      // when the user isn't in one yet.
      const path = org ? `/orgs/${org.id}/workspaces` : "/workspaces";
      return api<Workspace>(path, { method: "POST", body });
    },
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
        {org ? (
          <p className="mt-1 text-xs text-[var(--muted)]">
            in <span className="text-[var(--fg)]">{org.name}</span>
          </p>
        ) : null}
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
