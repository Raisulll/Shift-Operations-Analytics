import { useMemo } from 'react'
import ShiftChart from './ShiftChart'
import Legend from './Legend'

// The primary shift-analysis panel: the required chart plus its legend and the
// Reason/Group toggle, grouping editor entry point, and CSV export. Self-derives
// the legend keys from the chart data for the active dimension.
export default function ShiftAnalysisPanel({
  chart,
  colorMap,
  keyOf,
  dimension,
  onDimensionChange,
  hasGroups,
  onEditGroups,
  exportHref,
}) {
  const segments = chart?.segments || []
  const chartKeys = useMemo(
    () => [...new Set(segments.map(keyOf))].sort(),
    [segments, keyOf],
  )

  return (
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
              onClick={() => onDimensionChange('reason')}
            >
              Reason
            </button>
            <button
              className={dimension === 'group' ? 'seg-on' : ''}
              onClick={() => onDimensionChange('group')}
            >
              Group{hasGroups ? '' : ' •'}
            </button>
          </div>
          <button className="ghost" onClick={onEditGroups}>
            Edit groups
          </button>
          <a className="ghost btn-link" href={exportHref} download="shift_records.csv">
            Export CSV
          </a>
        </div>
      </div>
      <ShiftChart data={chart} colorMap={colorMap} keyOf={keyOf} />
      <Legend reasons={chartKeys} colorMap={colorMap} />
    </div>
  )
}
