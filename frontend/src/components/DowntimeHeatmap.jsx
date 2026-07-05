import { fmtShort, fmtLong } from '../dates'

// Activity heatmap: how many shifts are active in each hour of the day, per date.
// Directly answers "help users understand operational activity over time."
export default function DowntimeHeatmap({ segments }) {
  const dates = [...new Set((segments || []).map((s) => s.date))].sort()
  if (!dates.length) return null

  const dateIdx = Object.fromEntries(dates.map((d, i) => [d, i]))
  // grid[hour][dateIndex] = count of shifts active during that hour.
  const grid = Array.from({ length: 24 }, () => Array(dates.length).fill(0))
  let max = 0
  for (const s of segments) {
    const col = dateIdx[s.date]
    if (col === undefined) continue
    const startH = Math.floor(s.start_min / 60)
    const endH = Math.ceil(Math.min(s.end_min, 1440) / 60) // clamp to the day
    for (let h = startH; h < endH && h < 24; h++) {
      grid[h][col] += 1
      if (grid[h][col] > max) max = grid[h][col]
    }
  }

  const shade = (v) => {
    if (!v) return '#f4f6fa'
    const t = 0.18 + 0.82 * (v / max) // 0.18..1 intensity
    return `rgba(79, 70, 229, ${t.toFixed(2)})`
  }

  // Same time-of-day format as the Shift Analysis chart's Y axis.
  const hourLabel = (h) => {
    const ampm = h % 24 < 12 ? 'AM' : 'PM'
    let hh = h % 12
    if (hh === 0) hh = 12
    return `${hh} ${ampm}`
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Activity Heatmap</h2>
          <p className="panel-sub">Shifts active by hour of day (rows) across dates (columns).</p>
        </div>
      </div>
      <div className="heatmap-wrap">
        <div
          className="heatmap"
          style={{ gridTemplateColumns: `58px repeat(${dates.length}, 1fr)` }}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <div className="heat-row" key={h} style={{ display: 'contents' }}>
              <div className="heat-hour">{h % 3 === 0 ? hourLabel(h) : ''}</div>
              {dates.map((d, col) => (
                <div
                  key={d}
                  className="heat-cell"
                  style={{ background: shade(grid[h][col]) }}
                  title={`${fmtLong(d)} · ${hourLabel(h)} · ${grid[h][col]} active`}
                />
              ))}
            </div>
          ))}
          <div className="heat-hour" />
          {dates.map((d) => (
            <div className="heat-date" key={d}>
              {fmtShort(d)}
            </div>
          ))}
        </div>
      </div>
      <div className="heat-legend">
        <span className="muted small">Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <span
            key={t}
            className="heat-swatch"
            style={{ background: t === 0 ? '#f4f6fa' : `rgba(79,70,229,${0.18 + 0.82 * t})` }}
          />
        ))}
        <span className="muted small">More</span>
      </div>
    </div>
  )
}
