"use client";

import { use } from "react";
import { AppShell } from "../../../components/AppShell";
import { RepoNav } from "../../../components/RepoNav";
import { RepoSettings } from "../../../components/RepoSettings";

export default function RepoPage({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId } = use(params);
  return (
    <AppShell>
      <RepoNav repoId={repoId} />
      <RepoSettings repoId={repoId} />
    </AppShell>
  );
}
