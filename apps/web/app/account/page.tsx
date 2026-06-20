"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, API_BASE_URL, type Me, type ApiTokenInfo } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { CopyButton } from "../../components/CopyButton";
import { Button, Card, Code, PageHeader } from "../../components/ui";

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
            Used by the CLI and MCP server. One token authenticates you across all your projects.
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
