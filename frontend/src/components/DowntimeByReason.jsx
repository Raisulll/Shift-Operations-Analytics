import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts'

// Extra visualization: total logged hours per reason (from the current filter
// selection). Aggregated client-side from the shift-chart segments.
export default function DowntimeByReason({ segments, colorMap }) {
  const totals = {}
  for (const s of segments || []) {
    totals[s.reason] = (totals[s.reason] || 0) + (s.hours || 0)
  }
  const data = Object.entries(totals)
    .map(([reason, hours]) => ({ reason, hours: Math.round(hours * 10) / 10 }))
    .sort((a, b) => b.hours - a.hours)

  if (!data.length) return null

  return (
    <div className="panel">
      <h2>Hours by Reason</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 6, right: 16, bottom: 60, left: -6 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
          <XAxis
            dataKey="reason"
            angle={-45}
            textAnchor="end"
            interval={0}
            tick={{ fontSize: 10, fill: '#666' }}
          />
          <YAxis tick={{ fontSize: 10, fill: '#777' }} unit="h" />
          <Tooltip formatter={(v) => `${v} h`} />
          <Bar dataKey="hours">
            {data.map((d) => (
              <Cell key={d.reason} fill={colorMap[d.reason] || '#888'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
