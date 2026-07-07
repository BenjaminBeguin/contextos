"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, API_BASE_URL } from "../../lib/api";
import { Button, Card, Input } from "../../components/ui";

interface AuthConfig {
  github: boolean;
  devLogin: boolean;
}

export default function LoginPage() {
  const router = useRouter();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [email, setEmail] = useState("dev@cortex.dev");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/auth/config`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => c && setConfig(c))
      .catch(() => setConfig({ github: false, devLogin: true }));

    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) setError("GitHub sign-in failed. Please try again.");
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api("/auth/login", { method: "POST", body: JSON.stringify({ email }) });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-sm p-8">
        <Link href="/" className="mb-6 flex items-center gap-2.5 font-semibold">
          <span className="inline-block h-4 w-4 rotate-45 rounded-sm bg-gradient-to-br from-[var(--accent)] via-[#b5179e] to-[var(--signal)] shadow-[0_0_14px_rgba(255,180,84,0.45)]" />
          <span className="font-display">Cortex</span>
        </Link>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Connect your account to manage your team&apos;s memory.
        </p>

        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

        {/* GitHub is the primary method — keep it the most prominent action. */}
        {config?.github ? (
          <a
            href={`${API_BASE_URL}/auth/github/login`}
            className="group mt-6 flex w-full items-center justify-center gap-2.5 rounded-lg bg-white px-3 py-3 text-sm font-semibold text-[#0d1117] shadow-[0_2px_16px_-4px_rgba(0,0,0,0.5)] ring-1 ring-black/10 transition hover:bg-white hover:shadow-[0_4px_22px_-4px_rgba(255,180,84,0.45)] hover:ring-black/20 active:scale-[0.99]"
          >
            <svg width="19" height="19" viewBox="0 0 16 16" fill="#0d1117" aria-hidden>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Continue with GitHub
          </a>
        ) : null}

        {/* Dev email login (local/non-production only) */}
        {config?.devLogin ? (
          <>
            {config.github ? (
              <div className="my-5 flex items-center gap-3 text-xs text-[var(--muted)]">
                <span className="h-px flex-1 bg-[var(--border)]" />
                dev login
                <span className="h-px flex-1 bg-[var(--border)]" />
              </div>
            ) : null}
            <form onSubmit={onSubmit} className="space-y-3">
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
              <Button type="submit" variant="ghost" loading={loading} className="w-full">
                {loading ? "Signing in…" : "Continue with email"}
              </Button>
            </form>
          </>
        ) : null}

        {config && !config.github && !config.devLogin ? (
          <p className="mt-6 text-sm text-[var(--muted)]">
            No sign-in method is configured. Set up GitHub OAuth on the API.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
