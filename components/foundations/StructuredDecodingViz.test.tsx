import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  clearDemoState,
  DEMO_STATE_EVENT,
  getLatestDemoState,
  type DemoStateEventDetail,
  type DemoStateSummary,
} from '@/lib/demoState'
import StructuredDecodingViz from './StructuredDecodingViz'

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

describe('StructuredDecodingViz valid-token mask reveal', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      const message = args.map((arg) => String(arg)).join(' ')
      if (message.includes('non-boolean attribute') && message.includes('jsx')) return
      originalConsoleError(...args)
    })
  })

  afterEach(() => {
    clearDemoState('structured-decoding')
    jest.restoreAllMocks()
  })

  it('hides mask outcomes and emits no measured state before reveal', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<StructuredDecodingViz chrome="notebook" conceptId="structured-decoding" />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))

      expect(measuredStates(events)).toHaveLength(0)
      expect(getLatestDemoState('structured-decoding')).toBeNull()
      expect(screen.getByRole('button', { name: /Reveal mask/ })).toBeDisabled()
      expect(screen.getByText('mask hidden')).toBeInTheDocument()

      const text = document.body.textContent ?? ''
      expect(text).not.toContain('rejection mass')
      expect(text).not.toContain('valid continuations:')
      expect(text).not.toContain('invalid continuations masked:')
      expect(text).not.toContain('prediction correct:')
      expect(text).not.toContain('Correct:')
      expect(text).not.toContain('Not quite:')

      fireEvent.click(screen.getByRole('button', { name: /Mask changes winner/ }))
      expect(screen.getByRole('button', { name: /Reveal mask/ })).toBeEnabled()
      expect(measuredStates(events)).toHaveLength(0)
      expect(getLatestDemoState('structured-decoding')).toBeNull()
    } finally {
      stop()
    }
  })

  it('reveals the default mask-change path and emits compact measured state', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<StructuredDecodingViz chrome="notebook" conceptId="structured-decoding" />)
      fireEvent.click(screen.getByRole('button', { name: /Mask changes winner/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal mask/ }))

      await waitFor(() => {
        expect(measuredStates(events).some((state) => state.label === 'Structured decoding valid-token mask reveal')).toBe(true)
      })

      const text = document.body.textContent ?? ''
      expect(text).toContain('Correct:')
      expect(text).toContain('the mask zeros out the raw top token')
      expect(text).toContain('rejection mass')
      expect(text).toContain('Next state:')

      const latest = measuredStates(events).at(-1)
      expect(latest?.summary).toContain('Learner predicted Mask changes winner')
      expect(latest?.values).toEqual(
        expect.arrayContaining([
          'slice: structured-decoding-valid-token-mask-reveal',
          'state: q0 start',
          'prefix: empty',
          'constraint: on',
          'profile: format-confused',
          'prediction: Mask changes winner',
          'actual: mask changes winner',
          'prediction correct: yes',
          'raw top token: "DROP"',
          'raw top valid: no',
          'valid continuations: {',
          'selected token: {',
          'next parser state: q1 after {',
        ])
      )
      expect(latest?.values?.some((value) => value.startsWith('invalid continuations masked: "DROP"'))).toBe(true)
      expect(latest?.values?.some((value) => value.startsWith('valid probability mass before renormalization:'))).toBe(true)
      expect(latest?.values?.some((value) => value.startsWith('renormalized p({):'))).toBe(true)
    } finally {
      stop()
    }
  })

  it('reveals the same masked answer after a wrong raw-top prediction', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<StructuredDecodingViz chrome="notebook" conceptId="structured-decoding" />)
      fireEvent.click(screen.getByRole('button', { name: /Raw top wins/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal mask/ }))

      expect(await screen.findByText(/Not quite:/)).toBeInTheDocument()
      await waitFor(() => {
        expect(measuredStates(events).some((state) => state.values?.includes('prediction correct: no'))).toBe(true)
      })

      const latest = measuredStates(events).at(-1)
      expect(latest?.values).toEqual(
        expect.arrayContaining([
          'prediction: Raw top wins',
          'actual: mask changes winner',
          'prediction correct: no',
          'raw top token: "DROP"',
          'selected token: {',
        ])
      )
    } finally {
      stop()
    }
  })

  it('clears stale reveal and shared state when a notebook control changes', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<StructuredDecodingViz chrome="notebook" conceptId="structured-decoding" />)
      fireEvent.click(screen.getByRole('button', { name: /Mask changes winner/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal mask/ }))
      expect(await screen.findByText(/Correct:/)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.change(screen.getByLabelText('model profile'), { target: { value: 'schema-friendly' } })

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(getLatestDemoState('structured-decoding')).toBeNull()
      expect(screen.queryByText(/Correct:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/rejection mass/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal mask/ })).toBeDisabled()
    } finally {
      stop()
    }
  })

  it('clears stale shared state when a revealed prediction is changed', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<StructuredDecodingViz chrome="notebook" conceptId="structured-decoding" />)
      fireEvent.click(screen.getByRole('button', { name: /Mask changes winner/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal mask/ }))

      await waitFor(() => {
        expect(getLatestDemoState('structured-decoding')).not.toBeNull()
      })
      expect(await screen.findByText(/Correct:/)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.click(screen.getByRole('button', { name: /Raw top wins/ }))

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(getLatestDemoState('structured-decoding')).toBeNull()
      expect(screen.queryByText(/Correct:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/rejection mass/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal mask/ })).toBeEnabled()
      expect(measuredStates(events).at(-1)?.values).toEqual(
        expect.arrayContaining([
          'selected token: {',
          'prediction correct: yes',
        ])
      )
    } finally {
      stop()
    }
  })

  it('does not claim a selected token from a dead parser state', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<StructuredDecodingViz chrome="notebook" conceptId="structured-decoding" />)
      fireEvent.change(screen.getByLabelText('schema mask'), { target: { value: 'off' } })
      fireEvent.click(screen.getByRole('button', { name: /Raw top wins/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal mask/ }))
      fireEvent.click(screen.getByRole('button', { name: /Emit revealed token/ }))

      expect(screen.getByRole('button', { name: /Reveal mask/ })).toBeDisabled()
      fireEvent.click(screen.getByRole('button', { name: /No valid token/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal mask/ }))

      await waitFor(() => {
        expect(measuredStates(events).some((state) => state.values?.includes('state: dead'))).toBe(true)
      })

      expect(screen.getByRole('button', { name: /Emit revealed token/ })).toBeDisabled()
      expect(screen.getByRole('button', { name: /Run to EOS/ })).toBeDisabled()
      const latest = measuredStates(events).at(-1)
      expect(latest?.values).toEqual(
        expect.arrayContaining([
          'state: dead',
          'prediction: No valid token',
          'actual: no valid token',
          'prediction correct: yes',
          'selected token: none',
          'next parser state: none',
          'invalid prefix: yes',
        ])
      )
      expect(latest?.values).not.toEqual(expect.arrayContaining(['selected token: {']))
    } finally {
      stop()
    }
  })
})
