export default function StreaksPanel({ data, preset, onPresetChange }) {
  const streaks = data?.streaks || []
  const presets = data?.presets || {}

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Breakdown Streaks</h2>
        <div className="seg">
          {Object.keys(presets).map((name) => (
            <button
              key={name}
              className={preset === name ? 'seg-on' : ''}
              onClick={() => onPresetChange(name)}
            >
              {name.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>
      <p className="caption">
        Runs of ≥ {data?.min_days ?? 2} consecutive days with a{' '}
        <strong>{(data?.target_reasons || []).join(', ')}</strong> event. A gap ends a streak.
      </p>
      {streaks.length === 0 ? (
        <div className="empty small">No streaks for this target on the current data.</div>
      ) : (
        <ul className="streak-list">
          {streaks.map((s, i) => (
            <li key={i}>
              <div className="streak-span">
                {s.start} → {s.end}
                <span className="badge">{s.length_days} days</span>
              </div>
              <div className="streak-meta muted">
                {s.downtime_hours} h downtime · {s.record_count} events
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
