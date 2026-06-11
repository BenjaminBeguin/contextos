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
    ...(init.headers as Record<string, string> | undefined),
  };
  // Only send a JSON content-type when there's a body (Fastify rejects an empty
  // body that carries Content-Type: application/json).
  if (init.body != null && headers["content-type"] === undefined) {
    headers["content-type"] = "application/json";
  }
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
