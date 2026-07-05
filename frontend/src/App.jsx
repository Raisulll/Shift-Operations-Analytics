import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { buildColorMap } from './colors'
import FilterBar from './components/FilterBar'
import Legend from './components/Legend'
import KpiRow from './components/KpiRow'
import ShiftChart from './components/ShiftChart'
import EfficiencyPanel from './components/EfficiencyPanel'
import StreaksPanel from './components/StreaksPanel'
import InsightsPanel from './components/InsightsPanel'
import QualityReport from './components/QualityReport'
import DowntimeByReason from './components/DowntimeByReason'
import UploadCard from './components/UploadCard'
import './App.css'

const EMPTY_FILTERS = { start_date: '', end_date: '', reasons: '', valid_only: 'true' }

export default function App() {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [preset, setPreset] = useState('breakdown')
  const [version, setVersion] = useState(0) // bumped on upload to refetch everything

  const [reasons, setReasons] = useState([])
  const [chart, setChart] = useState(null)
  const [efficiency, setEfficiency] = useState(null)
  const [streaks, setStreaks] = useState(null)
  const [insights, setInsights] = useState([])
  const [quality, setQuality] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  // Colours are derived once from all reasons so they stay stable under filtering.
  const colorMap = useMemo(
    () => buildColorMap(reasons.map((r) => r.reason).sort()),
    [reasons],
  )

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rs, ch, ef, st, ins, ql] = await Promise.all([
        api.reasons(),
        api.shiftChart(filters),
        api.efficiency(filters),
        api.streaks({ ...filters, preset }),
        api.insights(filters),
        api.qualityReport(),
      ])
      setReasons(rs.reasons)
      setChart(ch)
      setEfficiency(ef)
      setStreaks(st)
      setInsights(ins.insights)
      setQuality(ql)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filters, preset, version])

  useEffect(() => {
    refetch()
  }, [refetch])

  const chartReasons = chart?.reasons || []

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path
                d="M4 20V4h2v14h14v2H4Zm4-3 4-5 3 3 5-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h1>Shift Operations Analytics</h1>
            <p className="sub">
              Visualize shift patterns, downtime and operational efficiency from shift records.
            </p>
          </div>
        </div>
        <UploadCard onUploaded={() => setVersion((v) => v + 1)} />
      </header>

      {error && <div className="banner bad">API error: {error}. Is the backend running?</div>}

      <KpiRow efficiency={efficiency} quality={quality} streaks={streaks} />

      <FilterBar
        reasons={reasons}
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(EMPTY_FILTERS)}
      />

      {loading && !chart ? (
        <div className="empty">Loading…</div>
      ) : (
        <>
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>Shift Analysis</h2>
                <p className="panel-sub">
                  Each bar is a shift, placed by time of day and colored by reason.
                </p>
              </div>
            </div>
            <ShiftChart data={chart} colorMap={colorMap} />
            <Legend reasons={chartReasons} colorMap={colorMap} />
          </div>

          <div className="grid-2">
            <EfficiencyPanel data={efficiency} />
            <StreaksPanel data={streaks} preset={preset} onPresetChange={setPreset} />
          </div>

          <div className="grid-2">
            <DowntimeByReason segments={chart?.segments} colorMap={colorMap} />
            <InsightsPanel insights={insights} />
          </div>

          <QualityReport data={quality} />
        </>
      )}

      <footer className="foot muted">
        Renata assignment · React + Django + DRF · data-derived, no hardcoded categories.
      </footer>
    </div>
  )
}
