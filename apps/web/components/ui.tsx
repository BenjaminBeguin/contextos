import type {
  ChangeEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import Link from "next/link";

/** Tiny class joiner. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,0.3)]",
        hover && "transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]",
        className,
      )}
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
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs", color)}>
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
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs", color)}>
      {status}
    </span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  type = "button",
  disabled,
  loading,
  className = "",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "subtle";
  size?: "sm" | "md";
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  title?: string;
}) {
  const variants: Record<string, string> = {
    primary: "brand-gradient font-semibold text-white shadow-sm hover:brightness-110",
    ghost: "border border-[var(--border)] text-[var(--text)] hover:bg-white/5 hover:border-[var(--border-strong)]",
    subtle: "bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--surface-3)]",
    danger: "border border-red-500/40 text-red-300 hover:bg-red-500/10",
  };
  const sizes: Record<string, string> = {
    sm: "px-2.5 py-1 text-xs gap-1.5",
    md: "px-3.5 py-2 text-sm gap-2",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--faint)] transition focus:border-[var(--accent)] focus:bg-[var(--surface-3)]";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={cn(inputClass, className)} {...rest} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea className={cn(inputClass, "resize-y", className)} {...rest} />;
}

export function Select({
  value,
  onChange,
  children,
  className = "",
  ...rest
}: {
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  className?: string;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange" | "className">) {
  return (
    <div className={cn("relative inline-flex", className)}>
      <select
        value={value}
        onChange={onChange}
        className={cn(inputClass, "cursor-pointer appearance-none pr-8")}
        {...rest}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <label className={cn("mb-1.5 block text-xs font-medium text-[var(--muted)]", className)}>
      {children}
    </label>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-[var(--surface-2)]",
        "before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/5 before:to-transparent before:[animation:ctx-shimmer_1.4s_infinite]",
        className,
      )}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 px-6 py-14 text-center">
      {icon ? <div className="mb-3 text-[var(--faint)]">{icon}</div> : null}
      <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-[var(--muted)]">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export interface Crumb {
  label: string;
  href?: string;
  /** Optional color dot (used for the project segment). */
  color?: string;
}

/** Location path: `Projects / ● Project / repo`. The last item is the current page. */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-sm">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        const inner = (
          <span
            className={cn(
              "inline-flex items-center gap-1.5",
              last ? "font-medium text-white" : "text-[var(--muted)]",
            )}
          >
            {it.color ? (
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: it.color }}
                aria-hidden
              />
            ) : null}
            {it.label}
          </span>
        );
        return (
          <span key={i} className="inline-flex items-center gap-1.5">
            {i > 0 ? <span className="text-[var(--faint)]">/</span> : null}
            {it.href && !last ? (
              <Link href={it.href} className="transition hover:text-white">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  accent,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Optional project color — renders a colored dot before the title. */
  accent?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
          {accent ? (
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
              aria-hidden
            />
          ) : null}
          {title}
        </h1>
        {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-black/40 p-4 text-sm text-[var(--text)]">
      <code>{children}</code>
    </pre>
  );
}
