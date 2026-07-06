// Filter controls that drive every query. All options are data-derived.
//
// The reason chips follow the active dimension: in "reason" mode each chip is a
// raw reason; in "group" mode each chip is a group, and toggling it toggles all
// of that group's member reasons at once. The backend always filters by raw
// reason, so a group selection just expands to its members — and reasons that
// belong to no group are their own group, so they show up unchanged.
export default function FilterBar({
  reasons,
  filters,
  dateRange,
  onChange,
  onReset,
  dimension = 'reason',
}) {
  const min = dateRange?.min || undefined
  const max = dateRange?.max || undefined
  const selected = new Set(filters.reasons ? filters.reasons.split(',') : [])

  // Build the chip list for the active dimension.
  let chips
  if (dimension === 'group') {
    const groupMap = new Map()
    for (const r of reasons) {
      const label = r.group || r.reason
      const entry = groupMap.get(label) || { members: [], count: 0 }
      entry.members.push(r.reason)
      entry.count += r.count
      groupMap.set(label, entry)
    }
    chips = [...groupMap.entries()]
      .map(([label, v]) => ({ label, members: v.members, count: v.count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  } else {
    chips = reasons.map((r) => ({ label: r.reason, members: [r.reason], count: r.count }))
  }

  // Toggle a chip: select all its members if not fully selected, else clear them.
  const toggle = (members) => {
    const next = new Set(selected)
    const allOn = members.every((m) => next.has(m))
    if (allOn) members.forEach((m) => next.delete(m))
    else members.forEach((m) => next.add(m))
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
        <span className="filter-by muted small">
          Filter by {dimension === 'group' ? 'group' : 'reason'}
        </span>
        <button className="ghost" onClick={onReset}>
          Reset
        </button>
      </div>
      <div className="reason-chips">
        {chips.map((c) => {
          const on = selected.size === 0 || c.members.every((m) => selected.has(m))
          return (
            <button
              key={c.label}
              className={`chip ${on ? 'on' : 'off'}`}
              onClick={() => toggle(c.members)}
            >
              {c.label} <span className="count">{c.count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
