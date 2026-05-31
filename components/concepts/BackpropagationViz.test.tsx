import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'fs'
import path from 'path'
import { DEMO_STATE_EVENT, type DemoStateEventDetail, type DemoStateSummary } from '@/lib/demoState'
import BackpropagationViz, {
  BACKPROP_PRESETS,
  classifyHiddenSignal,
  getHiddenSignalDiagnostics,
} from '@/content/domains/calculus/concepts/backpropagation/viz'

describe('BackpropagationViz hidden learning-signal reveal', () => {
  it('classifies hidden row signal from first-layer row-gradient norms', () => {
    expect(getHiddenSignalDiagnostics(BACKPROP_PRESETS.normal.model).actual).toBe('h1')
    expect(getHiddenSignalDiagnostics(BACKPROP_PRESETS.large_lr.model).actual).toBe('h1')
    expect(getHiddenSignalDiagnostics(BACKPROP_PRESETS.saturated.model).actual).toBe('no-clear-signal')
    expect(classifyHiddenSignal({ delta1: [1, 0.96, 0.1], x: [1, 0] })).toBe('no-clear-signal')
  })

  it('shows forward state but hides backward/update values before reveal', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<BackpropagationViz />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))

      const text = document.body.textContent ?? ''
      expect(observed).toHaveLength(0)
      expect(screen.getByText('Case A')).toBeInTheDocument()
      expect(screen.getByText('Case B')).toBeInTheDocument()
      expect(screen.getByText('Case C')).toBeInTheDocument()
      expect(text).toContain('input x')
      expect(text).toContain('[1.00, 2.00]')
      expect(text).toContain('0.619')
      expect(text).toContain('-0.112 -> 1.000')
      expect(text).toContain('W2=[0.30, -0.20, 0.10]')
      expect(screen.getByRole('button', { name: /Reveal hidden learning signal/ })).toBeDisabled()
      expect(screen.getByRole('button', { name: /Backward locked/ })).toBeDisabled()
      expect(screen.getByRole('button', { name: /Update locked/ })).toBeDisabled()
      expect(text).not.toContain('bar yhat=')
      expect(text).not.toContain('bar z1=')
      expect(text).not.toContain('delta2=')
      expect(text).not.toContain('delta1=')
      expect(text).not.toContain('row norms=')
      expect(text).not.toContain('loss after update')
      expect(text).not.toContain('loss-after-update')
      expect(text).not.toContain('loss after')
      expect(text).not.toContain('loss decreases')
      expect(text).not.toContain('loss increases')
      expect(text).not.toContain('dominant gradient')

      fireEvent.click(screen.getByRole('button', { name: /Hidden unit H1/ }))
      expect(screen.getByRole('button', { name: /Reveal hidden learning signal/ })).toBeEnabled()
      expect(observed).toHaveLength(0)
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('reveals Case A H1 signal and emits compact measured state', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<BackpropagationViz />)
      fireEvent.click(screen.getByRole('button', { name: /Hidden unit H1/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal hidden learning signal/ }))

      expect(screen.getByText(/Correct\./)).toBeInTheDocument()
      expect(screen.getByText(/Actual: Hidden unit H1/)).toBeInTheDocument()
      expect(document.body.textContent ?? '').toContain('delta2')
      expect(document.body.textContent ?? '').toContain('delta1')
      expect(document.body.textContent ?? '').toContain('[0.75, 0.21, 0.25]')
      expect(screen.getByRole('button', { name: /^Backward$/ })).toBeEnabled()
      expect(screen.getByRole('button', { name: /^Update$/ })).toBeEnabled()

      await waitFor(() => {
        expect(observed.some((state) => state.conceptId === 'backpropagation')).toBe(true)
      })

      const latest = observed[observed.length - 1]
      expect(latest.label).toBe('Prediction-first hidden learning-signal reveal')
      expect(latest.summary).toContain('Predicted h1; actual h1')
      expect(latest.values).toEqual(
        expect.arrayContaining([
          'prediction: h1',
          'actual hidden signal: h1',
          'prediction correct: yes',
          'learning rate eta: 0.150',
          'loss before: 0.619',
          'loss after update: 0.280',
          'first-layer row gradient norms: [0.75, 0.21, 0.25]',
          'update effect: loss decreases',
          'visible backward/update layer: revealed',
        ])
      )
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('keeps Case C neutral until reveal, then exposes no clear usable hidden signal', async () => {
    render(<BackpropagationViz />)

    fireEvent.change(screen.getByLabelText('Preset'), { target: { value: 'saturated' } })
    expect(document.body.textContent ?? '').not.toContain('saturated hidden gates')
    expect(document.body.textContent ?? '').not.toContain('row norms=')

    fireEvent.click(screen.getByRole('button', { name: /No clear usable signal/ }))
    fireEvent.click(screen.getByRole('button', { name: /Reveal hidden learning signal/ }))

    expect(screen.getByText(/Correct\./)).toBeInTheDocument()
    expect(screen.getByText(/Actual: No clear usable signal/)).toBeInTheDocument()
    expect(document.body.textContent ?? '').toContain('no clear usable hidden signal')
  })

  it('clears stale reveal and shared state when learning rate changes', async () => {
    const events: DemoStateEventDetail[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail) events.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<BackpropagationViz />)
      fireEvent.click(screen.getByRole('button', { name: /Hidden unit H1/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal hidden learning signal/ }))
      expect(await screen.findByText(/Correct\./)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.change(screen.getByLabelText('Learning rate eta'), { target: { value: '0.2' } })

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(screen.queryByText(/Correct\./)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal hidden learning signal/ })).toBeDisabled()
      expect(document.body.textContent ?? '').not.toContain('row norms=')
      expect(document.body.textContent ?? '').not.toContain('loss after update')
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('keeps Interactive Demo copy prediction-first and non-spoiling', () => {
    const mdx = readFileSync(
      path.join(process.cwd(), 'content/domains/calculus/concepts/backpropagation/content.mdx'),
      'utf8'
    )
    const beforeDemo = mdx.split('## Interactive Demo')[0]
    const interactiveDemo = mdx.split('## Interactive Demo')[1]

    expect(interactiveDemo).toBeTruthy()
    expect(interactiveDemo).toContain('predict which hidden unit will carry the strongest usable learning signal')
    expect(interactiveDemo).toContain('Use Case A, Case B, and Case C as neutral graph states')
    expect(beforeDemo).not.toContain('x = np.array([[1.0], [2.0]])')
    expect(beforeDemo).not.toContain('[0.2, -0.1]')
    expect(beforeDemo).not.toContain('[0.4,  0.3]')
    expect(beforeDemo).not.toContain('[-0.5, 0.2]')
    expect(interactiveDemo).not.toContain('large-learning-rate preset')
    expect(interactiveDemo).not.toContain('saturated tanh')
    expect(interactiveDemo).not.toContain('loss can increase')
  })
})
