/**
 * Smoke tests for SelfAttentionViz component
 * Verifies component renders without crashing
 */

import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DEMO_STATE_EVENT, type DemoStateEventDetail, type DemoStateSummary } from '@/lib/demoState'

// SelfAttentionViz imports `d3` (ESM). Jest in this repo doesn't transform ESM
// dependencies in node_modules, so we provide a minimal mock that supports the
// selection chain used by the component.
jest.mock('d3', () => {
  type SelectionStub = {
    attr: (...args: unknown[]) => SelectionStub
    style: (...args: unknown[]) => SelectionStub
    selectAll: (...args: unknown[]) => SelectionStub
    remove: (...args: unknown[]) => SelectionStub
    append: (...args: unknown[]) => SelectionStub
    text: (...args: unknown[]) => SelectionStub
    data: (...args: unknown[]) => SelectionStub
    join: (...args: unknown[]) => SelectionStub
    on: (...args: unknown[]) => SelectionStub
    call: (...args: unknown[]) => SelectionStub
    transition: (...args: unknown[]) => SelectionStub
    duration: (...args: unknown[]) => SelectionStub
  }

  const makeSelection = () => {
    const selection = {} as SelectionStub
    selection.attr = () => selection
    selection.style = () => selection
    selection.selectAll = () => selection
    selection.remove = () => selection
    selection.append = () => selection
    selection.text = () => selection
    selection.data = () => selection
    selection.join = () => selection
    selection.on = () => selection
    selection.call = () => selection
    selection.transition = () => selection
    selection.duration = () => selection
    return selection
  }

  const scaleLinear = () => {
    let rangeVals: [string, string] = ['#000000', '#ffffff']
    type ScaleLinearStub = ((x: number) => string) & {
      domain: (...args: unknown[]) => ScaleLinearStub
      range: (r: [string, string]) => ScaleLinearStub
    }

    const scale = ((_: number) => rangeVals[0]) as ScaleLinearStub
    scale.domain = () => scale
    scale.range = (r) => {
      rangeVals = r
      return scale
    }
    return scale
  }

  const max = <T,>(arr: T[], accessor?: (d: T) => number): number | undefined => {
    if (!arr?.length) return undefined
    let best = -Infinity
    for (const d of arr) {
      const v = accessor ? accessor(d) : d
      if (typeof v === 'number' && v > best) best = v
    }
    return best === -Infinity ? undefined : best
  }

  return {
    select: () => makeSelection(),
    scaleLinear,
    max,
  }
})

describe('SelfAttentionViz', () => {
  it('renders without crashing', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SelfAttentionViz = require('./SelfAttentionViz').default
    expect(() => render(<SelfAttentionViz />)).not.toThrow()
  })

  it('hides row-level outputs and emits no measured state before reveal', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SelfAttentionViz = require('./SelfAttentionViz').default
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<SelfAttentionViz />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))

      const text = document.body.textContent ?? ''
      expect(observed).toHaveLength(0)
      expect(screen.getByRole('button', { name: /Reveal value mixture/ })).toBeDisabled()
      expect(screen.getByText('Distribution readout locked until reveal.')).toBeInTheDocument()
      expect(screen.getByText('Derived rows and the final mixture are locked until reveal.')).toBeInTheDocument()
      expect(text).not.toContain('Entropy:')
      expect(text).not.toContain('Attention Focus')
      expect(text).not.toContain('Top attention token:')
      expect(text).not.toContain('Actual contributor:')
      expect(text).not.toContain('Value contribution norms:')
      expect(text).not.toContain('Value mixture O_i:')
      expect(text).not.toContain('Probability row sum:')

      fireEvent.click(screen.getByRole('button', { name: /T5 · mat/ }))
      expect(screen.getByRole('button', { name: /Reveal value mixture/ })).toBeEnabled()
      expect(observed).toHaveLength(0)
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('reveals the default value contributor and emits compact measured state', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SelfAttentionViz = require('./SelfAttentionViz').default
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<SelfAttentionViz />)
      fireEvent.click(screen.getByRole('button', { name: /T5 · mat/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal value mixture/ }))

      expect(screen.getByText(/Prediction matched\./)).toBeInTheDocument()
      expect(screen.getByText(/Actual contributor: T5 · mat/)).toBeInTheDocument()
      expect(screen.getByText(/Top attention token:/)).toBeInTheDocument()
      expect(screen.getByText(/Value contribution norms:/)).toBeInTheDocument()
      expect(screen.getByText(/Value mixture O_i:/)).toBeInTheDocument()
      expect(screen.getByText(/Probability row sum:/)).toBeInTheDocument()

      await waitFor(() => {
        expect(observed.some((state) => state.label === 'Self-attention value mixing reveal')).toBe(true)
      })

      const latest = observed[observed.length - 1]
      expect(latest.summary).toContain('learner predicted T5 · mat')
      expect(latest.summary).toContain('strongest weighted value contribution is T5 · mat')
      expect(latest.summary).toContain('top attention token is')
      expect(latest.values).toEqual(
        expect.arrayContaining([
          'query token: T1 · cat (row 1)',
          'temperature T: 1.00',
          'prediction: T5 · mat',
          'actual value contributor: T5 · mat',
          'prediction correct: yes',
          'reveal state: value mixing shown',
        ])
      )
      expect(latest.values?.some((value) => value.startsWith('top attention token: '))).toBe(true)
      expect(latest.values?.some((value) => value.startsWith('attention entropy: '))).toBe(true)
      expect(latest.values?.some((value) => value.startsWith('score row: ['))).toBe(true)
      expect(latest.values?.some((value) => value.startsWith('attention row: ['))).toBe(true)
      expect(latest.values?.some((value) => value.startsWith('value contribution norms: ['))).toBe(true)
      expect(latest.values?.some((value) => value.startsWith('value mixture O_i: ['))).toBe(true)
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('clears stale reveal and shared state when temperature changes', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SelfAttentionViz = require('./SelfAttentionViz').default
    const events: DemoStateEventDetail[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail) events.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<SelfAttentionViz />)
      fireEvent.click(screen.getByRole('button', { name: /T5 · mat/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal value mixture/ }))
      expect(await screen.findByText(/Prediction matched\./)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.change(screen.getByLabelText('Softmax temperature'), { target: { value: '1.5' } })

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(screen.queryByText(/Prediction matched\./)).not.toBeInTheDocument()
      expect(screen.queryByText(/Actual contributor:/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal value mixture/ })).toBeDisabled()
      expect(document.body.textContent ?? '').not.toContain('Entropy:')
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('clears stale reveal and shared state when active query changes', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SelfAttentionViz = require('./SelfAttentionViz').default
    const events: DemoStateEventDetail[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail) events.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<SelfAttentionViz />)
      fireEvent.click(screen.getByRole('button', { name: /T5 · mat/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal value mixture/ }))
      expect(await screen.findByText(/Prediction matched\./)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.focus(screen.getByRole('button', { name: /^sat$/ }))

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(screen.getByText(/For selected query T2 · sat/)).toBeInTheDocument()
      expect(screen.queryByText(/Prediction matched\./)).not.toBeInTheDocument()
      expect(screen.queryByText(/Actual contributor:/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal value mixture/ })).toBeDisabled()
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('clears stale reveal when prediction changes after reveal', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SelfAttentionViz = require('./SelfAttentionViz').default
    const events: DemoStateEventDetail[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail) events.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<SelfAttentionViz />)
      fireEvent.click(screen.getByRole('button', { name: /T5 · mat/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal value mixture/ }))
      expect(await screen.findByText(/Prediction matched\./)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.click(screen.getByRole('button', { name: /T0 · The/ }))

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(screen.queryByText(/Prediction matched\./)).not.toBeInTheDocument()
      expect(screen.queryByText(/Actual contributor:/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal value mixture/ })).toBeEnabled()
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('clears stale reveal when reset is clicked', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SelfAttentionViz = require('./SelfAttentionViz').default
    const events: DemoStateEventDetail[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail) events.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<SelfAttentionViz />)
      fireEvent.click(screen.getByRole('button', { name: /T5 · mat/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal value mixture/ }))
      expect(await screen.findByText(/Prediction matched\./)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.click(screen.getByRole('button', { name: /Reset reveal/ }))

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(screen.queryByText(/Prediction matched\./)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal value mixture/ })).toBeDisabled()
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('clears shared state on unmount after reveal', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SelfAttentionViz = require('./SelfAttentionViz').default
    const events: DemoStateEventDetail[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail) events.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      const { unmount } = render(<SelfAttentionViz />)
      fireEvent.click(screen.getByRole('button', { name: /T5 · mat/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal value mixture/ }))
      expect(await screen.findByText(/Prediction matched\./)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      unmount()

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('resets local reveal and avoids re-emitting stale state when concept id changes', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SelfAttentionViz = require('./SelfAttentionViz').default
    const events: DemoStateEventDetail[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail) events.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      const { rerender } = render(<SelfAttentionViz conceptId="attention-a" />)
      fireEvent.click(screen.getByRole('button', { name: /T5 · mat/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal value mixture/ }))
      expect(await screen.findByText(/Prediction matched\./)).toBeInTheDocument()

      const emittedBefore = events.filter(
        (event) => !('cleared' in event) && event.conceptId === 'attention-b'
      ).length
      rerender(<SelfAttentionViz conceptId="attention-b" />)

      await waitFor(() => {
        expect(screen.queryByText(/Prediction matched\./)).not.toBeInTheDocument()
      })
      expect(screen.getByRole('button', { name: /Reveal value mixture/ })).toBeDisabled()
      expect(events.some((event) => 'cleared' in event && event.conceptId === 'attention-a')).toBe(true)
      expect(events.some((event) => 'cleared' in event && event.conceptId === 'attention-b')).toBe(true)
      expect(
        events.filter((event) => !('cleared' in event) && event.conceptId === 'attention-b')
      ).toHaveLength(emittedBefore)
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('classifies weighted value contribution by alpha times V norm, including ties', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getValueContributionWinners } = require('./SelfAttentionViz')

    expect(getValueContributionWinners([0.2, 0.8], [[3, 0], [1, 0]]).expectedAnswer).toBe(1)

    const tie = getValueContributionWinners([0.5, 0.5], [[1, 0], [1.01, 0]])
    expect(tie.expectedAnswer).toBe('tie')
    expect(tie.winnerIndices).toEqual([0, 1])
  })
})
