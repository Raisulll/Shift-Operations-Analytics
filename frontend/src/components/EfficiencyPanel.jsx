import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

export default function EfficiencyPanel({ data }) {
  if (!data) return null
  const { overall, by_date } = data
  const score = overall.efficiency

  const tone = score >= 85 ? 'good' : score >= 70 ? 'warn' : 'bad'

  return (
    <div className="panel">
      <h2>Operational Efficiency</h2>
      <div className="eff-header">
        <div className={`score ${tone}`}>
          {score != null ? `${score}%` : '—'}
        </div>
        <div className="eff-meta">
          <div>
            <strong>{overall.productive_hours} h</strong> productive
          </div>
          <div>
            <strong>{overall.total_hours} h</strong> total
          </div>
          <div className="muted">
            Productive = hours not in {data.non_productive_reasons.join(' / ')}
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={by_date} margin={{ top: 6, right: 16, bottom: 4, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#777' }} interval="preserveStartEnd" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#777' }} unit="%" />
          <Tooltip formatter={(v) => (v == null ? '—' : `${v}%`)} />
          <ReferenceLine y={score} stroke="#bbb" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="efficiency"
            stroke="#4e79a7"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="caption">Daily efficiency; dashed line marks the overall average.</p>
    </div>
  )
}
