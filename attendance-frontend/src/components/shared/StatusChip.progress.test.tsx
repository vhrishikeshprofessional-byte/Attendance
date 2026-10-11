import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressBar } from './ProgressBar'
import { Chip, StatusChip } from './StatusChip'

describe('StatusChip', () => {
  it.each([
    ['compliant', 'Compliant'], ['non_compliant', 'Non-compliant'], ['in_progress', 'In progress'], ['not_applicable', 'N/A'],
    ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['cancelled', 'Cancelled'],
    ['open', 'Open'], ['active', 'Active'], ['inactive', 'Inactive'],
  ] as const)('%s renders "%s"', (status, label) => {
    render(<StatusChip status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
  it('accepts a custom label', () => {
    render(<StatusChip status="pending" label="Pending request" />)
    expect(screen.getByText('Pending request')).toBeInTheDocument()
  })
  it('Chip renders children', () => {
    render(<Chip>Weekend</Chip>)
    expect(screen.getByText('Weekend')).toBeInTheDocument()
  })
})

describe('ProgressBar', () => {
  it('shows numbers and a partial bar', () => {
    render(<ProgressBar label="Hours" value={12.5} max={15} unit="h" />)
    expect(screen.getByText('12.5 of 15 h')).toBeInTheDocument()
    const bar = screen.getByRole('progressbar', { name: 'Hours' })
    expect(bar).toHaveAttribute('aria-valuenow', '12.5')
    expect(bar).toHaveAttribute('aria-valuemax', '15')
  })
  it('marks met requirements and caps the bar', () => {
    render(<ProgressBar label="Days" value={5} max={3} />)
    expect(screen.getByText('5 of 3 (met)')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
  })
  it('handles "nothing required"', () => {
    render(<ProgressBar label="Days" value={0} max={0} />)
    expect(screen.getByText('Not required')).toBeInTheDocument()
  })
})
