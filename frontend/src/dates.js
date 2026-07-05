// Shared date formatting so every view reads the same, human-friendly way.
// Input is an ISO date string ('YYYY-MM-DD'); output avoids locale surprises.
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function parts(iso) {
  if (!iso || typeof iso !== 'string') return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return { y, m, d }
}

// "Oct 1" — compact, for axis ticks and dense labels.
export function fmtShort(iso) {
  const p = parts(iso)
  return p ? `${MONTHS[p.m - 1]} ${p.d}` : iso || ''
}

// "Oct 1, 2025" — for prose and standalone labels.
export function fmtLong(iso) {
  const p = parts(iso)
  return p ? `${MONTHS[p.m - 1]} ${p.d}, ${p.y}` : iso || ''
}
