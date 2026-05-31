import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'fs'
import path from 'path'
import { DEMO_STATE_EVENT, type DemoStateEventDetail, type DemoStateSummary } from '@/lib/demoState'
import ComputationGraphsViz, { classifyAccumulatorRelation } from '@/content/domains/calculus/concepts/computation-graphs/viz'

describe('ComputationGraphsViz reused-node sensitivity reveal', () => {
  it('classifies the hidden sine-path relation against the direct baseline', () => {
    expect(classifyAccumulatorRelation(Math.cos(6))).toBe('higher')
    expect(classifyAccumulatorRelation(Math.cos(1.57 * 2))).toBe('lower')
    expect(classifyAccumulatorRelation(0.01)).toBe('nearly-equal')
  })

  it('shows forward values but hides backward accumulator state before reveal', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<ComputationGraphsViz />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))

      const text = document.body.textContent ?? ''
      expect(observed).toHaveLength(0)
      expect(text).toContain('c=5.721')
      expect(text).toContain('a=6.000')
      expect(text).toContain('b=-0.279')
      expect(text).toContain('direct dc/da=1.000')
      expect(screen.getByRole('button', { name: /Reveal reused-node sensitivity/ })).toBeDisabled()
      expect(screen.getByRole('button', { name: /Backward locked/ })).toBeDisabled()
      expect(text).not.toContain('cos(a)')
      expect(text).not.toContain('bar a = 1.000 +')
      expect(text).not.toContain('bar x=')
      expect(text).not.toContain('bar y=')
      expect(text).not.toContain('bar x and bar y')
      expect(text).not.toContain('paths reinforce')
      expect(text).not.toContain('near cancellation')

      fireEvent.click(screen.getByRole('button', { name: /Higher than direct/ }))
      expect(screen.getByRole('button', { name: /Reveal reused-node sensitivity/ })).toBeEnabled()
      expect(observed).toHaveLength(0)
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('reveals the default higher-than-direct relation and emits measured state', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<ComputationGraphsViz />)
      fireEvent.click(screen.getByRole('button', { name: /Higher than direct/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal reused-node sensitivity/ }))

      expect(screen.getByText(/Correct\./)).toBeInTheDocument()
      expect(screen.getByText(/Actual: Higher than direct/)).toBeInTheDocument()
      expect(document.body.textContent ?? '').toContain('bar a = 1.000 + 0.960 = 1.960')
      expect(screen.getByRole('button', { name: /^Backward$/ })).toBeEnabled()

      await waitFor(() => {
        expect(observed.some((state) => state.conceptId === 'computation-graphs')).toBe(true)
      })

      const latest = observed[observed.length - 1]
      expect(latest.label).toBe('Prediction-first reused-node sensitivity reveal')
      expect(latest.summary).toContain('Learner predicted higher; actual higher')
      expect(latest.values).toEqual(
        expect.arrayContaining([
          'prediction: higher',
          'actual relation: higher',
          'prediction correct: yes',
          'direct contribution to a: 1.000',
          'sine-path contribution to a: 0.960',
          'accumulated bar a: 1.960',
          'bar x: 5.881',
          'bar y: 3.920',
          'accumulation status: paths reinforce',
        ])
      )
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('keeps Case B neutral until reveal, then exposes the near-cancellation lower relation', async () => {
    render(<ComputationGraphsViz />)

    fireEvent.click(screen.getByRole('button', { name: /^Case B$/ }))
    expect(document.body.textContent ?? '').not.toContain('near cancellation')
    expect(document.body.textContent ?? '').not.toContain('bar a = 1.000 +')

    fireEvent.click(screen.getByRole('button', { name: /Lower than direct/ }))
    fireEvent.click(screen.getByRole('button', { name: /Reveal reused-node sensitivity/ }))

    expect(screen.getByText(/Correct\./)).toBeInTheDocument()
    expect(screen.getByText(/Actual: Lower than direct/)).toBeInTheDocument()
    expect(document.body.textContent ?? '').toContain('bar a = 1.000 + -1.000 = 0.000')
    expect(document.body.textContent ?? '').toContain('near cancellation')
  })

  it('clears stale reveal and shared state when x changes', async () => {
    const events: DemoStateEventDetail[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail) events.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<ComputationGraphsViz />)
      fireEvent.click(screen.getByRole('button', { name: /Higher than direct/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal reused-node sensitivity/ }))
      expect(await screen.findByText(/Correct\./)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.change(screen.getByLabelText('x'), { target: { value: '1.4' } })

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(screen.queryByText(/Correct\./)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal reused-node sensitivity/ })).toBeDisabled()
      expect(document.body.textContent ?? '').not.toContain('bar a = 1.000 +')
      expect(document.body.textContent ?? '').not.toContain('bar x=')
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('keeps Interactive Demo copy prediction-first and neutral', () => {
    const mdx = readFileSync(
      path.join(process.cwd(), 'content/domains/calculus/concepts/computation-graphs/content.mdx'),
      'utf8'
    )
    const interactiveDemo = mdx.split('## Interactive Demo')[1]
    const beforeDemo = mdx.split('## Interactive Demo')[0]

    expect(interactiveDemo).toBeTruthy()
    expect(interactiveDemo).toContain('predict whether the hidden accumulated sensitivity')
    expect(interactiveDemo).toContain('Use Case A and Case B as neutral graph states')
    expect(beforeDemo).not.toContain('cos(a)')
    expect(beforeDemo).not.toContain('bar a =')
    expect(beforeDemo).not.toContain('\\bar x')
    expect(beforeDemo).not.toContain('\\bar y')
    expect(beforeDemo).not.toContain('bar x')
    expect(beforeDemo).not.toContain('bar y')
    expect(beforeDemo).not.toContain('bar_x')
    expect(beforeDemo).not.toContain('bar_y')
    expect(beforeDemo).not.toContain('near cancellation')
    expect(beforeDemo).not.toContain('a\\approx\\pi')
    expect(interactiveDemo).not.toContain('Near cancel preset')
    expect(interactiveDemo).not.toContain('a close to')
  })
})
