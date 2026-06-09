export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3008";

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  joinCode: string;
  role: string;
}

export interface Me {
  id: string;
  email: string;
  name: string | null;
  workspaces: Workspace[];
}

export interface RepoSummary {
  id: string;
  name: string;
  fullName: string;
  provider: string;
  stack: string[];
  packageManager: string | null;
  workspace?: { name: string; slug: string };
  _count?: { memories: number };
}

export interface Memory {
  id: string;
  repoId: string;
  type: string;
  title: string;
  content: string;
  scope: string;
  confidence: number;
  status: string;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  evidence?: { id: string; kind: string; content: string; url: string | null }[];
}
