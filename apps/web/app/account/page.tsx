"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, API_BASE_URL, type Me, type ApiTokenInfo } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { CopyButton } from "../../components/CopyButton";
import { Button, Card, Code, Input, PageHeader } from "../../components/ui";

export default function AccountPage() {
  return (
    <AppShell>
      <Account />
    </AppShell>
  );
}

function Account() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Account"
        description="Settings tied to you, across every project — sign-in connections and API tokens."
      />
      {me ? (
        <Card className="p-6">
          <h2 className="font-semibold">Profile</h2>
          <div className="mt-3 flex items-center gap-3 text-sm">
            {me.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.avatarUrl} alt="" className="h-9 w-9 rounded-full ring-1 ring-[var(--border)]" />
            ) : null}
            <div>
              <p>{me.name ?? me.email}</p>
              <p className="text-xs text-[var(--muted)]">{me.email}</p>
            </div>
          </div>
        </Card>
      ) : null}
      <GitHubCard me={me} />
      <TokensCard />
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

type TokenScope = "cli" | "mcp" | "both";

const SCOPE_OPTIONS: { value: TokenScope; label: string; hint: string }[] = [
  { value: "both", label: "Both", hint: "CLI + MCP server" },
  { value: "cli", label: "CLI", hint: "cortex commands" },
  { value: "mcp", label: "MCP", hint: "Claude Code MCP server" },
];

const SCOPE_LABEL: Record<TokenScope, string> = { both: "CLI + MCP", cli: "CLI", mcp: "MCP" };

function TokensCard() {
  const qc = useQueryClient();
  const { data: tokens } = useQuery({
    queryKey: ["tokens"],
    queryFn: () => api<ApiTokenInfo[]>("/auth/tokens"),
  });
  const [newToken, setNewToken] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<TokenScope>("both");

  const create = useMutation({
    mutationFn: () =>
      api<{ token: string }>("/auth/tokens", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() || "cli", scope }),
      }),
    onSuccess: (d) => {
      setNewToken(d.token);
      setCreating(false);
      setName("");
      setScope("both");
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
            Used by the CLI and MCP server. One token authenticates you across all your projects.
          </p>
        </div>
        <Button
          variant={creating ? "ghost" : "primary"}
          onClick={() => {
            setCreating((v) => !v);
            setNewToken(null);
          }}
        >
          {creating ? "Cancel" : "New token"}
        </Button>
      </div>

      {creating ? (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. laptop-cli, ci, claude-desktop"
              autoFocus
            />
          </label>
          <div className="mt-4">
            <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Scope</span>
            <div className="grid grid-cols-3 gap-2">
              {SCOPE_OPTIONS.map((o) => {
                const active = scope === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setScope(o.value)}
                    className={
                      "rounded-lg border px-3 py-2 text-left transition " +
                      (active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border)] hover:border-[var(--border-strong)]")
                    }
                  >
                    <span className="block text-sm font-medium">{o.label}</span>
                    <span className="block text-[11px] text-[var(--muted)]">{o.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => create.mutate()} loading={create.isPending}>
              Create token
            </Button>
          </div>
        </div>
      ) : null}

      {newToken ? (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs text-yellow-300">Copy it now — it won&apos;t be shown again.</p>
            <CopyButton value={newToken} />
          </div>
          <Code label="api token">{newToken}</Code>
        </div>
      ) : null}

      <ul className="mt-4 space-y-2">
        {tokens?.length === 0 ? (
          <li className="text-sm text-[var(--muted)]">No tokens yet.</li>
        ) : null}
        {tokens?.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0">
              <span className="inline-flex items-center gap-2">
                <span className="truncate font-medium">{t.name}</span>
                <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  {SCOPE_LABEL[t.scope] ?? t.scope}
                </span>
              </span>
              <span className="block text-xs text-[var(--muted)]">
                created {new Date(t.createdAt).toLocaleDateString()}
                {t.lastUsedAt ? ` · last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : ""}
              </span>
            </span>
            <Button
              variant="danger"
              size="sm"
              onClick={() => revoke.mutate(t.id)}
              disabled={revoke.isPending}
            >
              Revoke
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
