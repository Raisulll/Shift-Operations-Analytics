import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'

const DEFAULT_SOURCE = { type: 'default', name: 'Sample dataset' }

// Owns all server-derived dashboard state and the fetch orchestration. Refetches
// whenever the filters, the streak preset, or the dataset version changes — so
// the component tree stays declarative and free of data-loading plumbing.
export function useDashboardData({ filters, preset, version }) {
  const [reasons, setReasons] = useState([])
  const [dateRange, setDateRange] = useState({ min: null, max: null })
  const [source, setSource] = useState(DEFAULT_SOURCE)
  const [chart, setChart] = useState(null)
  const [efficiency, setEfficiency] = useState(null)
  const [reliability, setReliability] = useState(null)
  const [streaks, setStreaks] = useState(null)
  const [insights, setInsights] = useState([])
  const [quality, setQuality] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [slowLoad, setSlowLoad] = useState(false)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    // The backend (Render free tier) spins down when idle, so the first request
    // after a lull cold-starts and can take up to a minute. If we're still
    // waiting after 4s, flip slowLoad so the UI can reassure instead of freezing.
    setSlowLoad(false)
    const slowTimer = setTimeout(() => setSlowLoad(true), 4000)
    try {
      const [rs, ch, ef, st, ins, ql, rel] = await Promise.all([
        api.reasons(),
        api.shiftChart(filters),
        api.efficiency(filters),
        api.streaks({ ...filters, preset }),
        api.insights(filters),
        api.qualityReport(),
        api.reliability(filters),
      ])
      setReasons(rs.reasons)
      setDateRange(rs.date_range || { min: null, max: null })
      if (rs.active_source) {
        setSource({
          type: rs.active_source.is_custom ? 'custom' : 'default',
          name: rs.active_source.name,
          valid: rs.active_source.valid,
          total: rs.active_source.total,
        })
      }
      setChart(ch)
      setEfficiency(ef)
      setReliability(rel)
      setStreaks(st)
      setInsights(ins.insights)
      setQuality(ql)
    } catch (e) {
      setError(e.message)
    } finally {
      clearTimeout(slowTimer)
      setSlowLoad(false)
      setLoading(false)
    }
  }, [filters, preset, version])

  useEffect(() => {
    refetch()
  }, [refetch])

  // Called by the container when switching datasets, so the date-picker pre-fill
  // waits for the NEW dataset's span instead of reusing the previous one.
  const resetDateRange = useCallback(() => setDateRange({ min: null, max: null }), [])

  return {
    reasons,
    dateRange,
    source,
    chart,
    efficiency,
    reliability,
    streaks,
    insights,
    quality,
    error,
    loading,
    slowLoad,
    resetDateRange,
  }
}
