// Filter controls that drive every query. All options are data-derived.
export default function FilterBar({ reasons, filters, dateRange, onChange, onReset }) {
  const min = dateRange?.min || undefined
  const max = dateRange?.max || undefined
  const selected = new Set(filters.reasons ? filters.reasons.split(',') : [])

  const toggleReason = (r) => {
    const next = new Set(selected)
    next.has(r) ? next.delete(r) : next.add(r)
    onChange({ ...filters, reasons: [...next].join(',') })
  }

  return (
    <div className="filterbar">
      <div className="filter-row">
        <label>
          From
          <input
            type="date"
            min={min}
            max={filters.end_date || max}
            value={filters.start_date || ''}
            onChange={(e) => onChange({ ...filters, start_date: e.target.value })}
          />
        </label>
        <label>
          To
          <input
            type="date"
            min={filters.start_date || min}
            max={max}
            value={filters.end_date || ''}
            onChange={(e) => onChange({ ...filters, end_date: e.target.value })}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={filters.valid_only !== 'false'}
            onChange={(e) =>
              onChange({ ...filters, valid_only: e.target.checked ? 'true' : 'false' })
            }
          />
          Valid records only
        </label>
        <button className="ghost" onClick={onReset}>
          Reset
        </button>
      </div>
      <div className="reason-chips">
        {reasons.map((r) => (
          <button
            key={r.reason}
            className={`chip ${selected.size === 0 || selected.has(r.reason) ? 'on' : 'off'}`}
            onClick={() => toggleReason(r.reason)}
          >
            {r.reason} <span className="count">{r.count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
