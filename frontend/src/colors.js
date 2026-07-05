// Stable, accessible categorical palette for reasons. Colours are assigned
// deterministically from the (data-derived) sorted reason list, so a new
// category simply takes the next colour — nothing is hardcoded per reason.
const PALETTE = [
  '#e15759', // red      (used first so Breakdown-like reasons read as "hot")
  '#4e79a7', // blue
  '#59a14f', // green
  '#f28e2b', // orange
  '#af7aa1', // purple
  '#76b7b2', // teal
  '#edc948', // yellow
  '#ff9da7', // pink
  '#9c755f', // brown
  '#bab0ac', // grey
  '#86bcb6', // light teal
  '#d37295', // rose
]

// Reasons we always want to render in the alert colour if present.
const PRIORITY = { Breakdown: '#e15759' }

export function buildColorMap(reasons = []) {
  const map = {}
  let i = 0
  for (const r of reasons) {
    if (PRIORITY[r]) {
      map[r] = PRIORITY[r]
    } else {
      // Skip the reserved priority colour for non-priority reasons.
      let c = PALETTE[i % PALETTE.length]
      if (c === '#e15759' && !PRIORITY[r]) {
        i += 1
        c = PALETTE[i % PALETTE.length]
      }
      map[r] = c
      i += 1
    }
  }
  return map
}
