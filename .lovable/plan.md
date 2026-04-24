# God-Tier Magic Tiles 3 Clone — Engine & Aesthetic Overhaul

## Iterative Perfection Loop applied

**Draft → Audit → Refine → Format**, with a single non-negotiable constraint: **no placeholders**. Every function ships fully implemented.

---

## Where the current build will fail at scale (audit findings)

1. **DOM tiles thrash layout.** `setRenderTiles([...tiles])` on every frame triggers React reconciliation across N tiles. At 8+ simultaneous tiles + double/hold geometry, mid-range Android drops below 60fps.
2. **No canvas → no GPU compositing.** Bokeh blurs, beat-flash, and tile gradients all repaint on the main thread.
3. **Speed scaling is per-round, not per-star.** Spec calls for `v_final = BPM × m(stars)` where stars are crossed mid-song.
4. **No true long-press semantics.** Hold tiles auto-resolve on release with a fixed "GREAT" — no scoring window for early/late release.
5. **No neon Neo-SaaS skin.** Current theme is MT3-pastel (blue/green/yellow). Spec demands `#00f2ff` / `#ff007a` on dark.
6. **Chart format is BPM-procedural only.** Spec requires authored JSON beat maps (`{time, lane, type, duration}`).
7. **No revive countdown timer.** Fail screen revive is instant — spec calls for animated SVG fill + countdown.
8. **No spring physics on UI transitions.** Menu→game cuts hard.

---

## Phase 2 deliverables (this batch)

### 1. New canvas rendering engine — `src/lib/CanvasRenderer.ts`
A class that owns a single `<canvas>` element and renders the entire playfield in one paint per frame:
- `render(state: RenderState)` — paints background gradient, lane dividers, hit-line, all tiles, hold-bars, hit-flash particles, score popups
- Internal offscreen layer for static elements (lanes, hit-line) to avoid re-stroking
- Uses `ctx.roundRect`, `createLinearGradient`, neon glow via `shadowBlur` + `shadowColor`
- Resolution-aware: `devicePixelRatio` scaling, resize observer
- Tile draw: black body + subtle inner highlight + 2px neon border on the leading edge during the input window

### 2. New game component — `src/components/game/CanvasGame.tsx`
- Owns the canvas ref + RAF loop
- Receives `chart`, `audio`, `onHit`, `onMiss` props
- Pointer events on a transparent overlay div per lane (input stays in DOM for accessibility, render stays on canvas)
- Long-press detection: `pointerdown` → start timer → `pointerup` → score based on `release_delta_to_hold_end`
  - `RELEASE_PERFECT ≤ 80ms` / `RELEASE_GREAT ≤ 160ms` / else `EARLY_RELEASE` (combo break)

### 3. Dynamic star-based speed scaling — `src/lib/gameEngine.ts`
Replace `ROUND_SPEEDS` with a continuous function:
```
getSpeedMultiplier(stars: 0|1|2|3): number
  0 → 1.00,  1 → 1.15,  2 → 1.30,  3 → 1.50
```
Stars cross at progress thresholds `[0.33, 0.66, 1.0]`. When a star is earned mid-song, `fallDurationMs` shrinks smoothly over 2 beats (lerp), not as a hard cut — this prevents tile teleportation.

### 4. JSON beat-map format — `public/charts/{songId}.json`
```json
{
  "songId": "13",
  "bpm": 105,
  "audioUrl": "/audio/gud-yaregegn.mp3",
  "notes": [
    { "time": 1250, "lane": 2, "type": "single" },
    { "time": 1500, "lane": 0, "type": "long", "duration": 500 },
    { "time": 1750, "lane": 1, "type": "single" },
    { "time": 1750, "lane": 3, "type": "single" }
  ]
}
```
- Loader in `tileCharts.ts`: `loadChart(songId)` fetches JSON, falls back to procedural generator if missing
- Ship one hand-authored chart for `gud-yaregegn` as proof
- Procedural generator stays as fallback for the other 12 songs

### 5. Neon Neo-SaaS aesthetic — `src/index.css` + canvas
- Background: radial gradient `#0a0118` center → `#000000` edges, with subtle mesh-gradient blob layer
- Tiles: `#0a0a0a` body, neon edge: `#00f2ff` (cyan) for taps, `#ff007a` (magenta) for holds, `#ffd700` (gold) for "PERFECT" combo > 25
- HUD score: `JetBrains Mono` 700, tabular-nums, with `text-shadow: 0 0 12px #00f2ff` glow
- Menu text: `Inter` (already loaded via Tailwind default)
- Beat-flash → drives a 1-frame `box-shadow` pulse on the playfield border instead of full background flicker

### 6. Long-press input refinement — `src/components/game/CanvasGame.tsx`
- Replace `KEYBOARD_LANE_MAP` repeated-fire bug fix (already in place) with explicit `holdStartTime` per lane
- Score release: compare `performance.now() - holdStartTime` against `chartTime + holdDuration` rather than auto-completing on release

### 7. Fail screen with revive countdown — `src/components/game/GameOverlays.tsx`
- 5-second SVG circle fill animation (stroke-dasharray) on the Revive button
- If user taps before timer runs out → revive
- If timer expires → show final results

### 8. Spring physics — `framer-motion` (not yet installed)
- Add `framer-motion` and use `motion.div` with `transition={{ type: "spring", stiffness: 320, damping: 28 }}` for: menu→play, ready→playing, fail overlay entry, song-complete star-fill

---

## What I will NOT change in this batch
- The audio engine (`useGameAudio.ts`) — it's already AudioContext-precise and calibration-aware
- Hit-window constants (`HIT_WINDOWS`) — already MT3-tuned
- Scoring formula (`getScoreForHit`) — already cumulative `base + floor(combo/5)`
- Lovable Cloud schema — Phase 3 work (leaderboards, profiles)
- Procedural-from-audio onset detection — Phase 3 work; spec for *this* request is JSON-driven

---

## File-level change summary

| File | Action | Reason |
|---|---|---|
| `src/lib/CanvasRenderer.ts` | **CREATE** | Canvas-based GPU-friendly renderer |
| `src/components/game/CanvasGame.tsx` | **CREATE** | Replaces `GameLanes` + `HitEffects` rendering |
| `src/lib/tileCharts.ts` | EDIT | Add `loadChart(songId)` async loader, JSON fallback |
| `public/charts/13.json` | **CREATE** | Hand-authored chart for "Gud Yaregegn" |
| `src/lib/gameEngine.ts` | EDIT | Add `getSpeedMultiplier(stars)` + smooth lerp helper |
| `src/pages/Play.tsx` | EDIT | Swap `<GameLanes>` + `<HitEffects>` for `<CanvasGame>`; add star-based speed; smooth speed lerp |
| `src/components/game/GameOverlays.tsx` | EDIT | Revive countdown SVG; framer-motion entries |
| `src/components/game/GameHUD.tsx` | EDIT | JetBrains Mono score; neon glow; tabular-nums |
| `src/index.css` | EDIT | Neon palette tokens; JetBrains Mono import |
| `tailwind.config.ts` | EDIT | `font-mono: JetBrains Mono`; neon color tokens |
| `package.json` | EDIT | Add `framer-motion` |

`GameLanes.tsx` and `HitEffects.tsx` stay on disk (unused) so the swap is reversible.

---

## Acceptance criteria (how I'll know it's done)

1. Chrome DevTools Performance tab shows **≥ 58fps p95** during a 30-tile-density section on a 4× CPU throttle
2. Tapping a tile registers within **one frame** of pointerdown (verified by `performance.now()` log)
3. Hold tile early-release breaks combo; on-time release scores PERFECT
4. Crossing the 33% / 66% / 100% star thresholds visibly accelerates tiles **without teleporting**
5. The neon palette is on screen — no more pastel blue/green/yellow cycling
6. Score font is monospaced and never "jumps" width
7. Fail screen shows a 5-second countdown ring on the Revive button
8. `public/charts/13.json` loads and plays "Gud Yaregegn" with the authored beat map

---

## Continue command

This is one batch. After approval I will write all files end-to-end with no placeholders. If output exceeds one message I will pause and wait for **"Continue"** rather than summarize.
