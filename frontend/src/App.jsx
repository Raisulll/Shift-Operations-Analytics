import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import { buildColorMap } from './colors'
import { useDashboardData } from './hooks/useDashboardData'
import FilterBar from './components/FilterBar'
import KpiRow from './components/KpiRow'
import ShiftAnalysisPanel from './components/ShiftAnalysisPanel'
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
import AiSummaryCard from './components/AiSummaryCard'
import ReliabilityPanel from './components/ReliabilityPanel'
import './App.css'

const EMPTY_FILTERS = { start_date: '', end_date: '', reasons: '', valid_only: 'true' }

export default function App() {
  // Control state that drives the queries; all server data lives in the hook.
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [preset, setPreset] = useState('breakdown')
  const [version, setVersion] = useState(0) // bumped on upload / grouping change
  const [dimension, setDimension] = useState('reason') // 'reason' | 'group'
  const [editingGroups, setEditingGroups] = useState(false)
  const datesInitialized = useRef(false)

  const {
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
  } = useDashboardData({ filters, preset, version })

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

  // Once the data's date span is known, pre-fill From/To to that range so the
  // date pickers open on the right month instead of "today". Runs once per
  // dataset (reset when a new dataset becomes active).
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

  // Switch the active dataset: clear the known date span (so the picker pre-fill
  // waits for the NEW dataset's span) and bump the version to refetch.
  const switchDataset = () => {
    datesInitialized.current = false
    resetDateRange()
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
        dimension={dimension}
        onChange={setFilters}
        onReset={resetFilters}
      />

      {loading && !chart ? (
        <div className="empty loading-state">
          <span className="spinner" aria-hidden="true" />
          {slowLoad ? (
            <>
              <p className="loading-title">Waking up the server…</p>
              <p className="loading-sub">
                The backend sleeps when idle and can take up to a minute to spin
                back up on the first request. Hang tight — this only happens once.
              </p>
            </>
          ) : (
            <p className="loading-title">Loading…</p>
          )}
        </div>
      ) : (
        <>
          <ShiftAnalysisPanel
            chart={chart}
            colorMap={colorMap}
            keyOf={keyOf}
            dimension={dimension}
            onDimensionChange={setDimension}
            hasGroups={hasGroups}
            onEditGroups={() => setEditingGroups(true)}
            exportHref={api.exportCsvUrl(filters)}
            reasons={reasons}
          />

          {/* key={version} remounts the card (clearing any stale summary)
              whenever the dataset changes — upload, return-to-default, regroup. */}
          <AiSummaryCard key={version} filters={filters} />

          <div className="grid-2">
            <EfficiencyPanel data={efficiency} />
            <StreaksPanel data={streaks} preset={preset} onPresetChange={setPreset} />
          </div>

          <ReliabilityPanel data={reliability} />

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
