import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'fs'
import path from 'path'
import { DEMO_STATE_EVENT, type DemoStateEventDetail, type DemoStateSummary } from '@/lib/demoState'
import DotProductViz, { classifyProjection } from '@/content/domains/linear-algebra/concepts/dot-product/viz'

describe('DotProductViz prediction reveal', () => {
  it('hides measured dot/projection values and emits no measured state before reveal', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<DotProductViz />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))

      expect(observed).toHaveLength(0)
      expect(screen.getByRole('button', { name: /Reveal dot product/ })).toBeDisabled()
      expect(screen.getByText('projection and angle locked until reveal')).toBeInTheDocument()
      expect(screen.getByText(/derived dot, angle, and projection values hidden/)).toBeInTheDocument()
      expect(screen.queryByText(/u dot v = 5\.52/)).not.toBeInTheDocument()
      expect(screen.queryByText(/cos theta = 0\.82/)).not.toBeInTheDocument()
      expect(screen.queryByText(/proj_v\(u\)/)).not.toBeInTheDocument()
      expect(document.querySelector('.eqLine.emph')).toBeNull()
      expect(document.querySelector('.result')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Aligned' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Opposite' })).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /Positive alignment/ }))
      expect(screen.getByRole('button', { name: /Reveal dot product/ })).toBeEnabled()
      expect(observed).toHaveLength(0)
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('reveals positive projection sign and emits compact measured state after prediction', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<DotProductViz />)

      fireEvent.click(screen.getByRole('button', { name: /Positive alignment/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal dot product/ }))

      const derivedReadout = document.querySelector('.eqLine.emph')?.textContent
      expect(derivedReadout).toContain('u dot v')
      expect(derivedReadout).toContain('5.52')
      expect(derivedReadout).toContain('cos theta')
      expect(derivedReadout).toContain('0.82')
      expect(screen.getByText(/proj_v\(u\)/)).toBeInTheDocument()
      expect(screen.getByText(/Prediction: Positive alignment/)).toBeInTheDocument()

      await waitFor(() => {
        expect(observed.some((state) => state.conceptId === 'dot-product')).toBe(true)
      })

      const latest = observed[observed.length - 1]
      expect(latest.label).toBe('Dot product projection-sign reveal')
      expect(latest.summary).toContain('learner predicted Positive alignment')
      expect(latest.summary).toContain('actual positive alignment')
      expect(latest.values).toEqual(
        expect.arrayContaining([
          'prediction phase: revealed',
          'learner prediction: Positive alignment',
          'actual alignment: positive alignment',
          'prediction correct: yes',
          'dot product: 5.52',
          'cos theta: 0.82',
          'projection length: 2.20',
        ])
      )

      fireEvent.click(screen.getByLabelText(/Show projection/))
      await waitFor(() => {
        expect(observed[observed.length - 1].values).toContain('visible layers: projection hidden, angle')
      })
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('resets stale reveal and clears measured state when a neutral preset changes vectors', async () => {
    const events: DemoStateEventDetail[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail) events.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<DotProductViz />)

      fireEvent.click(screen.getByRole('button', { name: /Positive alignment/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal dot product/ }))
      expect(await screen.findByText(/Prediction: Positive alignment/)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.click(screen.getByRole('button', { name: 'Case C' }))

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(screen.queryByText(/Prediction: Positive alignment/)).not.toBeInTheDocument()
      expect(screen.queryByText(/u dot v =/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal dot product/ })).toBeDisabled()
      expect(document.querySelector('.eqLine.emph')).toBeNull()
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('disables reveal and avoids measured state when a vector is near the origin', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<DotProductViz />)
      fireEvent.click(screen.getByRole('button', { name: 'Case D' }))
      fireEvent.click(screen.getByRole('button', { name: /Positive alignment/ }))
      expect(screen.getByText('Move both vectors away from the origin first.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal dot product/ })).toBeDisabled()
      expect(observed).toHaveLength(0)
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('classifies small aligned revealable vectors by signed projection, not raw dot magnitude', () => {
    const uNorm = 0.21
    const vNorm = 0.21
    const rawDot = uNorm * vNorm
    const signedProjectionLength = rawDot / vNorm

    expect(uNorm).toBeGreaterThan(0.2)
    expect(vNorm).toBeGreaterThan(0.2)
    expect(rawDot).toBeLessThan(0.05)
    expect(signedProjectionLength).toBeCloseTo(0.21)
    expect(classifyProjection(signedProjectionLength)).toBe('positive')
  })

  it('reveals negative signed scalar projection while keeping projection length nonnegative', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<DotProductViz />)

      fireEvent.click(screen.getByRole('button', { name: 'Case C' }))
      fireEvent.click(screen.getByRole('button', { name: /Negative \/ opposite/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal dot product/ }))

      expect(screen.getByText(/Actual: negative \/ opposite alignment/)).toBeInTheDocument()
      expect(screen.getByText(/signed scalar projection/)).toBeInTheDocument()

      await waitFor(() => {
        expect(observed.some((state) => state.values?.includes('actual alignment: negative / opposite alignment'))).toBe(true)
      })

      const latest = observed[observed.length - 1]
      expect(latest.values).toEqual(
        expect.arrayContaining([
          'dot product: -6.05',
          'cos theta: -1.00',
          'signed scalar projection: -2.46',
          'projection length: 2.46',
        ])
      )
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('keeps the Interactive Demo copy prediction-first', () => {
    const mdx = readFileSync(
      path.join(process.cwd(), 'content/domains/linear-algebra/concepts/dot-product/content.mdx'),
      'utf8'
    )
    const interactiveDemo = mdx.split('## Interactive Demo')[1]

    expect(interactiveDemo).toBeTruthy()
    expect(interactiveDemo).toContain('predict whether the signed projection')
    expect(interactiveDemo).not.toContain('update in real time')
  })
})
