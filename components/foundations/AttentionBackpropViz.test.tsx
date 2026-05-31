import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DEMO_STATE_EVENT, type DemoStateEventDetail, type DemoStateSummary } from '@/lib/demoState'
import AttentionBackpropViz from './AttentionBackpropViz'

jest.mock('next/dynamic', () => {
  return (loader: () => Promise<unknown>) => {
    const source = String(loader)
    if (source.includes('AttentionBackpropViz')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('./AttentionBackpropViz').default
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactForMock = require('react')
    return function MockDynamicComponent() {
      return ReactForMock.createElement('div', null, 'Mock attention child')
    }
  }
})

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

describe('AttentionBackpropViz gradient-credit reveal', () => {
  it('hides answer-bearing magnitudes and emits no measured state before reveal', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<AttentionBackpropViz />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))

      const text = document.body.textContent ?? ''
      expect(measuredStates(events)).toHaveLength(0)
      expect(screen.getByRole('button', { name: /Reveal gradient credit/ })).toBeDisabled()
      expect(screen.getByText('Measured credit, edge strength, and correctness are locked until reveal.')).toBeInTheDocument()
      expect(screen.getByText('dL/dQ = (dL/dS)K / sqrt(d_k)')).toBeInTheDocument()
      expect(screen.getByText('dL/dK = (dL/dS)^T Q / sqrt(d_k)')).toBeInTheDocument()
      expect(screen.getByText('dL/dW_Q = X^T(dL/dQ)')).toBeInTheDocument()
      expect(screen.getByText('dL/dW_K = X^T(dL/dK)')).toBeInTheDocument()
      expect(screen.getByText('dL/dW_V = X^T(dL/dV)')).toBeInTheDocument()
      expect(text).toContain('Key-scale stress: K vectors are larger')
      expect(text).not.toContain('Keys amplify query gradients')
      expect(text).not.toContain('W_Q updates')
      expect(text).not.toContain('dominant parameter update')
      expect(text).not.toContain('W_Q gradient magnitude')
      expect(text).not.toContain('softmax Jacobian gradient gate')
      expect(text).not.toContain('Prediction matched.')
      expect(text).not.toContain('Prediction missed.')

      const backwardWidths = Array.from(document.querySelectorAll('.edge-backward')).map((node) =>
        node.getAttribute('stroke-width')
      )
      expect(backwardWidths.length).toBeGreaterThan(0)
      expect(new Set(backwardWidths).size).toBe(1)
      expect(new Set(Array.from(document.querySelectorAll('.edge-backward')).map((node) => node.getAttribute('stroke-opacity'))).size).toBe(1)
      expect(document.querySelectorAll('.edge-softmax')).toHaveLength(0)
      const softmaxGlow = Array.from(document.querySelectorAll('.softmax-region rect')).find(
        (node) => node.getAttribute('fill') === 'url(#softmax-glow)'
      )
      expect(softmaxGlow?.getAttribute('opacity')).toBe('0.12')

      fireEvent.click(screen.getByRole('button', { name: 'W_Q' }))
      expect(screen.getByRole('button', { name: /Reveal gradient credit/ })).toBeEnabled()
      expect(measuredStates(events)).toHaveLength(0)

      fireEvent.click(screen.getByRole('button', { name: 'Forward pass' }))
      const forwardWidths = Array.from(document.querySelectorAll('.edge-forward')).map((node) =>
        node.getAttribute('stroke-width')
      )
      expect(forwardWidths.length).toBeGreaterThan(0)
      expect(new Set(forwardWidths).size).toBe(1)
      expect(new Set(Array.from(document.querySelectorAll('.edge-forward')).map((node) => node.getAttribute('stroke-opacity'))).size).toBe(1)
      expect(document.querySelectorAll('.edge-softmax')).toHaveLength(0)
    } finally {
      stop()
    }
  })

  it('reveals the key-scale W_Q crossover and emits compact measured state', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<AttentionBackpropViz />)
      fireEvent.click(screen.getByRole('button', { name: 'W_Q' }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal gradient credit/ }))

      expect(screen.getByText(/Prediction matched\./)).toBeInTheDocument()
      expect(screen.getByText(/Revealed gradient credit:/)).toBeInTheDocument()
      expect(screen.getByText(/W_Q gradient magnitude: 120%/)).toBeInTheDocument()
      expect(screen.getByText(/W_K gradient magnitude: 80%/)).toBeInTheDocument()
      expect(screen.getByText(/W_V gradient magnitude: 70%/)).toBeInTheDocument()
      expect(screen.getByText(/Softmax Jacobian gradient gate: 85%/)).toBeInTheDocument()
      expect(document.querySelectorAll('.edge-softmax')).toHaveLength(1)

      await waitFor(() => {
        expect(measuredStates(events).some((state) => state.label === 'Attention backprop gradient-credit reveal')).toBe(true)
      })

      const latest = measuredStates(events).at(-1)
      expect(latest?.summary).toContain('learner predicted W_Q')
      expect(latest?.summary).toContain('strongest hidden parameter credit is W_Q')
      expect(latest?.values).toEqual(
        expect.arrayContaining([
          'slice: attention-backprop-prediction-first-gradient-credit-reveal',
          'scenario: Key-scale stress (largeK)',
          'mode: backward',
          'held fixed: Q scale, V scale, loss seed',
          'prediction: W_Q',
          'actual strongest credit: W_Q',
          'prediction correct: yes',
          'dominant parameter update: W_Q at 120%',
          'parameter credit path: wq-q (W_Q->Q) at 120%',
          'W_Q gradient magnitude: 120%',
          'W_K gradient magnitude: 80%',
          'W_V gradient magnitude: 70%',
          'softmax Jacobian gradient gate: 85%',
          'formula witness: dL/dQ = (dL/dS)K / sqrt(d_k)',
        ])
      )
    } finally {
      stop()
    }
  })

  it('reveals W_Q after a wrong prediction', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<AttentionBackpropViz />)
      fireEvent.click(screen.getByRole('button', { name: 'W_K' }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal gradient credit/ }))

      expect(screen.getByText(/Prediction missed\. Actual: W_Q\./)).toBeInTheDocument()
      await waitFor(() => {
        expect(measuredStates(events).some((state) => state.values?.includes('prediction correct: no'))).toBe(true)
      })
      const latest = measuredStates(events).at(-1)
      expect(latest?.summary).toContain('learner predicted W_K')
      expect(latest?.values).toEqual(
        expect.arrayContaining([
          'prediction: W_K',
          'actual strongest credit: W_Q',
          'prediction correct: no',
        ])
      )
    } finally {
      stop()
    }
  })

  it('clears stale reveal and shared state when mode changes', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<AttentionBackpropViz />)
      fireEvent.click(screen.getByRole('button', { name: 'W_Q' }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal gradient credit/ }))
      expect(await screen.findByText(/Prediction matched\./)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.click(screen.getByRole('button', { name: 'Forward pass' }))

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(screen.queryByText(/Prediction matched\./)).not.toBeInTheDocument()
      expect(screen.queryByText(/W_Q gradient magnitude:/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal gradient credit/ })).toBeDisabled()
    } finally {
      stop()
    }
  })

  it('clears stale reveal when prediction changes after reveal', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<AttentionBackpropViz />)
      fireEvent.click(screen.getByRole('button', { name: 'W_Q' }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal gradient credit/ }))
      expect(await screen.findByText(/Prediction matched\./)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.click(screen.getByRole('button', { name: 'Softmax gate' }))

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(screen.queryByText(/Prediction matched\./)).not.toBeInTheDocument()
      expect(screen.queryByText(/W_Q gradient magnitude:/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal gradient credit/ })).toBeEnabled()
    } finally {
      stop()
    }
  })

  it('clears stale reveal when reset is clicked', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<AttentionBackpropViz />)
      fireEvent.click(screen.getByRole('button', { name: 'W_Q' }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal gradient credit/ }))
      expect(await screen.findByText(/Prediction matched\./)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.click(screen.getByRole('button', { name: 'Reset reveal' }))

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(screen.queryByText(/Prediction matched\./)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal gradient credit/ })).toBeDisabled()
    } finally {
      stop()
    }
  })

  it('clears shared state on unmount after reveal', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      const { unmount } = render(<AttentionBackpropViz />)
      fireEvent.click(screen.getByRole('button', { name: 'W_Q' }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal gradient credit/ }))
      expect(await screen.findByText(/Prediction matched\./)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      unmount()

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(events.some((event) => 'cleared' in event && event.conceptId === 'attention-transformers')).toBe(true)
    } finally {
      stop()
    }
  })

  it('resets local reveal and avoids re-emitting stale state when concept id changes', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      const { rerender } = render(<AttentionBackpropViz conceptId="attention-a" />)
      fireEvent.click(screen.getByRole('button', { name: 'W_Q' }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal gradient credit/ }))
      expect(await screen.findByText(/Prediction matched\./)).toBeInTheDocument()

      const emittedBefore = measuredStates(events).filter((event) => event.conceptId === 'attention-b').length
      rerender(<AttentionBackpropViz conceptId="attention-b" />)

      await waitFor(() => {
        expect(screen.queryByText(/Prediction matched\./)).not.toBeInTheDocument()
      })
      expect(screen.getByRole('button', { name: /Reveal gradient credit/ })).toBeDisabled()
      expect(events.some((event) => 'cleared' in event && event.conceptId === 'attention-a')).toBe(true)
      expect(events.some((event) => 'cleared' in event && event.conceptId === 'attention-b')).toBe(true)
      expect(measuredStates(events).filter((event) => event.conceptId === 'attention-b')).toHaveLength(emittedBefore)
    } finally {
      stop()
    }
  })

  it('clears the Backprop child reveal when the parent attention tab unmounts and remounts it', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AttentionTransformersViz = require('../../content/domains/attention-transformers/concepts/attention-transformers/viz').default
    const { events, stop } = collectDemoEvents()

    try {
      render(<AttentionTransformersViz />)
      fireEvent.click(screen.getByRole('tab', { name: 'Backprop' }))
      fireEvent.click(screen.getByRole('button', { name: 'Gradient credit' }))
      fireEvent.click(screen.getByRole('button', { name: 'Reveal mechanism' }))
      fireEvent.click(await screen.findByRole('button', { name: 'W_Q' }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal gradient credit/ }))
      expect(await screen.findByText(/Prediction matched\./)).toBeInTheDocument()

      fireEvent.click(screen.getByRole('tab', { name: 'Geometry' }))
      await waitFor(() => {
        expect(events.some((event) => 'cleared' in event && event.conceptId === 'attention-transformers')).toBe(true)
      })

      fireEvent.click(screen.getByRole('tab', { name: 'Backprop' }))
      fireEvent.click(screen.getByRole('button', { name: 'Gradient credit' }))
      fireEvent.click(screen.getByRole('button', { name: 'Reveal mechanism' }))

      expect(await screen.findByText('Measured credit, edge strength, and correctness are locked until reveal.')).toBeInTheDocument()
      expect(screen.queryByText(/Prediction matched\./)).not.toBeInTheDocument()
      expect(screen.queryByText(/W_Q gradient magnitude:/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal gradient credit/ })).toBeDisabled()
    } finally {
      stop()
    }
  })
})
