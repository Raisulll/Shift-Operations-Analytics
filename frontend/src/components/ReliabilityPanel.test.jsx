import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ReliabilityPanel from './ReliabilityPanel'

describe('ReliabilityPanel', () => {
  it('renders MTBF / MTTR / availability tiles from data', () => {
    const data = {
      failure_count: 2,
      total_hours: 10,
      uptime_hours: 8,
      downtime_hours: 2,
      mtbf_hours: 4,
      mttr_hours: 1,
      availability_percent: 80,
      failure_reasons: ['Breakdown'],
    }
    render(<ReliabilityPanel data={data} />)
    expect(screen.getByText('4 h')).toBeInTheDocument() // MTBF
    expect(screen.getByText('1 h')).toBeInTheDocument() // MTTR
    expect(screen.getByText('80%')).toBeInTheDocument() // availability
  })

  it('shows a friendly empty state when there are no failures', () => {
    render(
      <ReliabilityPanel
        data={{
          failure_count: 0,
          total_hours: 5,
          uptime_hours: 5,
          downtime_hours: 0,
          mtbf_hours: null,
          mttr_hours: null,
          availability_percent: 100,
          failure_reasons: [],
        }}
      />,
    )
    expect(screen.getByText(/no unplanned failures/i)).toBeInTheDocument()
  })
})
