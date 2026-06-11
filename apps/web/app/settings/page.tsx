"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, API_BASE_URL, type Me, type WorkspaceDetail, type ApiTokenInfo } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { CopyButton } from "../../components/CopyButton";
import { Button, Card, Code } from "../../components/ui";

export default function SettingsPage() {
  return (
    <AppShell>
      <Settings />
    </AppShell>
  );
}

function Settings() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  const [ws, setWs] = useState<string>("");
  const activeWs = ws || me?.workspaces[0]?.id || "";
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

      {activeWs ? <WorkspaceSettings workspaceId={activeWs} isOwner={isOwner} /> : null}
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
          <input
            defaultValue={ws.name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isOwner}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] disabled:opacity-60"
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
          <p className="text-xs text-[var(--muted)]">Used by the CLI and MCP server.</p>
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
