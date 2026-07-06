// Maintenance reliability KPIs (MTBF / MTTR / availability). Data comes from
// /analysis/reliability and updates with the active filters.
function fmtHours(h) {
  return h == null ? '—' : `${h} h`
}

export default function ReliabilityPanel({ data }) {
  const hasFailures = data && data.failure_count > 0
  const n = data?.failure_count
  const reasonsList = data?.failure_reasons?.join(', ') || 'unplanned failures'

  const tiles = [
    {
      key: 'mtbf',
      tone: 'brand',
      value: fmtHours(data?.mtbf_hours),
      label: 'MTBF · Mean time between failures',
      title: data
        ? `MTBF = uptime ÷ failures = ${data.uptime_hours} h ÷ ${n} = ${fmtHours(data.mtbf_hours)}.\nAverage operating time between unplanned failures (higher is better).`
        : '',
    },
    {
      key: 'mttr',
      tone: 'warn',
      value: fmtHours(data?.mttr_hours),
      label: 'MTTR · Mean time to repair',
      title: data
        ? `MTTR = downtime ÷ failures = ${data.downtime_hours} h ÷ ${n} = ${fmtHours(data.mttr_hours)}.\nAverage length of one unplanned failure (lower is better).`
        : '',
    },
    {
      key: 'avail',
      tone:
        data?.availability_percent == null
          ? 'muted'
          : data.availability_percent >= 90
            ? 'good'
            : data.availability_percent >= 75
              ? 'warn'
              : 'bad',
      value:
        data?.availability_percent != null ? `${data.availability_percent}%` : '—',
      label: 'Availability (uptime share)',
      title: data
        ? `Availability = uptime ÷ total logged time = ${data.uptime_hours} h ÷ ${data.total_hours} h = ${data.availability_percent}%.\nEquivalent to MTBF ÷ (MTBF + MTTR).`
        : '',
    },
    {
      key: 'failures',
      tone: hasFailures ? 'bad' : 'muted',
      value: data ? `${data.failure_count}` : '—',
      label: `Failures · ${data ? fmtHours(data.downtime_hours) : '—'} downtime`,
      title: data
        ? `Counts records tagged as unplanned failures: ${reasonsList}.\n${n} events, ${data.downtime_hours} h total downtime.`
        : '',
    },
  ]

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Reliability</h2>
          <p className="panel-sub">
            Standard maintenance KPIs computed over unplanned failures.
          </p>
        </div>
      </div>

      {data && !hasFailures ? (
        <div className="empty small">No unplanned failures in this view — nothing to repair. 🎉</div>
      ) : (
        <div className="kpi-row rel-row">
          {tiles.map((t) => (
            <div className="kpi rel-kpi" key={t.key} title={t.title}>
              <div className="kpi-body">
                <div className={`kpi-value tone-${t.tone}`}>{t.value}</div>
                <div className="kpi-label">{t.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
