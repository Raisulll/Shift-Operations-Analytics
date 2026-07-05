import { useState } from 'react'

export default function QualityReport({ data }) {
  const [open, setOpen] = useState(false)
  if (!data) return null
  const { summary, rows } = data

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Data Quality Report</h2>
        <button className="ghost" onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide rows' : 'Show flagged rows'}
        </button>
      </div>
      <div className="quality-summary">
        <span className="q-stat">
          <strong>{summary.total}</strong> total
        </span>
        <span className="q-stat good">
          <strong>{summary.valid}</strong> valid
        </span>
        <span className="q-stat bad">
          <strong>{summary.invalid}</strong> excluded
        </span>
        {Object.entries(summary.issue_counts).map(([code, n]) => (
          <span key={code} className="issue-pill">
            {code} <b>{n}</b>
          </span>
        ))}
      </div>
      {open && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Row</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Issues &amp; action taken</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.source_row}>
                  <td>{r.source_row}</td>
                  <td>{r.reason}</td>
                  <td>
                    <span className={r.is_valid ? 'tag good' : 'tag bad'}>
                      {r.is_valid ? 'kept' : 'excluded'}
                    </span>
                  </td>
                  <td>
                    {r.issues.map((iss, i) => (
                      <div key={i} className="issue-line">
                        <code>{iss.code}</code> — {iss.detail}{' '}
                        <em className="muted">({iss.action})</em>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
