import { DOC_TITLES, DOC_TYPES, type DocType } from "@memmo/shared";
import { prisma } from "../db.js";
import { complete, type LlmConfig } from "./llm.js";
import { memoryStoreForRepo } from "./memoryStore.js";

interface MemoryLite {
  type: string;
  title: string;
  content: string;
  confidence: number;
}

function byTypes(memories: MemoryLite[], types: string[]): MemoryLite[] {
  return memories.filter((m) => types.includes(m.type));
}

function list(memories: MemoryLite[]): string {
  if (memories.length === 0) return "_None recorded yet._";
  return memories.map((m) => `- **${m.title}** — ${m.content}`).join("\n");
}

function buildOverview(repo: RepoForDocs, memories: MemoryLite[]): string {
  const risks = byTypes(memories, ["risk", "failure"]);
  return [
    `# ${repo.fullName}`,
    "",
    `- **Stack:** ${repo.stack.length ? repo.stack.join(", ") : "—"}`,
    `- **Package manager:** ${repo.packageManager ?? "—"}`,
    `- **Approved memories:** ${memories.length}`,
    repo.notes ? `\n${repo.notes}` : "",
    "",
    "## Architecture & rules",
    list(byTypes(memories, ["architecture", "project_rule", "decision", "workflow"])),
    "",
    "## Top risks",
    list(risks.slice(0, 5)),
  ].join("\n");
}

function buildCommands(memories: MemoryLite[]): string {
  return [
    "# Commands",
    "",
    "Commands and testing/deployment notes captured from real work.",
    "",
    list(byTypes(memories, ["command", "testing", "deployment"])),
  ].join("\n");
}

function buildRisks(memories: MemoryLite[]): string {
  return [
    "# Known Risks",
    "",
    "Things to check before editing sensitive areas.",
    "",
    list(byTypes(memories, ["risk", "failure", "dependency"])),
  ].join("\n");
}

function buildOnboardingHeuristic(repo: RepoForDocs, memories: MemoryLite[]): string {
  return [
    `# Onboarding — ${repo.fullName}`,
    "",
    `This repo uses ${repo.stack.join(", ") || "an unspecified stack"}` +
      (repo.packageManager ? ` with ${repo.packageManager}.` : "."),
    "",
    "## Conventions & decisions",
    list(byTypes(memories, ["project_rule", "decision", "architecture", "workflow"])),
    "",
    "## How to run & test",
    list(byTypes(memories, ["command", "testing", "deployment"])),
    "",
    "## Watch out for",
    list(byTypes(memories, ["risk", "failure"])),
  ].join("\n");
}

const ONBOARDING_SYSTEM = `You write a concise onboarding guide (GitHub-flavored markdown) for an engineer
new to a repository, based ONLY on the provided structured memories. Be practical and specific.
Use short sections: overview, conventions, how to run/test, and what to watch out for. Do not invent facts.`;

async function buildOnboarding(
  repo: RepoForDocs,
  memories: MemoryLite[],
  llm?: LlmConfig | null,
): Promise<string> {
  if (!llm) return buildOnboardingHeuristic(repo, memories);
  try {
    const payload = JSON.stringify({
      repo: { fullName: repo.fullName, stack: repo.stack, packageManager: repo.packageManager },
      memories: memories.map((m) => ({ type: m.type, title: m.title, content: m.content })),
    });
    const md = await complete(llm, ONBOARDING_SYSTEM, payload, 1500);
    return md.trim() || buildOnboardingHeuristic(repo, memories);
  } catch {
    return buildOnboardingHeuristic(repo, memories);
  }
}

interface RepoForDocs {
  id: string;
  fullName: string;
  stack: string[];
  packageManager: string | null;
  notes: string | null;
}

/** (Re)generate the standard doc set for a repo from its approved memories. */
export async function generateDocs(
  repo: RepoForDocs,
  llm?: LlmConfig | null,
): Promise<{ type: DocType; title: string }[]> {
  // Routed through the repo's memory store (BYODB reads the customer's DB).
  const { store } = await memoryStoreForRepo(repo.id);
  const memories = (await store.listByRepo(repo.id, { status: "approved" })).sort(
    (a, b) => b.confidence - a.confidence,
  );

  const content: Record<DocType, string> = {
    overview: buildOverview(repo, memories),
    commands: buildCommands(memories),
    risks: buildRisks(memories),
    onboarding: await buildOnboarding(repo, memories, llm),
  };

  await prisma.$transaction(
    DOC_TYPES.map((type) =>
      prisma.generatedDoc.deleteMany({ where: { repoId: repo.id, type } }),
    ),
  );
  await prisma.generatedDoc.createMany({
    data: DOC_TYPES.map((type) => ({
      repoId: repo.id,
      type,
      title: DOC_TITLES[type],
      content: content[type],
    })),
  });

  return DOC_TYPES.map((type) => ({ type, title: DOC_TITLES[type] }));
}
