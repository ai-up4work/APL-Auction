// lib/team-colors.ts
// Shared team-color helpers: validate a hex color, and guarantee two
// teams' colors stay visually distinguishable wherever they're shown
// side-by-side (win-probability bar, graphs, worm/run-rate charts, etc).

export function safeColor(value: string | undefined, fallback: string): string {
  if (value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())) return value.trim()
  return fallback
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "")
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean
  const num = parseInt(full, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("")}`
}

// "Redmean" perceptual distance — cheap, no color-space lib needed, but
// tracks how visually different two colors look better than plain
// Euclidean RGB distance. Ranges roughly 0 (identical) to ~765 (black/white).
function colorDistance(hexA: string, hexB: string): number {
  const [r1, g1, b1] = hexToRgb(hexA)
  const [r2, g2, b2] = hexToRgb(hexB)
  const rMean = (r1 + r2) / 2
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db)
}

function hexToHsl(hex: string): [number, number, number] {
  const [r0, g0, b0] = hexToRgb(hex).map((v) => v / 255)
  const max = Math.max(r0, g0, b0)
  const min = Math.min(r0, g0, b0)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r0: h = (g0 - b0) / d + (g0 < b0 ? 6 : 0); break
      case g0: h = (b0 - r0) / d + 2; break
      default: h = (r0 - g0) / d + 4; break
    }
    h /= 6
  }
  return [h * 360, s, l]
}

function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = l - c / 2
  let [r, g, b] = [0, 0, 0]
  if (hh < 60) [r, g, b] = [c, x, 0]
  else if (hh < 120) [r, g, b] = [x, c, 0]
  else if (hh < 180) [r, g, b] = [0, c, x]
  else if (hh < 240) [r, g, b] = [0, x, c]
  else if (hh < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return rgbToHex([(r + m) * 255, (g + m) * 255, (b + m) * 255])
}

// Below this redmean distance, two swatches read as "the same" at a
// glance in a thin bar/line chart — chosen empirically, not a standard.
const DISTINCT_COLOR_THRESHOLD = 90

/**
 * If team A and team B's colors are too close to be visually
 * distinguishable, rotate team B's color around the hue wheel until it
 * clears a minimum perceptual distance from team A, rather than silently
 * rendering two same-looking colors. Team A is never touched — only B
 * shifts, since A is treated as primary everywhere this is used.
 */
export function ensureDistinctColors(colorA: string, colorB: string): [string, string] {
  if (colorDistance(colorA, colorB) >= DISTINCT_COLOR_THRESHOLD) return [colorA, colorB]

  const [h, , l] = hexToHsl(colorB)
  const clampedS = 0.65
  const clampedL = Math.min(Math.max(l, 0.35), 0.65)
  // 180° (complementary) first — the most reliable escape from a
  // same-ish-color collision — then a few fallback rotations.
  const attempts = [180, 120, -120, 90, -90, 60, -60]
  for (const shift of attempts) {
    const candidate = hslToHex(h + shift, clampedS, clampedL)
    if (colorDistance(colorA, candidate) >= DISTINCT_COLOR_THRESHOLD) {
      return [colorA, candidate]
    }
  }
  return [colorA, "#3B82F6"] // last-resort fixed blue, reliably far from red/gold
}