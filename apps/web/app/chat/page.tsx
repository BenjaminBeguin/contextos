"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, type Me } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { ToolBreadcrumb } from "../../components/ToolBreadcrumb";
import { ChatTool } from "../../components/tools/ChatTool";
import { useActiveWorkspace } from "../../lib/workspace";
import { PageHeader } from "../../components/ui";

export default function ChatPage() {
  return (
    <AppShell>
      <Chat />
    </AppShell>
  );
}

function Chat() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  const { activeId } = useActiveWorkspace();

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
    <div>
      <ToolBreadcrumb section="Chat" />
      <PageHeader
        title="Chat with your memory"
        description="Answers are grounded in this project's approved memories."
      />
      <ChatTool workspaceId={activeId} />
    </div>
  );
}
