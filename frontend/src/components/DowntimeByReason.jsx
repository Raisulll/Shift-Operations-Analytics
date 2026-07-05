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

// Total logged hours per category (reason or group, per the active dimension).
export default function DowntimeByReason({
  segments,
  colorMap,
  keyOf = (s) => s.reason,
  dimension = 'reason',
}) {
  const totals = {}
  for (const s of segments || []) {
    const k = keyOf(s)
    totals[k] = (totals[k] || 0) + (s.hours || 0)
  }
  const data = Object.entries(totals)
    .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
    .sort((a, b) => b.hours - a.hours)

  if (!data.length) return null

  return (
    <div className="panel">
      <h2>Hours by {dimension === 'group' ? 'Group' : 'Reason'}</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 6, right: 16, bottom: 62, left: -6 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            interval={0}
            tick={{ fontSize: 10, fill: '#666' }}
          />
          <YAxis tick={{ fontSize: 10, fill: '#777' }} unit="h" />
          <Tooltip formatter={(v) => `${v} h`} />
          <Bar dataKey="hours" radius={[3, 3, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.name} fill={colorMap[d.name] || '#888'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
