import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import DowntimeHeatmap from './components/DowntimeHeatmap'
import DayOfWeekChart from './components/DayOfWeekChart'
import ParetoChart from './components/ParetoChart'
import UploadCard from './components/UploadCard'
import GroupingEditor from './components/GroupingEditor'
import './App.css'

const EMPTY_FILTERS = { start_date: '', end_date: '', reasons: '', valid_only: 'true' }

export default function App() {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [preset, setPreset] = useState('breakdown')
  const [version, setVersion] = useState(0) // bumped on upload / grouping change
  const [dimension, setDimension] = useState('reason') // 'reason' | 'group'
  const [editingGroups, setEditingGroups] = useState(false)

  const [reasons, setReasons] = useState([])
  const [dateRange, setDateRange] = useState({ min: null, max: null })
  const datesInitialized = useRef(false)
  // Which dataset is active. Driven by the backend's active_source, so it stays
  // accurate across a browser refresh (uploads persist until you switch back).
  const [source, setSource] = useState({ type: 'default', name: 'Sample dataset' })
  const [chart, setChart] = useState(null)
  const [efficiency, setEfficiency] = useState(null)
  const [streaks, setStreaks] = useState(null)
  const [insights, setInsights] = useState([])
  const [quality, setQuality] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  // Whether any real grouping is active (a reason whose group differs from itself).
  const hasGroups = useMemo(
    () => reasons.some((r) => r.group && r.group !== r.reason),
    [reasons],
  )

  // The categorical dimension the charts colour/aggregate by.
  const keyOf = useCallback(
    (seg) => (dimension === 'group' ? seg.group || seg.reason : seg.reason),
    [dimension],
  )

  // Distinct keys for the active dimension → stable colour assignment.
  const dimensionKeys = useMemo(() => {
    const keys =
      dimension === 'group'
        ? reasons.map((r) => r.group || r.reason)
        : reasons.map((r) => r.reason)
    return [...new Set(keys)].sort()
  }, [reasons, dimension])

  const colorMap = useMemo(() => buildColorMap(dimensionKeys), [dimensionKeys])

  const segments = chart?.segments || []
  const chartKeys = useMemo(
    () => [...new Set(segments.map(keyOf))].sort(),
    [segments, keyOf],
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

  // Once the data's date span is known, pre-fill From/To to that range so the
  // date pickers open on the right month instead of "today". Runs once per
  // dataset (reset when a new CSV is uploaded).
  useEffect(() => {
    if (
      !datesInitialized.current &&
      dateRange.min &&
      dateRange.max &&
      !filters.start_date &&
      !filters.end_date
    ) {
      datesInitialized.current = true
      setFilters((f) => ({ ...f, start_date: dateRange.min, end_date: dateRange.max }))
    }
  }, [dateRange, filters.start_date, filters.end_date])

  const resetFilters = () =>
    setFilters({
      start_date: dateRange.min || '',
      end_date: dateRange.max || '',
      reasons: '',
      valid_only: 'true',
    })

  // Switch the active dataset: clear the date range so the picker pre-fill waits
  // for the NEW dataset's span, then refetch (which also updates the source label
  // from the backend's active_source).
  const switchDataset = () => {
    datesInitialized.current = false
    setDateRange({ min: null, max: null })
    setFilters(EMPTY_FILTERS)
    setVersion((v) => v + 1)
  }

  // A new upload becomes the active dataset (persists until you switch back).
  const handleUploaded = () => switchDataset()

  // Return to the bundled sample dataset without needing a browser refresh.
  const returnToDefault = async () => {
    await api.resetDataset()
    switchDataset()
  }

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
        <div className="source-area">
          <div className="source-tag">
            <span className={`dot ${source.type}`} />
            <span>
              <b>{source.type === 'custom' ? source.name : 'Sample dataset'}</b>
              {source.valid != null && (
                <span className="muted"> · {source.valid}/{source.total} valid</span>
              )}
            </span>
            {source.type === 'custom' && (
              <button className="link-btn" onClick={returnToDefault}>
                Use sample data
              </button>
            )}
          </div>
          <UploadCard onUploaded={handleUploaded} />
        </div>
      </header>

      {error && <div className="banner bad">API error: {error}. Is the backend running?</div>}

      <KpiRow efficiency={efficiency} quality={quality} streaks={streaks} />

      <FilterBar
        reasons={reasons}
        filters={filters}
        dateRange={dateRange}
        onChange={setFilters}
        onReset={resetFilters}
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
                  Each bar is a shift, placed by time of day and colored by {dimension}.
                </p>
              </div>
              <div className="head-controls">
                <div className="seg">
                  <button
                    className={dimension === 'reason' ? 'seg-on' : ''}
                    onClick={() => setDimension('reason')}
                  >
                    Reason
                  </button>
                  <button
                    className={dimension === 'group' ? 'seg-on' : ''}
                    onClick={() => setDimension('group')}
                  >
                    Group{hasGroups ? '' : ' •'}
                  </button>
                </div>
                <button className="ghost" onClick={() => setEditingGroups(true)}>
                  Edit groups
                </button>
              </div>
            </div>
            <ShiftChart data={chart} colorMap={colorMap} keyOf={keyOf} />
            <Legend reasons={chartKeys} colorMap={colorMap} />
          </div>

          <div className="grid-2">
            <EfficiencyPanel data={efficiency} />
            <StreaksPanel data={streaks} preset={preset} onPresetChange={setPreset} />
          </div>

          <div className="grid-2">
            <DowntimeByReason
              segments={segments}
              colorMap={colorMap}
              keyOf={keyOf}
              dimension={dimension}
            />
            <ParetoChart segments={segments} colorMap={colorMap} keyOf={keyOf} />
          </div>

          <div className="grid-2">
            <DayOfWeekChart segments={segments} />
            <InsightsPanel insights={insights} />
          </div>

          <DowntimeHeatmap segments={segments} />

          <QualityReport data={quality} />
        </>
      )}

      <footer className="foot muted">
        Built by Md Raisul Islam Rahad ·{' '}
        <a href="https://github.com/raisulll" target="_blank" rel="noopener noreferrer">
          github.com/raisulll
        </a>
      </footer>

      {editingGroups && (
        <GroupingEditor
          onClose={() => setEditingGroups(false)}
          onSaved={() => setVersion((v) => v + 1)}
        />
      )}
    </div>
  )
}
