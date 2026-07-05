// Top-of-dashboard KPI tiles, derived from data already fetched.
function Icon({ name }) {
  const paths = {
    gauge: 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0-11a9 9 0 0 0-9 9 9 9 0 0 0 2 5.6l1.5-1.3A7 7 0 1 1 12 5a7 7 0 0 1 5.5 2.7l1.5-1.3A9 9 0 0 0 12 3Z',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 16a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm1-11h-2v5l4 2 .8-1.7L13 11Z',
    check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
    fire: 'M12 2c1 3-2 4-2 7 0 1.5 1 2.5 2 2.5S16 12 15 9c3 2 4 5 4 7a7 7 0 1 1-14 0c0-3 2-5 3-7 .5 2 2 2 2 0 0-2-1-4 2-7Z',
  }
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d={paths[name]} fill="currentColor" />
    </svg>
  )
}

export default function KpiRow({ efficiency, quality, streaks }) {
  const eff = efficiency?.overall?.efficiency
  const totalHours = efficiency?.overall?.total_hours
  const s = quality?.summary
  const longest = (streaks?.streaks || []).reduce((m, x) => Math.max(m, x.length_days), 0)

  const effTone = eff == null ? '' : eff >= 85 ? 'good' : eff >= 70 ? 'warn' : 'bad'

  const tiles = [
    {
      key: 'eff',
      icon: 'gauge',
      tone: effTone || 'brand',
      value: eff != null ? `${eff}%` : '—',
      label: 'Operational Efficiency',
    },
    {
      key: 'hours',
      icon: 'clock',
      tone: 'brand',
      value: totalHours != null ? `${totalHours}` : '—',
      unit: 'h',
      label: 'Total Shift Hours',
    },
    {
      key: 'quality',
      icon: 'check',
      tone: 'good',
      value: s ? `${s.valid}` : '—',
      unit: s ? `/ ${s.total}` : '',
      label: 'Valid Records',
    },
    {
      key: 'streak',
      icon: 'fire',
      tone: longest ? 'bad' : 'muted',
      value: longest ? `${longest}` : '0',
      unit: longest ? 'days' : '',
      label: `Longest ${streaks?.target?.replace('_', ' ') || 'breakdown'} streak`,
    },
  ]

  return (
    <div className="kpi-row">
      {tiles.map((t) => (
        <div className="kpi" key={t.key}>
          <div className={`kpi-icon ${t.tone}`}>
            <Icon name={t.icon} />
          </div>
          <div className="kpi-body">
            <div className="kpi-value">
              {t.value}
              {t.unit && <span className="kpi-unit"> {t.unit}</span>}
            </div>
            <div className="kpi-label">{t.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
