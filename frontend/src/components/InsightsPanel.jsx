export default function InsightsPanel({ insights }) {
  if (!insights?.length) return null
  return (
    <div className="panel">
      <h2>Operational Insights</h2>
      <ol className="insight-list">
        {insights.map((ins, i) => (
          <li key={i}>
            <div className="insight-title">{ins.title}</div>
            <div className="insight-detail">{ins.detail}</div>
          </li>
        ))}
      </ol>
    </div>
  )
}
