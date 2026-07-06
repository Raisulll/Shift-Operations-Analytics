import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FilterBar from './FilterBar'

const reasons = [
  { reason: 'Breakdown', count: 3, group: 'Equipment Failure' },
  { reason: 'Machine Jam', count: 2, group: 'Equipment Failure' },
  { reason: 'Training', count: 1, group: 'Training' },
]
const baseFilters = { start_date: '', end_date: '', reasons: '', valid_only: 'true' }
const noop = () => {}

describe('FilterBar', () => {
  it('shows one chip per reason in reason mode', () => {
    render(
      <FilterBar
        reasons={reasons}
        filters={baseFilters}
        dateRange={{}}
        dimension="reason"
        onChange={noop}
        onReset={noop}
      />,
    )
    expect(screen.getByRole('button', { name: /Breakdown/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Machine Jam/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Training/ })).toBeInTheDocument()
  })

  it('collapses reasons into group chips in group mode', () => {
    render(
      <FilterBar
        reasons={reasons}
        filters={baseFilters}
        dateRange={{}}
        dimension="group"
        onChange={noop}
        onReset={noop}
      />,
    )
    // The two Equipment-Failure reasons collapse into one group chip; the
    // individual "Machine Jam" reason chip is no longer shown on its own.
    expect(screen.getByRole('button', { name: /Equipment Failure/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Machine Jam/ })).toBeNull()
  })

  it('toggling a group selects all of its member reasons', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        reasons={reasons}
        filters={baseFilters}
        dateRange={{}}
        dimension="group"
        onChange={onChange}
        onReset={noop}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Equipment Failure/ }))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ reasons: 'Breakdown,Machine Jam' }),
    )
  })
})
