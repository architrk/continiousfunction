import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'fs'
import path from 'path'
import { DEMO_STATE_EVENT, type DemoStateEventDetail, type DemoStateSummary } from '@/lib/demoState'
import DerivativesViz, { classifyTangentRelation } from '@/content/domains/calculus/concepts/derivatives/viz'

describe('DerivativesViz tangent relation reveal', () => {
  it('classifies tangent relation with a scale-aware tolerance', () => {
    expect(classifyTangentRelation(2, 2.6).relation).toBe('tangent-lower')
    expect(classifyTangentRelation(2.01, 2).relation).toBe('near')
    expect(classifyTangentRelation(3, 2).relation).toBe('tangent-higher')
    expect(classifyTangentRelation(101, 100).relation).toBe('near')
  })

  it('hides tangent values and emits no measured state before reveal', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<DerivativesViz />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))

      expect(observed).toHaveLength(0)
      expect(screen.getByLabelText('Function')).toHaveValue('x2')
      expect(screen.getByRole('button', { name: /Reveal tangent relation/ })).toBeDisabled()
      expect(document.body.textContent ?? '').toContain('x+h = 1.6')
      expect(document.body.textContent ?? '').toContain('f(x) = 1')
      expect(document.body.textContent ?? '').toContain('f(x+h) = 2.56')
      expect(screen.getByText('local tangent slope and gap hidden until reveal')).toBeInTheDocument()
      expect(document.body.textContent ?? '').not.toContain("tangent = f'(x) =")
      expect(screen.queryByText(/signed gap/)).not.toBeInTheDocument()
      expect(screen.queryByText(/coarse secant/)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Show revealed tangent/)).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /f'\(x\) is lower/ }))
      expect(screen.getByRole('button', { name: /Reveal tangent relation/ })).toBeEnabled()
      expect(observed).toHaveLength(0)
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('reveals the default tangent-lower relation and emits compact measured state', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<DerivativesViz />)
      fireEvent.click(screen.getByRole('button', { name: /f'\(x\) is lower/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal tangent relation/ }))

      expect(screen.getByText(/Correct\./)).toBeInTheDocument()
      expect(screen.getByText(/Prediction: f'\(x\) is lower/)).toBeInTheDocument()
      expect(screen.getByText(/Actual: f'\(x\) is lower/)).toBeInTheDocument()
      expect(document.body.textContent ?? '').toContain("tangent = f'(x) = 2")
      expect(screen.getByLabelText(/Show revealed tangent/)).toBeInTheDocument()

      await waitFor(() => {
        expect(observed.some((state) => state.conceptId === 'derivatives')).toBe(true)
      })

      const latest = observed[observed.length - 1]
      expect(latest.label).toBe('Secant-to-tangent derivative reveal')
      expect(latest.summary).toContain('prediction=tangent-lower; actual=tangent-lower')
      expect(latest.values).toEqual(
        expect.arrayContaining([
          'prediction: tangent-lower',
          'actual relation: tangent-lower',
          'prediction correct: yes',
          'secant slope: 2.6',
          'tangent slope: 2',
          'signed slope gap: tangent - secant = -0.6',
          'absolute slope gap: 0.6',
          'convergence status: coarse secant',
        ])
      )
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('shows wrong-answer feedback while still emitting the actual relation', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<DerivativesViz />)
      fireEvent.click(screen.getByRole('button', { name: /f'\(x\) is higher/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal tangent relation/ }))

      expect(screen.getByText(/Not quite\./)).toBeInTheDocument()

      await waitFor(() => {
        expect(observed.some((state) => state.values?.includes('prediction correct: no'))).toBe(true)
      })
      expect(observed[observed.length - 1].values).toEqual(
        expect.arrayContaining([
          'prediction: tangent-higher',
          'actual relation: tangent-lower',
          'prediction correct: no',
        ])
      )
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('clears stale tangent reveal when h or function changes', async () => {
    const events: DemoStateEventDetail[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail) events.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<DerivativesViz />)
      fireEvent.click(screen.getByRole('button', { name: /f'\(x\) is lower/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal tangent relation/ }))
      expect(await screen.findByText(/Correct\./)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.change(screen.getByLabelText('h (step)'), { target: { value: '0.2' } })

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(screen.queryByText(/Correct\./)).not.toBeInTheDocument()
      expect(document.body.textContent ?? '').not.toContain("tangent = f'(x) =")
      expect(screen.getByRole('button', { name: /Reveal tangent relation/ })).toBeDisabled()

      fireEvent.click(screen.getByRole('button', { name: /f'\(x\) is lower/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal tangent relation/ }))
      expect(await screen.findByText(/Correct\.|Not quite\./)).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('Function'), { target: { value: 'sin' } })
      expect(screen.queryByText(/Correct\.|Not quite\./)).not.toBeInTheDocument()
      expect(document.body.textContent ?? '').not.toContain("tangent = f'(x) =")
      expect(screen.getByRole('button', { name: /Reveal tangent relation/ })).toBeDisabled()
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('keeps the Interactive Demo copy prediction-first', () => {
    const mdx = readFileSync(
      path.join(process.cwd(), 'content/domains/calculus/concepts/derivatives/content.mdx'),
      'utf8'
    )
    const interactiveDemo = mdx.split('## Interactive Demo')[1]

    expect(interactiveDemo).toBeTruthy()
    expect(interactiveDemo).toContain('predict the hidden tangent relation')
    expect(interactiveDemo).not.toContain('watch the secant line become the tangent line')
  })
})
