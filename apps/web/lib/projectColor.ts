/** Deterministic, stable color for a project (workspace) derived from its id. */
export function projectColor(id: string | undefined | null): { color: string; soft: string } {
  if (!id) return { color: "var(--accent)", soft: "var(--accent-soft)" };
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return {
    color: `hsl(${h} 70% 62%)`,
    soft: `hsl(${h} 70% 62% / 0.16)`,
  };
}
