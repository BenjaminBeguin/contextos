"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, API_BASE_URL, type Me, type WorkspaceDetail, type ApiTokenInfo } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { useActiveWorkspace } from "../../lib/workspace";
import { CopyButton } from "../../components/CopyButton";
import { Button, Card, Code, Input } from "../../components/ui";

export default function SettingsPage() {
  return (
    <AppShell>
      <Settings />
    </AppShell>
  );
}

function Settings() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  const { activeId: activeWs } = useActiveWorkspace();
  const role = me?.workspaces.find((w) => w.id === activeWs)?.role;
  const isOwner = role === "owner";

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
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <span className="text-sm text-[var(--muted)]">
          Editing <span className="text-white">{me?.workspaces.find((w) => w.id === activeWs)?.name}</span>
          {" "}· switch workspace in the top bar
        </span>
      </div>

      {activeWs ? (
        <WorkspaceSettings key={activeWs} workspaceId={activeWs} isOwner={isOwner} />
      ) : null}

      <div className="mt-10 border-t border-[var(--border)] pt-6">
        <h2 className="text-lg font-semibold">Account</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          These apply to you across every workspace — they aren&apos;t tied to the workspace
          selected above.
        </p>
      </div>
      <GitHubCard me={me} />
      <TokensCard />
    </div>
  );
}

function WorkspaceSettings({ workspaceId, isOwner }: { workspaceId: string; isOwner: boolean }) {
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

  if (!ws) return <Card className="mt-6 p-6 text-[var(--muted)]">Loading…</Card>;

  return (
    <>
      <Card className="mt-6 p-6">
        <h2 className="font-semibold">Workspace</h2>
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

      <Card className="mt-6 p-6">
        <h2 className="font-semibold">Members</h2>
        <ul className="mt-4 space-y-2">
          {ws.memberships.map((m) => (
            <li key={m.user.id} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                {m.user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.user.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
                ) : (
                  <span className="h-6 w-6 rounded-full bg-white/10" />
                )}
                {m.user.name ?? m.user.email}
              </span>
              <span className="text-xs text-[var(--muted)]">{m.role}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-6 p-6">
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
                <span className="text-xs text-[var(--muted)]">
                  {r._count?.memories ?? 0} memories
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
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
    <Card className="mt-6 p-6">
      <h2 className="font-semibold">AI provider (Anthropic key)</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Add your own Anthropic API key to power AI features — codebase scan, session extraction,
        living docs, and chat — on your own billing. Without a key, those run a deterministic
        fallback (no AI cost).
      </p>
      <p className="mt-3 text-sm">
        {hasKey ? (
          <span className="text-emerald-300">✓ Key configured for this workspace</span>
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
          {save.isError ? (
            <p className="text-sm text-red-400">{(save.error as Error).message}</p>
          ) : null}
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

  const conflict = approveOn && rejectOn && rejectPct >= approvePct;

  return (
    <Card className="mt-6 p-6">
      <h2 className="font-semibold">Automatic triage</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Route new proposed memories by confidence so the inbox only holds the ones that need a
        human call.
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
          {save.isSuccess ? (
            <span className="ml-2 text-xs text-emerald-300">Saved</span>
          ) : null}
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
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="accent-[var(--accent)]" />
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

function GitHubCard({ me }: { me?: Me }) {
  return (
    <Card className="mt-6 p-6">
      <h2 className="font-semibold">Connections</h2>
      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-sm">GitHub</p>
          <p className="text-xs text-[var(--muted)]">
            {me?.githubConnected
              ? "Connected — used for the repo picker."
              : "Not connected. Connect to list your repositories."}
          </p>
        </div>
        <a
          href={`${API_BASE_URL}/auth/github/login`}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-white/5"
        >
          {me?.githubConnected ? "Reconnect" : "Connect GitHub"}
        </a>
      </div>
    </Card>
  );
}

function TokensCard() {
  const qc = useQueryClient();
  const { data: tokens } = useQuery({
    queryKey: ["tokens"],
    queryFn: () => api<ApiTokenInfo[]>("/auth/tokens"),
  });
  const [newToken, setNewToken] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api<{ token: string }>("/auth/tokens", { method: "POST", body: "{}" }),
    onSuccess: (d) => {
      setNewToken(d.token);
      qc.invalidateQueries({ queryKey: ["tokens"] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/auth/tokens/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tokens"] }),
  });

  return (
    <Card className="mt-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">API tokens</h2>
          <p className="text-xs text-[var(--muted)]">
            Used by the CLI and MCP server. One token authenticates you across all your workspaces.
          </p>
        </div>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? "Creating…" : "New token"}
        </Button>
      </div>

      {newToken ? (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs text-yellow-300">Copy it now — it won&apos;t be shown again.</p>
            <CopyButton value={newToken} />
          </div>
          <Code>{newToken}</Code>
        </div>
      ) : null}

      <ul className="mt-4 space-y-2">
        {tokens?.length === 0 ? (
          <li className="text-sm text-[var(--muted)]">No tokens yet.</li>
        ) : null}
        {tokens?.map((t) => (
          <li key={t.id} className="flex items-center justify-between text-sm">
            <span>
              {t.name}{" "}
              <span className="text-xs text-[var(--muted)]">
                · created {new Date(t.createdAt).toLocaleDateString()}
                {t.lastUsedAt ? ` · last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : ""}
              </span>
            </span>
            <Button variant="danger" onClick={() => revoke.mutate(t.id)} disabled={revoke.isPending}>
              Revoke
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
