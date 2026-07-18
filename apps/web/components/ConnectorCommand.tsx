"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, API_BASE_URL } from "../lib/api";
import { Button } from "./ui";
import { CopyButton } from "./CopyButton";

/**
 * One-click hosted-connector setup: mint an account-wide token and show the
 * exact `claude mcp add --transport http` command. The remote endpoint resolves
 * the repo per call (via list_repos / the repo arg), so one connector covers
 * every repo the user can access.
 */
export function ConnectorCommand() {
  const [command, setCommand] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api<{ token: string }>("/auth/tokens", {
        method: "POST",
        body: JSON.stringify({ name: "Claude Code connector", scope: "mcp" }),
      }),
    onSuccess: (d) => {
      setCommand(
        `claude mcp add --transport http memmo ${API_BASE_URL}/mcp --header "Authorization: Bearer ${d.token}"`,
      );
    },
  });

  const isLocal = API_BASE_URL.includes("localhost") || API_BASE_URL.includes("127.0.0.1");

  if (!command) {
    return (
      <div>
        <Button onClick={() => create.mutate()} loading={create.isPending}>
          Generate connector command
        </Button>
        {create.isError ? (
          <p className="mt-2 text-sm text-red-400">{(create.error as Error).message}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-1.5">
          <span className="text-xs text-[var(--faint)]">shell</span>
          <CopyButton value={command} />
        </div>
        <pre className="overflow-x-auto px-3 py-3 text-xs leading-relaxed text-[var(--text)]">
          {command}
        </pre>
      </div>
      <p className="mt-2 text-xs text-[var(--faint)]">
        Includes a new account-wide token, shown once — store it safely. It reaches every repo you
        can access; the agent picks the repo per call. Manage or revoke it under{" "}
        <span className="text-[var(--muted)]">Account</span>.
      </p>
      {isLocal ? (
        <p className="mt-1 text-xs text-amber-300/90">
          The URL points at {API_BASE_URL} — a hosted connector needs the Memmo API reachable at a
          public URL.
        </p>
      ) : null}
    </div>
  );
}
