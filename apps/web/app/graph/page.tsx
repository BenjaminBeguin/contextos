"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, type Me, type GraphData, type GraphNode } from "../../lib/api";
import { AppShell } from "../../components/AppShell";

export default function GraphPage() {
  return (
    <AppShell>
      <Graph />
    </AppShell>
  );
}

const TYPE_COLORS: Record<string, string> = {
  workspace: "#ffffff",
  repo: "#22d3ee",
  session: "#f59e0b",
};
const MEM_COLORS: Record<string, string> = {
  project_rule: "#a78bfa",
  architecture: "#818cf8",
  command: "#38bdf8",
  workflow: "#34d399",
  decision: "#c084fc",
  failure: "#fb923c",
  risk: "#f87171",
  dependency: "#facc15",
  testing: "#4ade80",
  deployment: "#fbbf24",
  business_context: "#f472b6",
};

function nodeColor(n: GraphNode): string {
  if (n.type === "memory") return MEM_COLORS[n.group ?? ""] ?? "#6b7280";
  return TYPE_COLORS[n.type] ?? "#9ca3af";
}
function nodeRadius(n: GraphNode): number {
  return n.type === "workspace" ? 14 : n.type === "repo" ? 9 : n.type === "session" ? 5 : 4;
}

interface Sim {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  node: GraphNode;
}

function Graph() {
  const router = useRouter();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  const [ws, setWs] = useState<string>("");
  const activeWs = ws || me?.workspaces[0]?.id || "";

  const { data: graph } = useQuery({
    queryKey: ["graph", activeWs],
    queryFn: () => api<GraphData>(`/workspaces/${activeWs}/graph`),
    enabled: !!activeWs,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    nodes: [] as Sim[],
    adj: [] as { a: number; b: number }[],
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    hover: -1,
    drag: -1,
    panning: false,
    last: { x: 0, y: 0 },
    downAt: { x: 0, y: 0 },
  });

  // (Re)build simulation when graph data changes.
  useEffect(() => {
    if (!graph) return;
    const idx = new Map(graph.nodes.map((n, i) => [n.id, i]));
    stateRef.current.nodes = graph.nodes.map((n) => ({
      id: n.id,
      x: (Math.random() - 0.5) * 400,
      y: (Math.random() - 0.5) * 400,
      vx: 0,
      vy: 0,
      node: n,
    }));
    stateRef.current.adj = graph.edges
      .map((e) => ({ a: idx.get(e.source)!, b: idx.get(e.target)! }))
      .filter((e) => e.a != null && e.b != null);
    stateRef.current.scale = 1;
    stateRef.current.offsetX = 0;
    stateRef.current.offsetY = 0;
  }, [graph]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const canvas: HTMLCanvasElement = el;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function screenOf(s: Sim, w: number, h: number) {
      const st = stateRef.current;
      return { x: w / 2 + st.offsetX + s.x * st.scale, y: h / 2 + st.offsetY + s.y * st.scale };
    }

    function step() {
      const st = stateRef.current;
      const nodes = st.nodes;
      const n = nodes.length;
      // repulsion
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = nodes[i]!,
            b = nodes[j]!;
          let dx = a.x - b.x,
            dy = a.y - b.y;
          let d2 = dx * dx + dy * dy || 0.01;
          const f = 1400 / d2;
          const d = Math.sqrt(d2);
          const fx = (dx / d) * f,
            fy = (dy / d) * f;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }
      // springs
      for (const e of st.adj) {
        const a = nodes[e.a]!,
          b = nodes[e.b]!;
        let dx = b.x - a.x,
          dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = (d - 70) * 0.02;
        const fx = (dx / d) * f,
          fy = (dy / d) * f;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
      // gravity + integrate
      for (let i = 0; i < n; i++) {
        const s = nodes[i]!;
        if (i === st.drag) continue;
        s.vx += -s.x * 0.005;
        s.vy += -s.y * 0.005;
        s.vx *= 0.85;
        s.vy *= 0.85;
        s.x += s.vx;
        s.y += s.vy;
      }
    }

    function draw() {
      const st = stateRef.current;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width,
        h = rect.height;
      ctx.clearRect(0, 0, w, h);
      // edges
      ctx.lineWidth = 1;
      for (const e of st.adj) {
        const a = screenOf(st.nodes[e.a]!, w, h);
        const b = screenOf(st.nodes[e.b]!, w, h);
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      // nodes
      st.nodes.forEach((s, i) => {
        const p = screenOf(s, w, h);
        const r = nodeRadius(s.node) * Math.max(0.7, st.scale);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor(s.node);
        ctx.shadowColor = nodeColor(s.node);
        ctx.shadowBlur = i === st.hover ? 16 : 6;
        ctx.fill();
        ctx.shadowBlur = 0;
        const showLabel = s.node.type === "workspace" || s.node.type === "repo" || i === st.hover;
        if (showLabel) {
          ctx.fillStyle = "rgba(231,231,238,0.9)";
          ctx.font = "11px ui-sans-serif, system-ui";
          ctx.fillText(s.node.label.slice(0, 40), p.x + r + 4, p.y + 4);
        }
      });
    }

    function frame() {
      step();
      draw();
      raf = requestAnimationFrame(frame);
    }
    frame();

    function hitTest(mx: number, my: number): number {
      const st = stateRef.current;
      const rect = canvas.getBoundingClientRect();
      for (let i = st.nodes.length - 1; i >= 0; i--) {
        const p = screenOf(st.nodes[i]!, rect.width, rect.height);
        const r = nodeRadius(st.nodes[i]!.node) * Math.max(0.7, st.scale) + 4;
        if ((mx - p.x) ** 2 + (my - p.y) ** 2 <= r * r) return i;
      }
      return -1;
    }

    function onMove(ev: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left,
        my = ev.clientY - rect.top;
      const st = stateRef.current;
      if (st.drag >= 0) {
        const node = st.nodes[st.drag]!;
        node.x = (mx - rect.width / 2 - st.offsetX) / st.scale;
        node.y = (my - rect.height / 2 - st.offsetY) / st.scale;
        node.vx = node.vy = 0;
      } else if (st.panning) {
        st.offsetX += mx - st.last.x;
        st.offsetY += my - st.last.y;
        st.last = { x: mx, y: my };
      } else {
        st.hover = hitTest(mx, my);
        canvas.style.cursor = st.hover >= 0 ? "pointer" : "grab";
      }
    }
    function onDown(ev: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left,
        my = ev.clientY - rect.top;
      const st = stateRef.current;
      st.downAt = { x: mx, y: my };
      const hit = hitTest(mx, my);
      if (hit >= 0) st.drag = hit;
      else {
        st.panning = true;
        st.last = { x: mx, y: my };
      }
    }
    function onUp(ev: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left,
        my = ev.clientY - rect.top;
      const st = stateRef.current;
      const moved = Math.hypot(mx - st.downAt.x, my - st.downAt.y);
      if (moved < 4) {
        const hit = hitTest(mx, my);
        const href = hit >= 0 ? st.nodes[hit]!.node.href : undefined;
        if (href) router.push(href);
      }
      st.drag = -1;
      st.panning = false;
    }
    function onWheel(ev: WheelEvent) {
      ev.preventDefault();
      const st = stateRef.current;
      const factor = ev.deltaY < 0 ? 1.1 : 0.9;
      st.scale = Math.min(3, Math.max(0.3, st.scale * factor));
    }

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [router]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Knowledge graph</h1>
          <p className="text-sm text-[var(--muted)]">
            Repos, memories, and sessions. Drag to move · scroll to zoom · click a node to open it.
          </p>
        </div>
        <select
          value={activeWs}
          onChange={(e) => setWs(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-sm"
        >
          {me?.workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
        <Legend color="#22d3ee" label="repo" />
        <Legend color="#f59e0b" label="session" />
        <Legend color="#a78bfa" label="memory" />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-black/30">
        <canvas ref={canvasRef} className="h-[70vh] w-full" />
      </div>

      {graph && graph.nodes.length <= 1 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Add a repo and approve some memories to populate the graph.{" "}
          <Link href="/dashboard" className="text-[var(--accent)]">
            Go to dashboard →
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
