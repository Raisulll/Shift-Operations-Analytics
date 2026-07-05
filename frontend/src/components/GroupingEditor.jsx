import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'

// Modal to assign raw reasons into named groups. Saving persists server-side,
// so every chart, streak and score re-aggregates against the new categories —
// a live demonstration of "remains useful when categories are grouped".
export default function GroupingEditor({ onClose, onSaved }) {
  const [reasons, setReasons] = useState([])
  const [map, setMap] = useState({}) // { reason: groupLabel | '' }
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    api.grouping().then((d) => {
      setReasons(d.available_reasons)
      const m = {}
      for (const r of d.available_reasons) m[r] = ''
      for (const [label, members] of Object.entries(d.groups)) {
        for (const r of members) m[r] = label
      }
      setMap(m)
      setLoaded(true)
    })
  }, [])

  const existingGroups = useMemo(
    () => [...new Set(Object.values(map).filter(Boolean))].sort(),
    [map],
  )

  const setGroup = (reason, label) => setMap((m) => ({ ...m, [reason]: label }))

  const quickFailureFamily = () => {
    const fam = ['Breakdown', 'Machine Jam', 'Unknown Failure', 'Power Failure']
    setMap((m) => {
      const next = { ...m }
      for (const r of reasons) if (fam.includes(r)) next[r] = 'Equipment Failure'
      return next
    })
  }

  const clearAll = () => setMap((m) => Object.fromEntries(Object.keys(m).map((k) => [k, ''])))

  const save = async () => {
    setBusy(true)
    const groups = {}
    for (const [reason, label] of Object.entries(map)) {
      const l = label.trim()
      if (l) (groups[l] ||= []).push(reason)
    }
    try {
      await api.setGrouping(groups)
      onSaved()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Group reasons</h2>
            <p className="panel-sub">
              Assign each reason to a group (leave blank to keep it standalone). Charts,
              streaks and efficiency update on save.
            </p>
          </div>
          <button className="ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-actions">
          <button className="ghost" onClick={quickFailureFamily}>
            Quick: group all failures → “Equipment Failure”
          </button>
          <button className="ghost" onClick={clearAll}>
            Clear all
          </button>
        </div>

        {!loaded ? (
          <div className="empty small">Loading…</div>
        ) : (
          <div className="group-grid">
            {reasons.map((r) => (
              <div className="group-row" key={r}>
                <span className="group-reason">{r}</span>
                <input
                  list="group-names"
                  placeholder="— standalone —"
                  value={map[r] || ''}
                  onChange={(e) => setGroup(r, e.target.value)}
                />
              </div>
            ))}
            <datalist id="group-names">
              {existingGroups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
        )}

        <div className="modal-foot">
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save grouping'}
          </button>
        </div>
      </div>
    </div>
  )
}
