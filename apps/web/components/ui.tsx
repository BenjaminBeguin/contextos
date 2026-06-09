import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] ${className}`}
    >
      {children}
    </div>
  );
}

const TYPE_COLORS: Record<string, string> = {
  risk: "bg-red-500/15 text-red-300 border-red-500/30",
  failure: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  testing: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  command: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  deployment: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

export function Badge({ label }: { label: string }) {
  const color = TYPE_COLORS[label] ?? "bg-white/8 text-[var(--muted)] border-white/10";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${color}`}>
      {label}
    </span>
  );
}

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  proposed: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
  archived: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  stale: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
};

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "bg-white/8 text-[var(--muted)] border-white/10";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${color}`}>
      {status}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const styles =
    variant === "primary"
      ? "bg-[var(--accent)] text-white hover:opacity-90"
      : variant === "danger"
        ? "border border-red-500/40 text-red-300 hover:bg-red-500/10"
        : "border border-[var(--border)] text-[var(--text)] hover:bg-white/5";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-black/40 p-4 text-sm text-[var(--text)]">
      <code>{children}</code>
    </pre>
  );
}
