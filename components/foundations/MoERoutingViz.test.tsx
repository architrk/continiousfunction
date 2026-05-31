import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DEMO_STATE_EVENT, type DemoStateEventDetail, type DemoStateSummary } from '@/lib/demoState'
import MoERoutingViz from './MoERoutingViz'

jest.mock('gsap', () => ({
  gsap: {
    set: jest.fn(),
    to: jest.fn(),
    timeline: () => {
      const timeline = {
        set: jest.fn(),
        to: jest.fn(),
        kill: jest.fn(),
      }
      timeline.set.mockReturnValue(timeline)
      timeline.to.mockReturnValue(timeline)
      return timeline
    },
  },
}))

function collectDemoEvents() {
  const events: DemoStateEventDetail[] = []
  const handleDemoState = (event: Event) => {
    const detail = (event as CustomEvent<DemoStateEventDetail>).detail
    if (detail) events.push(detail)
  }
  window.addEventListener(DEMO_STATE_EVENT, handleDemoState)
  return {
    events,
    stop: () => window.removeEventListener(DEMO_STATE_EVENT, handleDemoState),
  }
}

function measuredStates(events: DemoStateEventDetail[]): DemoStateSummary[] {
  return events.filter((event): event is DemoStateSummary => !('cleared' in event))
}

describe('MoERoutingViz capacity-drop notebook reveal', () => {
  it('hides capacity outcomes and emits no measured state before reveal', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<MoERoutingViz chrome="notebook" conceptId="mixture-of-experts" />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))

      expect(measuredStates(events)).toHaveLength(0)
      expect(screen.getByRole('button', { name: /Reveal capacity outcome/ })).toBeDisabled()
      expect(screen.getByText('Result readout hidden until reveal.')).toBeInTheDocument()
      expect(screen.queryByText('Token type')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Route a sample token/ })).not.toBeInTheDocument()
      expect(screen.queryByText('Softmax concentration:')).not.toBeInTheDocument()
      expect(screen.queryByText('Expert load')).not.toBeInTheDocument()
      expect(screen.queryByText('Total parameters do not equal activated compute')).not.toBeInTheDocument()
      expect(screen.queryByText(/Served assignments:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Dropped assignments:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Overflow experts:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Prediction matched/)).not.toBeInTheDocument()
      expect(screen.getAllByText('slot').length).toBeGreaterThanOrEqual(16)

      fireEvent.click(screen.getByRole('button', { name: /Overloaded expert drops\/overflows assignments/ }))
      expect(screen.getByRole('button', { name: /Reveal capacity outcome/ })).toBeEnabled()
      expect(measuredStates(events)).toHaveLength(0)
    } finally {
      stop()
    }
  })

  it('reveals the default overload path and emits compact measured state', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<MoERoutingViz chrome="notebook" conceptId="mixture-of-experts" />)
      fireEvent.click(screen.getByRole('button', { name: /Overloaded expert drops\/overflows assignments/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal capacity outcome/ }))

      expect(screen.getByText(/Prediction matched\./)).toBeInTheDocument()
      expect(screen.getByText(/Served assignments:/)).toBeInTheDocument()
      expect(screen.getByText(/Dropped assignments:/)).toBeInTheDocument()
      expect(screen.getByText(/Overflow experts: E0, E5/)).toBeInTheDocument()

      await waitFor(() => {
        expect(measuredStates(events).some((state) => state.label === 'MoE capacity drop reveal')).toBe(true)
      })

      const latest = measuredStates(events).at(-1)
      expect(latest?.summary).toContain('revealed capacity overflow')
      expect(latest?.values).toEqual(
        expect.arrayContaining([
          'slice: mixture-of-experts-capacity-drop-reveal',
          'prediction: Overloaded expert drops/overflows assignments',
          'actual: capacity-overflow',
          'prediction correct: yes',
          'batch preset: Batch A',
          'token count: 6',
          'expert count: 8',
          'topK: 2',
          'capacity per expert: 2',
          'overflowExpertIds: E0, E5',
          'overflowRate: 25.0%',
          'slotUtilization: 56.3%',
        ])
      )
      expect(latest?.values?.some((value) => value.startsWith('topKAssignments: T0:E0,E5'))).toBe(true)
      expect(latest?.values?.some((value) => value.startsWith('servedAssignments: T0:E0'))).toBe(true)
      expect(latest?.values?.some((value) => value.includes('droppedAssignments: T2:E0; T2:E5; T4:E5'))).toBe(true)
      expect(latest?.values?.some((value) => value.includes('expertLoads: E0:2/2'))).toBe(true)
    } finally {
      stop()
    }
  })

  it('reveals capacity overflow after a wrong all-served prediction', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<MoERoutingViz chrome="notebook" conceptId="mixture-of-experts" />)
      fireEvent.click(screen.getByRole('button', { name: /All top-2 selections are served/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal capacity outcome/ }))

      expect(screen.getByText(/Prediction missed\. Actual: capacity overflow\./)).toBeInTheDocument()
      await waitFor(() => {
        expect(measuredStates(events).some((state) => state.values?.includes('prediction correct: no'))).toBe(true)
      })
      const latest = measuredStates(events).at(-1)
      expect(latest?.values).toEqual(
        expect.arrayContaining([
          'prediction: All top-2 selections are served',
          'actual: capacity-overflow',
          'prediction correct: no',
        ])
      )
    } finally {
      stop()
    }
  })

  it('covers the all-served preset without hard-coding overflow', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<MoERoutingViz chrome="notebook" conceptId="mixture-of-experts" />)
      fireEvent.click(screen.getByRole('button', { name: 'Batch B' }))
      fireEvent.click(screen.getByRole('button', { name: /All top-2 selections are served/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal capacity outcome/ }))

      expect(screen.getByText(/Prediction matched\./)).toBeInTheDocument()
      expect(screen.getByText('Dropped assignments: none')).toBeInTheDocument()
      await waitFor(() => {
        expect(measuredStates(events).some((state) => state.values?.includes('actual: all-served'))).toBe(true)
      })

      const latest = measuredStates(events).at(-1)
      expect(latest?.values).toEqual(
        expect.arrayContaining([
          'batch preset: Batch B',
          'actual: all-served',
          'prediction correct: yes',
          'droppedAssignments: none',
          'overflowExpertIds: none',
        ])
      )
    } finally {
      stop()
    }
  })

  it('clears stale revealed state when capacity changes', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<MoERoutingViz chrome="notebook" conceptId="mixture-of-experts" />)
      fireEvent.click(screen.getByRole('button', { name: /Overloaded expert drops\/overflows assignments/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal capacity outcome/ }))
      expect(await screen.findByText(/Prediction matched\./)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.click(screen.getByRole('button', { name: '3' }))

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(screen.queryByText(/Prediction matched\./)).not.toBeInTheDocument()
      expect(screen.queryByText(/Served assignments:/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal capacity outcome/ })).toBeDisabled()
    } finally {
      stop()
    }
  })

  it('clears stale revealed state when the batch preset changes', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<MoERoutingViz chrome="notebook" conceptId="mixture-of-experts" />)
      fireEvent.click(screen.getByRole('button', { name: /Overloaded expert drops\/overflows assignments/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal capacity outcome/ }))
      expect(await screen.findByText(/Prediction matched\./)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.click(screen.getByRole('button', { name: 'Batch C' }))

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(screen.queryByText(/Prediction matched\./)).not.toBeInTheDocument()
      expect(screen.queryByText(/Dropped assignments:/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal capacity outcome/ })).toBeDisabled()
    } finally {
      stop()
    }
  })
})
