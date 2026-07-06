// Thin API client for the shift-analytics backend.
// Base URL is configurable (VITE_API_BASE); defaults to the dev proxy '/api'.
const BASE = import.meta.env.VITE_API_BASE || '/api'

function qs(params = {}) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  )
  const s = new URLSearchParams(clean).toString()
  return s ? `?${s}` : ''
}

async function get(path, params) {
  const res = await fetch(`${BASE}${path}${qs(params)}`)
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  return res.json()
}

export const api = {
  dataset: (f) => get('/dataset', f),
  qualityReport: () => get('/quality-report'),
  reasons: () => get('/reasons'),
  grouping: () => get('/grouping'),
  setGrouping: async (groups) => {
    const res = await fetch(`${BASE}/grouping`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groups }),
    })
    if (!res.ok) throw new Error(`Save grouping failed: ${res.status}`)
    return res.json()
  },
  suggestGrouping: async () => {
    const res = await fetch(`${BASE}/grouping/suggest`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.detail || `Suggest failed: ${res.status}`)
    return data
  },
  efficiency: (f) => get('/analysis/efficiency', f),
  streaks: (f) => get('/analysis/streaks', f),
  shiftChart: (f) => get('/analysis/shift-chart', f),
  insights: (f) => get('/analysis/insights', f),
  aiSummary: (f) => get('/analysis/ai-summary', f),
  reliability: (f) => get('/analysis/reliability', f),
  exportCsvUrl: (f) => `${BASE}/dataset/export.csv${qs(f)}`,
  upload: async (file) => {
    const body = new FormData()
    body.append('file', file)
    const res = await fetch(`${BASE}/dataset/upload`, { method: 'POST', body })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.detail || `Upload failed: ${res.status}`)
    return data
  },
  resetDataset: async () => {
    const res = await fetch(`${BASE}/dataset/reset`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.detail || `Reset failed: ${res.status}`)
    return data
  },
}
