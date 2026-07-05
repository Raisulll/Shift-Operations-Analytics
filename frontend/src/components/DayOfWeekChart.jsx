import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Total shift hours by day of week — surfaces weekday operational patterns.
export default function DayOfWeekChart({ segments }) {
  const totals = Object.fromEntries(DAYS.map((d) => [d, 0]))
  for (const s of segments || []) {
    const dt = new Date(`${s.date}T00:00:00`)
    const idx = (dt.getDay() + 6) % 7 // JS: 0=Sun -> shift so Mon=0
    totals[DAYS[idx]] += s.hours || 0
  }
  const data = DAYS.map((d) => ({ day: d, hours: Math.round(totals[d] * 10) / 10 }))
  const hasData = data.some((d) => d.hours > 0)
  if (!hasData) return null

  return (
    <div className="panel">
      <h2>Hours by Day of Week</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 6, right: 16, bottom: 4, left: -6 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#666' }} />
          <YAxis tick={{ fontSize: 10, fill: '#777' }} unit="h" />
          <Tooltip formatter={(v) => `${v} h`} />
          <Bar dataKey="hours" fill="#7c3aed" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
