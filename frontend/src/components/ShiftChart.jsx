import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  usePlotArea,
} from 'recharts'

// The required shift-analysis chart.
//   X axis = date, Y axis = time of day from 12 AM to the *next* 12 PM (36 h),
//   each shift drawn as a bar in its reason's colour, spanning start -> end.
// The 36 h axis lets overnight (cross-midnight) shifts render correctly.

const AXIS_MAX = 36 * 60 // minutes

function timeLabel(min) {
  const h = Math.floor(min / 60)
  const base = h % 24
  const suffix = h >= 24 ? ' (+1)' : ''
  const ampm = base < 12 ? 'AM' : 'PM'
  let hh = base % 12
  if (hh === 0) hh = 12
  return `${hh} ${ampm}${suffix}`
}

// Draws the coloured shift bars using the chart's live plot rectangle.
// usePlotArea() (Recharts 3.1+) returns {x, y, width, height} in pixels and
// keeps the bars aligned with the axes on resize.
function ShiftBars({ dates, segments, colorMap }) {
  const area = usePlotArea()
  if (!area || !dates.length) return null
  const { x: left, y: top, width, height } = area
  const n = dates.length
  const band = width / n
  const yPix = (v) => top + (1 - v / AXIS_MAX) * height
  const dateIndex = Object.fromEntries(dates.map((d, i) => [d, i]))

  // Group segments by date so we can spread same-day bars across the band.
  const byDate = {}
  for (const s of segments) (byDate[s.date] ||= []).push(s)

  const rects = []
  for (const [date, segs] of Object.entries(byDate)) {
    const k = dateIndex[date]
    if (k === undefined) continue
    const center = left + (k + 0.5) * band
    const usable = band * 0.72
    const slot = usable / segs.length
    const barW = Math.min(slot * 0.9, 16)
    segs
      .slice()
      .sort((a, b) => a.start_min - b.start_min)
      .forEach((s, i) => {
        const xPos = center - usable / 2 + slot * i + (slot - barW) / 2
        const yTop = yPix(s.end_min)
        const yBot = yPix(s.start_min)
        const h = Math.max(2, yBot - yTop)
        rects.push(
          <rect
            key={`${date}-${s.source_row}-${i}`}
            x={xPos}
            y={yTop}
            width={barW}
            height={h}
            rx={2}
            fill={colorMap[s.reason] || '#888'}
            fillOpacity={0.92}
            stroke="#fff"
            strokeWidth={0.5}
          >
            <title>
              {`${s.reason}\n${date}\n${timeLabel(s.start_min)} -> ${timeLabel(
                s.end_min,
              )}\n${s.hours} h${s.crosses_midnight ? '  (overnight)' : ''}`}
            </title>
          </rect>,
        )
      })
  }
  return <g>{rects}</g>
}

export default function ShiftChart({ data, colorMap }) {
  const segments = data?.segments || []
  const dates = [...new Set(segments.map((s) => s.date))].sort()

  const yTicks = []
  for (let m = 0; m <= AXIS_MAX; m += 180) yTicks.push(m)

  if (!segments.length) {
    return <div className="empty">No records match the current filters.</div>
  }

  return (
    <ResponsiveContainer width="100%" height={460}>
      <ScatterChart margin={{ top: 10, right: 20, bottom: 60, left: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
        <XAxis
          type="number"
          dataKey="x"
          domain={[0, dates.length]}
          ticks={dates.map((_, i) => i + 0.5)}
          tickFormatter={(v) => dates[Math.floor(v)] || ''}
          angle={-45}
          textAnchor="end"
          interval={0}
          tick={{ fontSize: 11, fill: '#555' }}
          label={{ value: 'Date', position: 'insideBottom', offset: -50, fill: '#666' }}
        />
        <YAxis
          type="number"
          dataKey="y"
          domain={[0, AXIS_MAX]}
          ticks={yTicks}
          tickFormatter={timeLabel}
          tick={{ fontSize: 11, fill: '#555' }}
          width={70}
          label={{
            value: 'Time of day (12 AM -> next 12 PM)',
            angle: -90,
            position: 'insideLeft',
            style: { textAnchor: 'middle', fill: '#666' },
          }}
        />
        {/* Empty series keeps ScatterChart happy; bars are drawn by ShiftBars. */}
        <Scatter data={[]} />
        <ShiftBars dates={dates} segments={segments} colorMap={colorMap} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}
