import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DEMO_STATE_EVENT, type DemoStateEventDetail, type DemoStateSummary } from '@/lib/demoState'
import AttentionGeometryViz, { getTopKeyWinners } from './AttentionGeometryViz'

describe('AttentionGeometryViz top-key reveal', () => {
  it('hides score, weight, output, and companion state before reveal', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<AttentionGeometryViz />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))

      const text = document.body.textContent ?? ''
      expect(observed).toHaveLength(0)
      expect(screen.getByRole('button', { name: /Reveal attention distribution/ })).toBeDisabled()
      expect(screen.getByText('Distribution readout locked until reveal.')).toBeInTheDocument()
      expect(screen.getByText(/Matrix totals:/)).toBeInTheDocument()
      expect(text).not.toContain('Entropy:')
      expect(text).not.toContain('effective tokens')
      expect(text).not.toContain('top-1 weight')
      expect(text).not.toContain('Row sums (softmax)')
      expect(text).not.toContain('V(t₁) ·')
      expect(text).not.toContain('0.46')
      expect(text).not.toContain('0.24')

      const matrixSvg = screen.getByRole('img', { name: 'Attention score and weight matrix' })
      expect(Array.from(matrixSvg.querySelectorAll('.matrix-value')).map((node) => node.textContent)).toEqual(
        Array(16).fill('?')
      )
      expect(Array.from(matrixSvg.querySelectorAll('rect')).map((node) => node.getAttribute('fill-opacity'))).toEqual(
        expect.arrayContaining(['0.16', '0.08'])
      )

      const valueSvg = screen.getByRole('img', { name: 'Value vectors with output locked until reveal' })
      expect(Array.from(valueSvg.querySelectorAll('circle')).map((node) => node.getAttribute('r'))).toEqual(
        Array(4).fill('7')
      )
      expect(Array.from(valueSvg.querySelectorAll('text')).map((node) => node.textContent).join(' ')).not.toContain('·')

      fireEvent.click(screen.getByRole('button', { name: /^K\(t₁\)/ }))
      expect(screen.getByRole('button', { name: /Reveal attention distribution/ })).toBeEnabled()
      expect(observed).toHaveLength(0)
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('reveals the default top key and emits compact measured state', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<AttentionGeometryViz />)
      fireEvent.click(screen.getByRole('button', { name: /^K\(t₁\)/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal attention distribution/ }))

      expect(screen.getByText(/Correct\. Actual: K\(t₁\)/)).toBeInTheDocument()
      expect(screen.getByText(/Top attention weight 46\.5%/)).toBeInTheDocument()
      expect(screen.getByText(/Entropy:/)).toBeInTheDocument()
      expect(screen.getByText('effective tokens')).toBeInTheDocument()
      expect(screen.getByText('top-1 weight')).toBeInTheDocument()
      expect(screen.getByText(/Row sums \(softmax\):/)).toBeInTheDocument()
      expect(document.body.textContent ?? '').toContain('V(t₁) · 0.46')

      await waitFor(() => {
        expect(observed.some((state) => state.conceptId === 'attention-transformers')).toBe(true)
      })

      const latest = observed[observed.length - 1]
      expect(latest.label).toBe('Prediction-first attention top-key reveal')
      expect(latest.summary).toContain('Predicted K(t₁); actual top key K(t₁)')
      expect(latest.values).toEqual(
        expect.arrayContaining([
          'prediction: t₁',
          'actual top key: t₁',
          'prediction correct: yes',
          'active query: t₁',
          'temperature T: 1.41 (1.00x sqrt(d_k))',
          'attention row: [0.465, 0.237, 0.191, 0.107]',
          'top attention weight: 46.5%',
          'visible attention distribution: revealed',
        ])
      )
      expect(latest.values?.some((value) => value.startsWith('score row: ['))).toBe(true)
      expect(latest.values?.some((value) => value.startsWith('attention entropy: '))).toBe(true)
      expect(latest.values?.some((value) => value.startsWith('output vector: ['))).toBe(true)
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('reveals the actual top key after a wrong prediction', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<AttentionGeometryViz />)
      fireEvent.click(screen.getByRole('button', { name: /^K\(t₂\)/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal attention distribution/ }))

      expect(screen.getByText(/Not quite\. Actual: K\(t₁\)/)).toBeInTheDocument()
      await waitFor(() => {
        expect(observed.some((state) => state.values?.includes('prediction correct: no'))).toBe(true)
      })
      const latest = observed[observed.length - 1]
      expect(latest.summary).toContain('Predicted K(t₂); actual top key K(t₁)')
      expect(latest.values).toEqual(
        expect.arrayContaining([
          'prediction: t₂',
          'actual top key: t₁',
          'prediction correct: no',
        ])
      )
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('clears stale reveal and shared state when temperature changes', async () => {
    const events: DemoStateEventDetail[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail) events.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<AttentionGeometryViz />)
      fireEvent.click(screen.getByRole('button', { name: /^K\(t₁\)/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal attention distribution/ }))
      expect(await screen.findByText(/Correct\. Actual: K\(t₁\)/)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.change(screen.getByLabelText(/Scaling \/ temperature/), { target: { value: '2' } })

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(screen.queryByText(/Correct\. Actual/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal attention distribution/ })).toBeDisabled()
      expect(document.body.textContent ?? '').not.toContain('Entropy:')
      expect(document.body.textContent ?? '').not.toContain('V(t₁) ·')
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('clears stale reveal when the active query changes', async () => {
    const events: DemoStateEventDetail[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail) events.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<AttentionGeometryViz />)
      fireEvent.click(screen.getByRole('button', { name: /^K\(t₁\)/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal attention distribution/ }))
      expect(await screen.findByText(/Correct\. Actual: K\(t₁\)/)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.click(screen.getByRole('button', { name: /^t₂$/ }))

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(screen.getByText(/For active query t₂/)).toBeInTheDocument()
      expect(screen.queryByText(/Correct\. Actual/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal attention distribution/ })).toBeDisabled()
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('clears stale reveal when matrix view changes', async () => {
    const events: DemoStateEventDetail[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail) events.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<AttentionGeometryViz />)
      fireEvent.click(screen.getByRole('button', { name: /^K\(t₁\)/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal attention distribution/ }))
      expect(await screen.findByText(/Correct\. Actual: K\(t₁\)/)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.click(screen.getByRole('button', { name: 'Pre-softmax scores' }))

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(screen.queryByText(/Correct\. Actual/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal attention distribution/ })).toBeDisabled()
      expect(document.body.textContent ?? '').not.toContain('Entropy:')
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('clears stale reveal when the learner changes prediction after reveal', async () => {
    const events: DemoStateEventDetail[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail) events.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<AttentionGeometryViz />)
      fireEvent.click(screen.getByRole('button', { name: /^K\(t₁\)/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal attention distribution/ }))
      expect(await screen.findByText(/Correct\. Actual: K\(t₁\)/)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.click(screen.getByRole('button', { name: /^K\(t₂\)/ }))

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(screen.queryByText(/Correct\. Actual/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal attention distribution/ })).toBeEnabled()
      expect(document.body.textContent ?? '').not.toContain('Entropy:')
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('clears shared state on unmount after reveal', async () => {
    const events: DemoStateEventDetail[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail) events.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      const { unmount } = render(<AttentionGeometryViz />)
      fireEvent.click(screen.getByRole('button', { name: /^K\(t₁\)/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal attention distribution/ }))
      expect(await screen.findByText(/Correct\. Actual: K\(t₁\)/)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      unmount()

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('accepts top-key ties within tolerance', () => {
    expect(getTopKeyWinners([0.1, 0.4, 0.4000000005, 0.2])).toEqual([1, 2])
    expect(getTopKeyWinners([0.1, 0.4, 0.40001, 0.2])).toEqual([2])
  })
})
