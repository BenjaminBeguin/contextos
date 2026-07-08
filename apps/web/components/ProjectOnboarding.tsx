"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createToken } from "../lib/api";
import { CopyButton } from "./CopyButton";
import { Button, Card, Code } from "./ui";

const PKG = "@mxbenjaminbeguin/cortex";

/** First-run guide for a project with no repos yet. Walks install → a
    project-scoped token generated inline → connect a repo, so a new owner can
    get from empty to connected without leaving the page. */
export function ProjectOnboarding({
  workspaceId,
  projectName,
  color,
  onConnectRepo,
}: {
  workspaceId: string;
  projectName: string;
  color: string;
  onConnectRepo: () => void;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div
        className="border-b border-[var(--border)] px-6 py-5"
        style={{
          background: `linear-gradient(120deg, color-mix(in oklab, ${color}, transparent 88%), transparent 60%)`,
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: color, boxShadow: `0 0 12px ${color}` }}
            aria-hidden
          />
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Let&apos;s connect {projectName}
          </h2>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Three steps and Claude Code starts retrieving this project&apos;s approved memory before it
          acts. We&apos;ll generate a project token for you along the way.
        </p>
      </div>

      <div className="space-y-6 p-6">
        <OnboardingStep n={1} title="Install the CLI">
          <CommandRow command={`npm install -g ${PKG}`} />
          <p className="mt-2 text-xs text-[var(--faint)]">
            Installs the <code className="text-[var(--muted)]">cortex</code> command. Requires Node 20+.
          </p>
        </OnboardingStep>

        <OnboardingStep n={2} title="Generate a project token">
          <p className="text-sm text-[var(--muted)]">
            Scoped to <span className="text-[var(--text)]">{projectName}</span> only — it can reach
            this project&apos;s repos and nothing else. Authenticate the CLI with it.
          </p>
          <ProjectTokenGenerator workspaceId={workspaceId} projectName={projectName} />
        </OnboardingStep>

        <OnboardingStep n={3} title="Connect your first repo" last>
          <p className="text-sm text-[var(--muted)]">
            Link a repository, then run <code className="text-[var(--text)]">cortex init</code> in it
            to write the memory hooks and MCP config.
          </p>
          <div className="mt-3">
            <Button onClick={onConnectRepo}>Connect a repo →</Button>
          </div>
        </OnboardingStep>
      </div>
    </Card>
  );
}

function ProjectTokenGenerator({
  workspaceId,
  projectName,
}: {
  workspaceId: string;
  projectName: string;
}) {
  const [token, setToken] = useState<string | null>(null);
  const gen = useMutation({
    mutationFn: () =>
      createToken({ name: `${projectName} CLI`, scope: "both", workspaceId }),
    onSuccess: (d) => setToken(d.token),
  });

  if (token) {
    return (
      <div className="mt-3 space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs text-[var(--signal)]">Copy it now — it won&apos;t be shown again.</p>
            <CopyButton value={token} />
          </div>
          <Code label="project token">{token}</Code>
        </div>
        <div>
          <p className="mb-1 text-xs text-[var(--muted)]">Authenticate the CLI:</p>
          <CommandRow command={`cortex login --token ${token}`} />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <Button variant="primary" onClick={() => gen.mutate()} loading={gen.isPending}>
        Generate token for this project
      </Button>
      {gen.isError ? (
        <p className="mt-2 text-xs text-[var(--alert)]">{(gen.error as Error).message}</p>
      ) : null}
    </div>
  );
}

function CommandRow({ command }: { command: string }) {
  // `Code` already renders a copy button in its window chrome.
  return <Code label="shell">{command}</Code>;
}

function OnboardingStep({
  n,
  title,
  children,
  last,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className="relative flex gap-4">
      {!last ? (
        <span
          className="absolute left-[15px] top-8 bottom-[-24px] w-px bg-[var(--border)]"
          aria-hidden
        />
      ) : null}
      <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-2)] text-sm font-semibold">
        {n}
      </span>
      <div className="min-w-0 flex-1 pb-1">
        <h3 className="font-medium">{title}</h3>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
