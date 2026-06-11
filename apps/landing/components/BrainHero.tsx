"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const CYAN = "#22d3ee";
const BLUE = "#38bdf8";
const VIOLET = "#a78bfa";

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

function latitudeGeometry(lat: number, segments = 160): THREE.BufferGeometry {
  const r = Math.cos(lat);
  const y = Math.sin(lat);
  const pts = new Float32Array(segments * 3);
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts[i * 3] = Math.cos(a) * r;
    pts[i * 3 + 1] = y;
    pts[i * 3 + 2] = Math.sin(a) * r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
  return g;
}

/** Clean lat/long holographic globe. */
function Globe() {
  const meridian = useMemo(() => circleGeometry(1), []);
  const latitudes = useMemo(
    () => [-0.9, -0.55, -0.2, 0.2, 0.55, 0.9].map((l) => latitudeGeometry(l)),
    [],
  );
  const meridians = useMemo(() => [0, 1, 2, 3, 4, 5].map((i) => (i * Math.PI) / 6), []);

  return (
    <group>
      {latitudes.map((g, i) => (
        <lineLoop key={`lat-${i}`} geometry={g}>
          <lineBasicMaterial color={CYAN} transparent opacity={0.22} />
        </lineLoop>
      ))}
      {meridians.map((phi, i) => (
        <lineLoop key={`mer-${i}`} geometry={meridian} rotation={[0, phi, 0]}>
          <lineBasicMaterial color={CYAN} transparent opacity={0.18} />
        </lineLoop>
      ))}
    </group>
  );
}

/** A single gyroscopic HUD ring on a fixed tilt, spinning in its own plane. */
function Ring({
  radius,
  tilt,
  speed,
  color,
  opacity = 0.55,
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
        <lineBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          blending={THREE.AdditiveBlending}
        />
      </lineLoop>
    </group>
  );
}

/** Tick marks around the outer boundary, for HUD detail. */
function TickRing({ radius = 1.7, count = 64 }: { radius?: number; count?: number }) {
  const geom = useMemo(() => {
    const pts = new Float32Array(count * 2 * 3);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const inner = radius;
      const outer = radius + (i % 4 === 0 ? 0.08 : 0.04);
      pts[i * 6] = Math.cos(a) * inner;
      pts[i * 6 + 1] = Math.sin(a) * inner;
      pts[i * 6 + 2] = 0;
      pts[i * 6 + 3] = Math.cos(a) * outer;
      pts[i * 6 + 4] = Math.sin(a) * outer;
      pts[i * 6 + 5] = 0;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    return g;
  }, [radius, count]);
  const ref = useRef<THREE.LineSegments>(null);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.z -= d * 0.06;
  });
  return (
    <lineSegments ref={ref} geometry={geom} rotation={[Math.PI / 2.4, 0, 0]}>
      <lineBasicMaterial color={BLUE} transparent opacity={0.3} />
    </lineSegments>
  );
}

/** Glowing arc-reactor core with a soft halo. */
function Core() {
  const halo = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (halo.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.06;
      halo.current.scale.setScalar(s);
    }
  });
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshBasicMaterial color="#bff7ff" />
      </mesh>
      <mesh ref={halo}>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshBasicMaterial
          color={CYAN}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/** Precise data nodes orbiting on inclined circular paths. */
function Nodes({ count = 7 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const orbits = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        radius: 1.15 + Math.random() * 0.5,
        incl: Math.random() * Math.PI,
        tilt: Math.random() * Math.PI * 2,
        speed: (0.3 + Math.random() * 0.6) * (Math.random() > 0.5 ? 1 : -1),
        phase: Math.random() * Math.PI * 2,
      })),
    [count],
  );
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return g;
  }, [count]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const arr = geom.getAttribute("position").array as Float32Array;
    for (let i = 0; i < count; i++) {
      const o = orbits[i]!;
      const a = t * o.speed + o.phase;
      // circle in its own plane, then incline
      const x = Math.cos(a) * o.radius;
      const z = Math.sin(a) * o.radius;
      const y = z * Math.sin(o.incl);
      const zz = z * Math.cos(o.incl);
      const ct = Math.cos(o.tilt);
      const st = Math.sin(o.tilt);
      arr[i * 3] = x * ct - zz * st;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = x * st + zz * ct;
    }
    geom.getAttribute("position").needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial
        size={0.08}
        color="#eafdff"
        transparent
        opacity={0.95}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function Scene() {
  const group = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.08;
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.12) * 0.08;
  });
  return (
    <group ref={group} scale={1.2}>
      <Core />
      <Globe />
      <Ring radius={1.32} tilt={[Math.PI / 2, 0, 0]} speed={0.5} color={CYAN} />
      <Ring radius={1.46} tilt={[Math.PI / 2.6, 0.4, 0]} speed={-0.35} color={BLUE} />
      <Ring radius={1.6} tilt={[Math.PI / 3, -0.5, 0.3]} speed={0.25} color={VIOLET} opacity={0.4} />
      <TickRing />
      <Nodes />
    </group>
  );
}

export function BrainHero() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="relative mx-auto h-[360px] w-full max-w-3xl sm:h-[440px]">
      <div className="pointer-events-none absolute inset-0 -z-10 mx-auto h-2/3 w-2/3 self-center rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.16),transparent_70%)] blur-2xl" />
      {mounted ? (
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0.3, 4], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
        >
          <Scene />
        </Canvas>
      ) : null}
      <div className="pointer-events-none absolute bottom-2 left-0 right-0 text-center font-mono text-[11px] uppercase tracking-[0.3em] text-cyan-300/70">
        context core · online
      </div>
    </div>
  );
}
