import { useState } from 'react'
import { api } from '../api'

// On-demand, AI-written executive summary of the current view. Deliberately not
// auto-run: it costs an API call and takes a moment, so the user triggers it
// (and it always reflects the filters active at click time).
export default function AiSummaryCard({ filters }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generate = async () => {
    setLoading(true)
    setError('')
    try {
      const d = await api.aiSummary(filters)
      setText(d.summary)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel ai-summary">
      <div className="panel-head">
        <div>
          <h2>AI Summary ✨</h2>
          <p className="panel-sub">
            A plain-language readout of the current view — efficiency, downtime and data quality.
          </p>
        </div>
        <button className="primary" onClick={generate} disabled={loading}>
          {loading ? 'Generating…' : text ? 'Regenerate' : 'Generate summary'}
        </button>
      </div>

      {error && <div className="banner bad">{error}</div>}

      {loading && !text ? (
        <div className="ai-summary-loading">
          <span className="spinner" aria-hidden="true" />
          <span>Reading the numbers and writing your briefing…</span>
        </div>
      ) : text ? (
        <p className="ai-summary-text">{text}</p>
      ) : (
        !error && (
          <p className="muted small">
            Click “Generate summary” for an AI-written overview you can drop straight into a report.
          </p>
        )
      )}
    </div>
  )
}
