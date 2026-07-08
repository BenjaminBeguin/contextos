"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PLANS, PLAN_LABELS, PLAN_LIMITS, type Plan } from "@cortex/shared";
import { startCheckout, requestUpgrade, type WorkspaceDetail } from "../lib/api";
import { Button, Card } from "./ui";

const PLAN_ACCENT: Record<Plan, string> = {
  free: "var(--muted)",
  scale: "var(--accent)",
  enterprise: "var(--verify)",
};

function limitText(n: number | null) {
  return n === null ? "Unlimited" : String(n);
}

/** Current plan, live usage vs limits, and self-serve upgrade. Used in the
    project's Billing tab (and reusable elsewhere). */
export function PlanCard({
  workspaceId,
  ws,
  isOwner,
}: {
  workspaceId: string;
  ws: WorkspaceDetail;
  isOwner: boolean;
}) {
  const current = (ws.plan ?? "free") as Plan;
  const limits = ws.limits ?? PLAN_LIMITS[current];
  const usage = ws.usage ?? { repos: 0, seats: 0 };
  // Self-serve Stripe checkout when configured; otherwise a request-upgrade loop
  // the admin sees and can comp — so plans are usable today without Stripe.
  const billingEnabled = ws.billingEnabled ?? false;
  const [msg, setMsg] = useState<string | null>(null);
  const [requested, setRequested] = useState<Plan | null>(null);

  const checkout = useMutation<{ url?: string }, Error, Plan>({
    mutationFn: (plan) =>
      billingEnabled
        ? startCheckout(workspaceId, plan)
        : requestUpgrade(workspaceId, plan).then(() => ({})),
    onSuccess: (r, plan) => {
      if (billingEnabled && r.url) {
        window.location.href = r.url;
      } else {
        setRequested(plan);
        setMsg(null);
      }
    },
    onError: (e) => setMsg(e instanceof Error ? e.message : "Upgrade failed"),
  });

  const retrievals = ws.retrievals ?? { used: 0, limit: limits.retrievalsPerMonth, hardCap: limits.hardCap };
  const meters: { label: string; used: number; max: number | null }[] = [
    { label: "Retrievals this month", used: retrievals.used, max: retrievals.limit },
    { label: "Repos", used: usage.repos, max: limits.maxRepos },
  ];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Plan &amp; usage</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            You&apos;re on the{" "}
            <span className="font-medium" style={{ color: PLAN_ACCENT[current] }}>
              {PLAN_LABELS[current]}
            </span>{" "}
            plan
            {ws.planSource === "comp" ? " (comped)" : ""}
            {ws.planStatus && ws.planStatus !== "active" ? ` · ${ws.planStatus}` : ""}.
          </p>
        </div>
        <span
          className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs"
          style={{ color: PLAN_ACCENT[current], borderColor: `${PLAN_ACCENT[current]}55` }}
        >
          {PLAN_LABELS[current]}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {meters.map((m) => {
          const pct = m.max === null ? 0 : Math.min(100, Math.round((m.used / m.max) * 100));
          const near = m.max !== null && m.used >= m.max;
          return (
            <div key={m.label} className="rounded-lg border border-[var(--border)] p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">{m.label}</span>
                <span className={near ? "text-[var(--signal)]" : ""}>
                  {m.used} / {limitText(m.max)}
                </span>
              </div>
              {m.max !== null ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: near ? "var(--signal)" : "var(--accent)" }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-[var(--faint)]">
        AI features (scan, chat, docs, reviewer) run on your own Anthropic key (BYOK), so they aren&apos;t
        metered by plan — the plan governs repos, members, and reviewer access.
      </p>

      {isOwner ? (
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <p className="mb-3 text-sm font-medium">Change plan</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => {
              const isCurrent = p === current;
              const l = PLAN_LIMITS[p];
              return (
                <div
                  key={p}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: isCurrent ? PLAN_ACCENT[p] : "var(--border)",
                    background: isCurrent
                      ? "color-mix(in oklab, var(--surface-2), transparent 40%)"
                      : undefined,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium" style={{ color: PLAN_ACCENT[p] }}>
                      {PLAN_LABELS[p]}
                    </span>
                    {isCurrent ? (
                      <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                        Current
                      </span>
                    ) : null}
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                    <li>
                      {l.retrievalsPerMonth === null
                        ? "Unlimited retrievals"
                        : `${l.retrievalsPerMonth.toLocaleString()} retrievals/mo`}
                    </li>
                    <li>{limitText(l.maxRepos)} repos · unlimited seats</li>
                    <li>{l.reviewer ? "PR reviewer" : "No PR reviewer"}</li>
                    {l.byodb ? <li>Data residency (BYODB)</li> : l.audit ? <li>Audit log</li> : null}
                  </ul>
                  {isCurrent ? (
                    <div className="mt-3 text-xs text-[var(--faint)]">Your plan</div>
                  ) : p === "enterprise" ? (
                    <a
                      href="mailto:sales@cortex.dev?subject=Cortex%20Enterprise"
                      className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs transition hover:bg-white/5"
                    >
                      Contact us
                    </a>
                  ) : (
                    <Button
                      size="sm"
                      className="mt-3 w-full"
                      variant={p === "free" ? "ghost" : "primary"}
                      onClick={() => checkout.mutate(p)}
                      disabled={requested === p}
                      loading={checkout.isPending && checkout.variables === p}
                    >
                      {requested === p
                        ? "Requested ✓"
                        : p === "free"
                          ? "Downgrade"
                          : billingEnabled
                            ? "Upgrade"
                            : "Request upgrade"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          {requested ? (
            <p className="mt-3 text-xs text-[var(--verify)]">
              Upgrade to {PLAN_LABELS[requested]} requested — an admin will follow up. (Set{" "}
              <code>STRIPE_SECRET_KEY</code> to enable instant self-serve checkout.)
            </p>
          ) : null}
          {msg ? <p className="mt-3 text-xs text-[var(--signal)]">{msg}</p> : null}
          {!billingEnabled && !requested ? (
            <p className="mt-3 text-xs text-[var(--faint)]">
              Self-serve billing isn&apos;t on yet — requesting an upgrade notifies an admin, who can
              grant it.
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
