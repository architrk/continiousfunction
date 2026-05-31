import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DEMO_STATE_EVENT, type DemoStateSummary } from '@/lib/demoState'
import ReverseModeAutodiffViz from '@/content/domains/calculus/concepts/reverse-mode-autodiff/viz'

describe('ReverseModeAutodiffViz prediction reveal', () => {
  it('hides cotangent values before reveal and emits measured state after prediction', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      observed.push((event as CustomEvent<DemoStateSummary>).detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<ReverseModeAutodiffViz />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))

      expect(observed).toHaveLength(0)
      expect(screen.getByText('bar a=hidden')).toBeInTheDocument()
      expect(screen.queryByText(/1\.960 = 1\.000 \+ 0\.960/)).not.toBeInTheDocument()
      expect(document.body.textContent ?? '').not.toContain('direct +1')
      expect(document.body.textContent ?? '').not.toContain('bar a += 1')
      expect(document.body.textContent ?? '').not.toContain('Cancel near pi')

      fireEvent.click(screen.getByRole('button', { name: /Paths reinforce/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Reveal reverse sweep' }))

      expect(screen.getByText(/Correct\./)).toBeInTheDocument()
      expect(screen.getByText(/1\.960 = 1\.000 \+ 0\.960/)).toBeInTheDocument()

      await waitFor(() => {
        expect(observed.some((state) => state.conceptId === 'reverse-mode-autodiff')).toBe(true)
      })

      const latest = observed[observed.length - 1]
      expect(latest.label).toBe('Reverse-mode cotangent prediction')
      expect(latest.summary).toContain('prediction=reinforce; actual=reinforce')
      expect(latest.values).toEqual(
        expect.arrayContaining([
          'a=x*y=6.000',
          'bar a=1.960',
          'bar x=5.881',
          'bar y=3.920',
          'prediction correct=yes',
        ])
      )
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('resets the reveal when a preset changes the cotangent regime', () => {
    render(<ReverseModeAutodiffViz />)

    fireEvent.click(screen.getByRole('button', { name: /Paths reinforce/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal reverse sweep' }))
    expect(screen.getByText(/1\.960 = 1\.000 \+ 0\.960/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Product sample' }))
    expect(screen.getByText('bar a=hidden')).toBeInTheDocument()
    expect(screen.queryByText(/0\.000 = 1\.000 - 1\.000/)).not.toBeInTheDocument()
  })
})
