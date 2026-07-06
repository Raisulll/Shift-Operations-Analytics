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
  reasons = [],
}) {
  const segments = chart?.segments || []
  const chartKeys = useMemo(
    () => [...new Set(segments.map(keyOf))].sort(),
    [segments, keyOf],
  )

  // In group mode, show which raw reasons make up each real group (a group
  // that actually merges reasons — not a standalone reason that is its own
  // group). This makes the grouping visible at a glance.
  const groupComposition = useMemo(() => {
    if (dimension !== 'group') return []
    const byLabel = new Map()
    for (const r of reasons) {
      const label = r.group || r.reason
      const members = byLabel.get(label) || []
      members.push(r.reason)
      byLabel.set(label, members)
    }
    return [...byLabel.entries()]
      .filter(([label, members]) => members.length > 1 || members[0] !== label)
      .map(([label, members]) => ({ label, members: members.sort() }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [dimension, reasons])

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

      {groupComposition.length > 0 && (
        <div className="group-legend">
          <div className="group-legend-title">Groups → reasons</div>
          {groupComposition.map((g) => (
            <div className="group-legend-row" key={g.label}>
              <span className="swatch" style={{ background: colorMap[g.label] || '#888' }} />
              <b>{g.label}</b>
              <span className="group-legend-members">{g.members.join(', ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
