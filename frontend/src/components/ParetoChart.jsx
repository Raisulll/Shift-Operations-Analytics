import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

const THRESHOLD = 80 // the classic Pareto cut-off

// Pareto chart: hours per category (bars, descending) with a cumulative-% line.
// The "vital few" categories that make up the first 80% are highlighted; the
// "trivial many" beyond the 80% line are dimmed.
export default function ParetoChart({ segments, colorMap, keyOf = (s) => s.reason }) {
  const totals = {}
  for (const s of segments || []) {
    const k = keyOf(s)
    totals[k] = (totals[k] || 0) + (s.hours || 0)
  }
  const sorted = Object.entries(totals)
    .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
    .sort((a, b) => b.hours - a.hours)

  if (!sorted.length) return null
  const grand = sorted.reduce((a, b) => a + b.hours, 0) || 1

  let run = 0
  const data = sorted.map((d) => {
    const before = (run / grand) * 100 // cumulative % before adding this bar
    run += d.hours
    return {
      ...d,
      cumulative: Math.round((run / grand) * 1000) / 10,
      // "Vital few": every bar up to and including the one that crosses 80%.
      vital: before < THRESHOLD,
    }
  })
  const vitalCount = data.filter((d) => d.vital).length

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Pareto of Logged Hours</h2>
          <p className="panel-sub">
            {vitalCount} of {data.length} categories drive ~{THRESHOLD}% of all hours
            (highlighted). Focus the vital few.
          </p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 62, left: -6 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            interval={0}
            tick={{ fontSize: 10, fill: '#666' }}
          />
          <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#777' }} unit="h" />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#777' }}
            unit="%"
          />
          <Tooltip
            formatter={(v, name) => (name === 'cumulative' ? `${v}%` : `${v} h`)}
          />
          <ReferenceLine
            yAxisId="right"
            y={THRESHOLD}
            stroke="#94a3b8"
            strokeDasharray="5 4"
            label={{ value: `${THRESHOLD}%`, position: 'right', fontSize: 10, fill: '#94a3b8' }}
          />
          <Bar yAxisId="left" dataKey="hours" radius={[3, 3, 0, 0]}>
            {data.map((d) => (
              <Cell
                key={d.name}
                fill={colorMap[d.name] || '#888'}
                fillOpacity={d.vital ? 0.95 : 0.28}
              />
            ))}
          </Bar>
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cumulative"
            stroke="#0f172a"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="pareto-key">
        <span className="legend-item">
          <span className="swatch" style={{ background: '#64748b', opacity: 0.95 }} />
          Vital few (≤ {THRESHOLD}%)
        </span>
        <span className="legend-item">
          <span className="swatch" style={{ background: '#64748b', opacity: 0.28 }} />
          Trivial many
        </span>
      </div>
    </div>
  )
}
