# Memmo — Design Identity

> One identity, applied everywhere. The landing (`apps/landing`) and the product
> (`apps/web`) must always share the same palette, gradient, and type system.
> When you touch one, keep the other in sync.

## The idea

Memmo is **living memory for AI agents** — a mind that lights up as it recalls.
The visual language is **"synaptic warmth on deep ink"**: a warm, near-black plum
base (not the cold black-and-white every AI dashboard ships), a violet core, and a
signature **amber "synapse"** that stands for a memory firing — recall, energy, a
signal traveling. This warm amber is the thing that makes Memmo look like Memmo
and nothing else.

Principles:

- **Not black-and-white.** The base is warm plum-ink; color is used with intent.
- **Amber is the signature.** Reach for `--signal` (amber) for energy, highlights,
  "a memory was used / a signal fired." It is the one color a competitor won't have.
- **Violet is the core**, amber the accent, jade = verified/approved, rose = alert.
- **Depth over flatness.** Layered surfaces, soft glows, grain — never a flat gray box.
- **Calm, then a spark.** Mostly quiet ink and muted text; the spark is the amber.

## Color tokens

Defined as CSS variables in both `apps/web/app/globals.css` and
`apps/landing/app/globals.css`. Same names, same values.

```
--background:     #0a0711   /* deep warm plum-ink */
--surface:        #120e1c
--surface-2:      #1a1526
--surface-3:      #221c30
--border:         #2a2338
--border-strong:  #3a3350
--text:           #ece9f3
--muted:          #a49fb5
--faint:          #6f6982

--accent:         #8b5cff   /* violet — the core */
--accent-hover:   #a17dff
--accent-soft:    rgba(139, 92, 255, 0.14)

--signal:         #ffb454   /* amber — the SIGNATURE (a synapse firing) */
--signal-hover:   #ffc47a
--signal-soft:    rgba(255, 180, 84, 0.14)

--verify:         #34d399   /* jade — approved / verified / accepted */
--alert:          #fb7185   /* rose — blocker / dismissed / risk */
--accent-cyan:    #22d3ee   /* tertiary — data / graph only */

--ring:           rgba(139, 92, 255, 0.6)

/* The identity gradient: violet → magenta → amber (a warm neural sunrise).
   Replaces the old generic violet→cyan. Use for brand fills + CTAs. */
--brand-grad: linear-gradient(100deg, #7c3aed 0%, #b5179e 52%, #ff9e3f 100%)
```

`gradient-text` should sweep the same violet → magenta → amber family so headline
text reads as the identity, e.g.:
`linear-gradient(110deg, #ece9f3 8%, #a78bfa 34%, #e879f9 55%, #ffb454 78%, #ece9f3 96%)`.

## Typography

- **Display / headings:** `Space Grotesk` (via `next/font/google`), exposed as the
  CSS variable `--font-display`. Techy, characterful, distinctive — used on H1/H2,
  hero, section titles, nav wordmark.
- **Body / UI:** `Inter` (via `next/font/google`), variable `--font-sans`. Clean,
  legible, the default `body` font.
- **Mono:** existing `ui-monospace, SFMono-Regular, Menlo, monospace` for code,
  memory content, dedup keys, technical chips.

Wire fonts in each app's `app/layout.tsx` with `next/font/google` and attach the
variables to `<html>`. In CSS: `body { font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif }`
and a helper `.font-display { font-family: var(--font-display), ui-sans-serif, sans-serif }`
applied to headings.

## Signature primitives

- **Grain:** a subtle SVG/tiled noise overlay at ~3% opacity over the background so
  large dark areas feel like a surface, not a void. (`.grain` fixed overlay.)
- **Amber synapse glow:** `box-shadow`/radial-gradient in `--signal` for "active /
  a memory fired" states (e.g. a finding that moved a memory's confidence).
- **Aurora / spotlight (landing):** keep, but retune the radial stops to the new
  violet → magenta → amber family (drop the dominant cyan).
- Keep existing `.reveal`, `.float-slow`, `.conic-border`, `.shine` — just update the
  colors inside them to the identity family (conic border: violet → magenta → amber).

## Semantic usage

| Meaning                    | Token                       |
| -------------------------- | --------------------------- |
| Primary action / brand     | `--brand-grad`, `--accent`  |
| A memory / signal fired     | `--signal` (amber)          |
| Approved / verified / accepted | `--verify` (jade)        |
| Blocker / dismissed / risk | `--alert` (rose)            |
| Neutral data / graph edges | `--accent-cyan`             |

Review-finding severity colors (web `ui.tsx`): blocker → rose, warning → amber,
nit → violet, praise → jade.
