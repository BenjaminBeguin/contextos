"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createOrg, joinOrg, type OrgSummary } from "../lib/api";
import { setActiveOrgId } from "../lib/activeOrg";
import { Button, Card, Input } from "./ui";

/** Create-or-join organization forms, shared by the dashboard and the rail modal. */
export function OrgForms({ onDone }: { onDone?: (orgId?: string) => void }) {
  const qc = useQueryClient();
  const done = (o?: OrgSummary) => {
    qc.invalidateQueries({ queryKey: ["orgs"] });
    qc.invalidateQueries({ queryKey: ["me"] });
    qc.invalidateQueries({ queryKey: ["workspaces"] });
    if (o) setActiveOrgId(o.id);
    onDone?.(o?.id);
  };

  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const create = useMutation({ mutationFn: () => createOrg(name), onSuccess: done });
  const join = useMutation({ mutationFn: () => joinOrg(code.trim()), onSuccess: done });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="p-6">
        <h2 className="font-semibold">Create an organization</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          A billing container for your team&apos;s projects.
        </p>
        <div className="mt-4 space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Organization name" />
          <Button onClick={() => create.mutate()} disabled={!name} loading={create.isPending}>
            {create.isPending ? "Creating…" : "Create organization"}
          </Button>
          {create.isError ? (
            <p className="text-sm text-red-400">{(create.error as Error).message}</p>
          ) : null}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold">Join an organization</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">Enter the code an admin shared with you.</p>
        <div className="mt-4 space-y-3">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Join code (e.g. ORG-1A2B3C4D)"
          />
          <Button onClick={() => join.mutate()} disabled={!code} loading={join.isPending}>
            {join.isPending ? "Joining…" : "Join organization"}
          </Button>
          {join.isError ? <p className="text-sm text-red-400">{(join.error as Error).message}</p> : null}
        </div>
      </Card>
    </div>
  );
}
