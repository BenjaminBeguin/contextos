export interface ApiClientOptions {
  baseUrl: string;
  token?: string;
}

export async function apiFetch<T>(
  opts: ApiClientOptions,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;

  const res = await fetch(`${opts.baseUrl}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = body?.error ?? res.statusText;
    throw new Error(`API ${res.status}: ${message}`);
  }
  return body as T;
}
