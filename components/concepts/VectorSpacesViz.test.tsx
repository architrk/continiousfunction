import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'fs'
import path from 'path'
import { DEMO_STATE_EVENT, type DemoStateEventDetail, type DemoStateSummary } from '@/lib/demoState'
import VectorSpacesViz, { classifySpan } from '@/content/domains/linear-algebra/concepts/vector-spaces/viz'

describe('VectorSpacesViz span-collapse reveal', () => {
  it('classifies span collapse with normalized area instead of raw area', () => {
    expect(classifySpan([0.05, 0], [0, 0.05]).outcome).toBe('plane')
    expect(classifySpan([1, 0], [1, 0.01]).outcome).toBe('near')
    expect(classifySpan([1, 0], [1, 0.01]).dimension).toBe(2)
    expect(classifySpan([1, 0], [2, 0]).outcome).toBe('collapsed')
    expect(classifySpan([1, 0], [2, 0]).dimension).toBe(1)
    expect(classifySpan([2, 1], [4, 2]).outcome).toBe('collapsed')
    expect(classifySpan([2, 1], [4, 2.4]).outcome).toBe('near')
    expect(classifySpan([0, 0], [0, 0]).dimension).toBe(0)
  })

  it('hides determinant, area, span status, and measured demo state before reveal', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<VectorSpacesViz />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))

      expect(observed).toHaveLength(0)
      expect(screen.getByRole('button', { name: /Reveal span witness/ })).toBeDisabled()
      expect(screen.getByText('area witness hidden until reveal')).toBeInTheDocument()
      expect(screen.queryByText(/det\[u v\]/)).not.toBeInTheDocument()
      expect(screen.queryByText(/^area$/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/plane span/)).not.toBeInTheDocument()
      expect(screen.queryByText(/line span/)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Show parallelogram witness/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Basis pair/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Line span/ })).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /Sweeps a 2D plane/ }))
      expect(screen.getByRole('button', { name: /Reveal span witness/ })).toBeEnabled()
      expect(observed).toHaveLength(0)
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('reveals span witness and emits compact measured state after prediction', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<VectorSpacesViz />)

      fireEvent.click(screen.getByRole('button', { name: /Sweeps a 2D plane/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal span witness/ }))

      expect(screen.getByText(/Prediction: Sweeps a 2D plane/)).toBeInTheDocument()
      expect(screen.getByText(/Actual: Sweeps a 2D plane/)).toBeInTheDocument()
      expect(screen.getAllByText(/normalized area/).length).toBeGreaterThan(0)
      expect(screen.getByLabelText(/Show parallelogram witness/)).toBeInTheDocument()

      await waitFor(() => {
        expect(observed.some((state) => state.conceptId === 'vector-spaces')).toBe(true)
      })

      const latest = observed[observed.length - 1]
      expect(latest.label).toBe('Vector-space span-collapse witness')
      expect(latest.summary).toContain('Predicted plane span; actual plane span')
      expect(latest.values).toEqual(
        expect.arrayContaining([
          'prediction phase: revealed',
          'learner prediction: plane span',
          'actual span outcome: plane span',
          'prediction correct: yes',
          'det[u v]: 6.30',
          'parallelogram area: 6.30',
          'normalized area |det|/(|u||v|): 1.00',
          'span dimension: 2',
          'w=a u + b v: (1.00, 3.50)',
        ])
      )

      fireEvent.click(screen.getByLabelText(/Show parallelogram witness/))
      await waitFor(() => {
        expect(observed[observed.length - 1].values).toContain('parallelogram visible: no')
      })
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('clears stale revealed span state when the generator pair changes', async () => {
    const events: DemoStateEventDetail[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail) events.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<VectorSpacesViz />)
      fireEvent.click(screen.getByRole('button', { name: /Sweeps a 2D plane/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal span witness/ }))
      expect(await screen.findByText(/Prediction: Sweeps a 2D plane/)).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.click(screen.getByRole('button', { name: 'Pair B' }))

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })

      expect(screen.queryByText(/Prediction: Sweeps a 2D plane/)).not.toBeInTheDocument()
      expect(screen.queryByText(/det\[u v\]/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal span witness/ })).toBeDisabled()
      expect(screen.getByText('area witness hidden until reveal')).toBeInTheDocument()
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('preserves reveal and re-emits closure state when only coefficients change', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<VectorSpacesViz />)
      fireEvent.click(screen.getByRole('button', { name: /Sweeps a 2D plane/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal span witness/ }))
      expect(await screen.findByText(/Prediction: Sweeps a 2D plane/)).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('a (scale u)'), { target: { value: '2' } })

      expect(screen.getByText(/Prediction: Sweeps a 2D plane/)).toBeInTheDocument()
      expect(screen.getByText(/det\[u v\]/)).toBeInTheDocument()
      await waitFor(() => {
        expect(observed[observed.length - 1].values).toEqual(
          expect.arrayContaining([
            'a: 2.00',
            'w=a u + b v: (3.20, 4.90)',
            'det[u v]: 6.30',
            'span dimension: 2',
          ])
        )
      })
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('keeps the Interactive Demo copy prediction-first', () => {
    const mdx = readFileSync(
      path.join(process.cwd(), 'content/domains/linear-algebra/concepts/vector-spaces/content.mdx'),
      'utf8'
    )
    const interactiveDemo = mdx.split('## Interactive Demo')[1]

    expect(interactiveDemo).toBeTruthy()
    expect(interactiveDemo).toContain('predict whether the two generators sweep a plane')
    expect(interactiveDemo).not.toContain('det[u v] =')
  })
})
