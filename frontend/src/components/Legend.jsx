export default function Legend({ reasons, colorMap }) {
  return (
    <div className="legend">
      {reasons.map((r) => (
        <span key={r} className="legend-item">
          <span className="swatch" style={{ background: colorMap[r] || '#888' }} />
          {r}
        </span>
      ))}
    </div>
  )
}
