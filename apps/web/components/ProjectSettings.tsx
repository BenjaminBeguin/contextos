"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Me, type WorkspaceDetail } from "../lib/api";
import { CopyButton } from "./CopyButton";
import { Button, Card, Input } from "./ui";

/** Project (workspace) settings: rename, join code, AI key, triage, members, repos. */
export function ProjectSettings({ workspaceId, isOwner }: { workspaceId: string; isOwner: boolean }) {
  const qc = useQueryClient();
  const { data: ws } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => api<WorkspaceDetail>(`/workspaces/${workspaceId}`),
  });
  const [name, setName] = useState("");

  const rename = useMutation({
    mutationFn: () =>
      api(`/workspaces/${workspaceId}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
  const rotate = useMutation({
    mutationFn: () => api(`/workspaces/${workspaceId}/rotate-join-code`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  if (!ws) return <Card className="p-6 text-[var(--muted)]">Loading…</Card>;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="font-semibold">Project</h2>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Input
            defaultValue={ws.name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isOwner}
            className="w-56 disabled:opacity-60"
          />
          {isOwner ? (
            <Button onClick={() => rename.mutate()} disabled={!name || rename.isPending}>
              {rename.isPending ? "Saving…" : "Rename"}
            </Button>
          ) : (
            <span className="text-xs text-[var(--muted)]">Only owners can edit</span>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4">
          <div>
            <p className="text-sm">Join code</p>
            <p className="text-xs text-[var(--muted)]">Share to invite teammates.</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="rounded-md border border-[var(--border)] bg-black/40 px-3 py-1 text-sm">
              {ws.joinCode}
            </code>
            <CopyButton value={ws.joinCode} />
            {isOwner ? (
              <Button variant="ghost" onClick={() => rotate.mutate()} disabled={rotate.isPending}>
                {rotate.isPending ? "…" : "Rotate"}
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <AiKeyCard workspaceId={workspaceId} hasKey={!!ws.hasAnthropicKey} isOwner={isOwner} />

      <AutoTriageCard
        workspaceId={workspaceId}
        approve={ws.autoApproveThreshold ?? null}
        reject={ws.autoRejectThreshold ?? null}
        isOwner={isOwner}
      />

      <MembersCard workspaceId={workspaceId} memberships={ws.memberships} isOwner={isOwner} />

      <Card className="p-6">
        <h2 className="font-semibold">Repositories</h2>
        {ws.repos.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No repos yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {ws.repos.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm">
                <Link href={`/repos/${r.id}`} className="hover:text-white">
                  {r.fullName}
                </Link>
                <span className="text-xs text-[var(--muted)]">{r._count?.memories ?? 0} memories</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function MembersCard({
  workspaceId,
  memberships,
  isOwner,
}: {
  workspaceId: string;
  memberships: WorkspaceDetail["memberships"];
  isOwner: boolean;
}) {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  const [email, setEmail] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });

  const invite = useMutation({
    mutationFn: () =>
      api(`/workspaces/${workspaceId}/members`, {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    onSuccess: () => {
      setEmail("");
      invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (userId: string) =>
      api(`/workspaces/${workspaceId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Members</h2>
      <ul className="mt-4 space-y-2">
        {memberships.map((m) => (
          <li key={m.user.id} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              {m.user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.user.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
              ) : (
                <span className="h-6 w-6 rounded-full bg-white/10" />
              )}
              {m.user.name ?? m.user.email}
              {m.user.id === me?.id ? (
                <span className="text-xs text-[var(--faint)]">(you)</span>
              ) : null}
            </span>
            <span className="flex items-center gap-3">
              <span className="text-xs text-[var(--muted)]">{m.role}</span>
              {isOwner ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove.mutate(m.user.id)}
                  disabled={remove.isPending}
                >
                  Remove
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {isOwner ? (
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <p className="text-sm">Invite a teammate</p>
          <p className="text-xs text-[var(--muted)]">
            They need a Cortex account. Otherwise share the join code above so they can sign up and
            join.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              className="min-w-56 flex-1"
            />
            <Button onClick={() => invite.mutate()} disabled={!email} loading={invite.isPending}>
              Invite
            </Button>
          </div>
          {invite.isError ? (
            <p className="mt-2 text-sm text-red-400">{(invite.error as Error).message}</p>
          ) : null}
          {invite.isSuccess ? <p className="mt-2 text-xs text-emerald-300">Added.</p> : null}
          {remove.isError ? (
            <p className="mt-2 text-sm text-red-400">{(remove.error as Error).message}</p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function AiKeyCard({
  workspaceId,
  hasKey,
  isOwner,
}: {
  workspaceId: string;
  hasKey: boolean;
  isOwner: boolean;
}) {
  const qc = useQueryClient();
  const [key, setKey] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });

  const save = useMutation({
    mutationFn: () =>
      api(`/workspaces/${workspaceId}/anthropic-key`, {
        method: "PUT",
        body: JSON.stringify({ key }),
      }),
    onSuccess: () => {
      setKey("");
      invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/workspaces/${workspaceId}/anthropic-key`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  return (
    <Card className="p-6">
      <h2 className="font-semibold">AI provider (Anthropic key)</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Add your own Anthropic API key to power AI features — codebase scan, session extraction,
        living docs, and chat — on your own billing. Without a key, those run a deterministic
        fallback (no AI cost).
      </p>
      <p className="mt-3 text-sm">
        {hasKey ? (
          <span className="text-emerald-300">✓ Key configured for this project</span>
        ) : (
          <span className="text-[var(--muted)]">No key set</span>
        )}
      </p>

      {isOwner ? (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sk-ant-…"
              className="min-w-64 flex-1"
            />
            <Button onClick={() => save.mutate()} disabled={!key || save.isPending}>
              {save.isPending ? "Saving…" : hasKey ? "Replace" : "Save key"}
            </Button>
            {hasKey ? (
              <Button variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
                Remove
              </Button>
            ) : null}
          </div>
          {save.isError ? <p className="text-sm text-red-400">{(save.error as Error).message}</p> : null}
          <p className="text-xs text-[var(--muted)]">
            Stored encrypted; never shown again. Get a key at console.anthropic.com.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-[var(--muted)]">Only owners can manage the API key.</p>
      )}
    </Card>
  );
}

function AutoTriageCard({
  workspaceId,
  approve,
  reject,
  isOwner,
}: {
  workspaceId: string;
  approve: number | null;
  reject: number | null;
  isOwner: boolean;
}) {
  const qc = useQueryClient();
  const [approveOn, setApproveOn] = useState(approve != null);
  const [approvePct, setApprovePct] = useState(Math.round((approve ?? 0.85) * 100));
  const [rejectOn, setRejectOn] = useState(reject != null);
  const [rejectPct, setRejectPct] = useState(Math.round((reject ?? 0.4) * 100));

  const save = useMutation({
    mutationFn: () =>
      api(`/workspaces/${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify({
          autoApproveThreshold: approveOn ? approvePct / 100 : null,
          autoRejectThreshold: rejectOn ? rejectPct / 100 : null,
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace", workspaceId] }),
  });

  // Apply the SAVED band to existing proposed memories (auto-triage only runs at creation).
  const reTriage = useMutation({
    mutationFn: () =>
      api<{ approved: number; rejected: number; kept: number }>(
        `/workspaces/${workspaceId}/triage`,
        { method: "POST" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      qc.invalidateQueries({ queryKey: ["memories"] });
      qc.invalidateQueries({ queryKey: ["workspace-memories"] });
    },
  });
  const hasSaved = approve != null || reject != null;

  const conflict = approveOn && rejectOn && rejectPct >= approvePct;

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Automatic triage</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Route new proposed memories by confidence so the inbox only holds the ones that need a human
        call.
      </p>

      <p className="mt-3 text-sm text-[var(--muted)]">
        {approveOn ? (
          <span className="text-emerald-300">≥ {approvePct}% → auto-approve</span>
        ) : (
          <span>approve: off</span>
        )}
        {"  ·  "}
        {rejectOn ? (
          <span className="text-red-300">&lt; {rejectPct}% → auto-reject</span>
        ) : (
          <span>reject: off</span>
        )}
        {"  ·  "}
        <span>everything else → inbox</span>
      </p>

      {isOwner ? (
        <div className="mt-5 space-y-4">
          <TriageRow
            label="Auto-approve at or above"
            on={approveOn}
            setOn={setApproveOn}
            pct={approvePct}
            setPct={setApprovePct}
            accent="accent-emerald-400"
          />
          <TriageRow
            label="Auto-reject below"
            on={rejectOn}
            setOn={setRejectOn}
            pct={rejectPct}
            setPct={setRejectPct}
            accent="accent-red-400"
          />
          {conflict ? (
            <p className="text-xs text-yellow-300">
              The reject threshold should be lower than the approve threshold.
            </p>
          ) : null}
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={conflict}>
            Save triage rules
          </Button>
          {save.isSuccess ? <span className="ml-2 text-xs text-emerald-300">Saved</span> : null}

          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <p className="text-sm">Apply to existing proposals</p>
            <p className="text-xs text-[var(--muted)]">
              Auto-triage only runs on new memories. Run it across everything already in the inbox
              using your <em>saved</em> thresholds.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                variant="subtle"
                onClick={() => reTriage.mutate()}
                loading={reTriage.isPending}
                disabled={!hasSaved}
              >
                Re-triage inbox
              </Button>
              {!hasSaved ? (
                <span className="text-xs text-[var(--faint)]">Save a threshold first.</span>
              ) : null}
              {reTriage.isSuccess ? (
                <span className="text-xs text-emerald-300">
                  Approved {reTriage.data.approved} · rejected {reTriage.data.rejected} ·{" "}
                  {reTriage.data.kept} left for review
                </span>
              ) : null}
              {reTriage.isError ? (
                <span className="text-xs text-red-400">{(reTriage.error as Error).message}</span>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-[var(--muted)]">Only owners can change this.</p>
      )}
    </Card>
  );
}

function TriageRow({
  label,
  on,
  setOn,
  pct,
  setPct,
  accent,
}: {
  label: string;
  on: boolean;
  setOn: (v: boolean) => void;
  pct: number;
  setPct: (v: number) => void;
  accent: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex w-52 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="accent-[var(--accent)]"
        />
        {label}
      </label>
      <input
        type="range"
        min={5}
        max={100}
        step={5}
        value={pct}
        onChange={(e) => setPct(Number(e.target.value))}
        disabled={!on}
        className={`h-1.5 w-56 max-w-full cursor-pointer ${accent} disabled:opacity-40`}
      />
      <span className={`w-12 text-sm tabular-nums ${on ? "" : "text-[var(--faint)]"}`}>{pct}%</span>
    </div>
  );
}
