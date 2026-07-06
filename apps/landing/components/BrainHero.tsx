"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const CYAN = "#22d3ee";
const BLUE = "#38bdf8";
const VIOLET = "#a78bfa";
const SIGNAL = "#ffb454"; // amber — a memory firing (the signature)

function circleGeometry(radius: number, segments = 160): THREE.BufferGeometry {
  const pts = new Float32Array(segments * 3);
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts[i * 3] = Math.cos(a) * radius;
    pts[i * 3 + 1] = Math.sin(a) * radius;
    pts[i * 3 + 2] = 0;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
  return g;
}

/** Evenly distributed points on a sphere (Fibonacci lattice). */
function fibonacciSphere(n: number, radius: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    pts.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).multiplyScalar(radius));
  }
  return pts;
}

/**
 * The memory itself: a neural constellation. Nodes on a sphere shell, connected to
 * nearby neighbors so it reads as a living network / brain. Nodes gently pulse.
 */
function Constellation({ count = 88, radius = 1.55 }: { count?: number; radius?: number }) {
  const nodes = useMemo(() => fibonacciSphere(count, radius), [count, radius]);

  const pointsGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(count * 3);
    nodes.forEach((p, i) => {
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    });
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, [nodes, count]);

  const linesGeom = useMemo(() => {
    const segs: number[] = [];
    const threshold = radius * 0.55;
    for (let i = 0; i < nodes.length; i++) {
      let made = 0;
      for (let j = i + 1; j < nodes.length && made < 3; j++) {
        if (nodes[i]!.distanceTo(nodes[j]!) < threshold) {
          segs.push(nodes[i]!.x, nodes[i]!.y, nodes[i]!.z, nodes[j]!.x, nodes[j]!.y, nodes[j]!.z);
          made++;
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segs), 3));
    return g;
  }, [nodes, radius]);

  const pts = useRef<THREE.Points>(null);
  useFrame((state) => {
    if (pts.current) {
      const mat = pts.current.material as THREE.PointsMaterial;
      mat.size = 0.05 + Math.sin(state.clock.elapsedTime * 1.6) * 0.012;
    }
  });

  return (
    <group>
      <lineSegments geometry={linesGeom}>
        <lineBasicMaterial color={BLUE} transparent opacity={0.14} blending={THREE.AdditiveBlending} />
      </lineSegments>
      <points ref={pts} geometry={pointsGeom}>
        <pointsMaterial
          size={0.05}
          color="#cffaff"
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/** Data signals streaming inward to the core (retrieval) and back out (injection). */
function Signals({ count = 28 }: { count?: number }) {
  const inward = useRef<THREE.Points>(null);
  const outward = useRef<THREE.Points>(null);

  const beams = useMemo(
    () =>
      Array.from({ length: count }, () => {
        const v = new THREE.Vector3(
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
        );
        if (v.lengthSq() < 1e-3) v.set(1, 0, 0);
        v.normalize();
        return { dir: v, speed: 0.45 + Math.random() * 0.5, phase: Math.random() };
      }),
    [count],
  );

  const inGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return g;
  }, [count]);
  const outGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return g;
  }, [count]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const inArr = inGeom.getAttribute("position").array as Float32Array;
    const outArr = outGeom.getAttribute("position").array as Float32Array;
    const OUTER = 2.3;
    for (let i = 0; i < count; i++) {
      const b = beams[i]!;
      // inward: 1 → 0 over the loop
      const pin = (b.phase + t * b.speed * 0.25) % 1;
      const rin = (1 - pin) * OUTER + 0.12;
      inArr[i * 3] = b.dir.x * rin;
      inArr[i * 3 + 1] = b.dir.y * rin;
      inArr[i * 3 + 2] = b.dir.z * rin;
      // outward: 0 → 1, opposite direction, offset phase
      const pout = (b.phase + 0.5 + t * b.speed * 0.22) % 1;
      const rout = pout * OUTER + 0.12;
      outArr[i * 3] = -b.dir.x * rout;
      outArr[i * 3 + 1] = -b.dir.y * rout;
      outArr[i * 3 + 2] = -b.dir.z * rout;
    }
    inGeom.getAttribute("position").needsUpdate = true;
    outGeom.getAttribute("position").needsUpdate = true;
  });

  return (
    <group>
      <points ref={inward} geometry={inGeom}>
        <pointsMaterial
          size={0.1}
          color={SIGNAL}
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points ref={outward} geometry={outGeom}>
        <pointsMaterial
          size={0.08}
          color={VIOLET}
          transparent
          opacity={0.8}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

function Ring({
  radius,
  tilt,
  speed,
  color,
  opacity = 0.5,
}: {
  radius: number;
  tilt: [number, number, number];
  speed: number;
  color: string;
  opacity?: number;
}) {
  const ref = useRef<THREE.LineLoop>(null);
  const geom = useMemo(() => circleGeometry(radius), [radius]);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.z += d * speed;
  });
  return (
    <group rotation={tilt}>
      <lineLoop ref={ref} geometry={geom}>
        <lineBasicMaterial color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} />
      </lineLoop>
    </group>
  );
}

/** Soft radial-gradient glow texture so the core reads as a light source, not a hard disc. */
function makeGlowTexture(): THREE.Texture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.16, "rgba(200,250,255,0.85)");
  g.addColorStop(0.4, "rgba(56,189,248,0.32)");
  g.addColorStop(0.75, "rgba(109,94,252,0.12)");
  g.addColorStop(1, "rgba(34,211,238,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/** A single luminous, breathing energy core (soft glow + a small bright center). */
function Core() {
  const tex = useMemo(makeGlowTexture, []);
  const glow = useRef<THREE.Sprite>(null);
  const inner = useRef<THREE.Sprite>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (glow.current) glow.current.scale.setScalar(2.4 + Math.sin(t * 1.8) * 0.18);
    if (inner.current) inner.current.scale.setScalar(0.7 + Math.sin(t * 2.6) * 0.06);
  });
  return (
    <group>
      <sprite ref={glow} scale={2.4}>
        <spriteMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.85} />
      </sprite>
      <sprite ref={inner} scale={0.7}>
        <spriteMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <mesh>
        <sphereGeometry args={[0.075, 24, 24]} />
        <meshBasicMaterial color="#f4ffff" />
      </mesh>
    </group>
  );
}

function Scene() {
  const group = useRef<THREE.Group>(null);
  const { pointer } = useThree();
  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += delta * 0.07;
    // Parallax: ease the tilt toward the cursor for an interactive, alive feel.
    const targetX = -pointer.y * 0.35 + Math.sin(state.clock.elapsedTime * 0.12) * 0.05;
    const targetZ = pointer.x * 0.18;
    g.rotation.x += (targetX - g.rotation.x) * 0.05;
    g.rotation.z += (targetZ - g.rotation.z) * 0.05;
  });
  return (
    <group ref={group} scale={0.92}>
      <Core />
      <Constellation />
      <Signals />
      <Ring radius={1.78} tilt={[Math.PI / 2, 0, 0]} speed={0.5} color={CYAN} />
      <Ring radius={1.94} tilt={[Math.PI / 2.6, 0.4, 0]} speed={-0.32} color={BLUE} />
      <Ring radius={2.1} tilt={[Math.PI / 3, -0.5, 0.3]} speed={0.22} color={VIOLET} opacity={0.35} />
    </group>
  );
}

export function BrainHero() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="relative mx-auto h-[480px] w-full max-w-5xl sm:h-[620px]">
      <div className="pointer-events-none absolute inset-0 -z-10 mx-auto h-2/5 w-2/5 self-center rounded-full bg-[radial-gradient(circle,rgba(255,180,84,0.15),transparent_70%)] blur-3xl" />
      {mounted ? (
        <Canvas dpr={[1, 2]} camera={{ position: [0, 0.3, 6.4], fov: 45 }} gl={{ antialias: true, alpha: true }}>
          <Scene />
        </Canvas>
      ) : null}
      <div className="pointer-events-none absolute bottom-2 left-0 right-0 text-center font-mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--signal)]/70">
        memory core · online
      </div>
    </div>
  );
}
