import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DEMO_STATE_EVENT, type DemoStateEventDetail, type DemoStateSummary } from '@/lib/demoState'
import RandomVariablesViz from '@/content/domains/probability/concepts/random-variables/viz'
import DemoPredictionCheckpoint from './DemoPredictionCheckpoint'

describe('RandomVariablesViz prediction reveal', () => {
  it('hides grouped distribution evidence before reveal, then emits pushforward state', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<RandomVariablesViz />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))

      expect(observed).toHaveLength(0)
      expect(screen.getByText('predict pushforward')).toBeInTheDocument()
      expect(screen.getByText('grouped values')).toBeInTheDocument()
      expect(screen.getAllByText('hidden').length).toBeGreaterThanOrEqual(4)
      expect(document.body.textContent ?? '').not.toContain('support of X')
      expect(document.body.textContent ?? '').not.toContain('E[X]')
      expect(document.body.textContent ?? '').not.toContain('Var(X)')
      expect(document.body.textContent ?? '').not.toContain('largest mass')
      expect(document.body.textContent ?? '').not.toContain('winning fiber X=1 <- {5, 6}')
      expect(document.body.textContent ?? '').not.toContain('57%')

      fireEvent.click(screen.getByRole('button', { name: 'X = 1, high-roll fiber' }))
      expect(observed).toHaveLength(0)

      fireEvent.click(screen.getByRole('button', { name: 'Reveal pushforward' }))

      expect(screen.getByText('Correct.')).toBeInTheDocument()
      expect(screen.getByText('support of X')).toBeInTheDocument()
      expect(screen.getByText('E[X]')).toBeInTheDocument()
      expect(screen.getByText('Var(X)')).toBeInTheDocument()
      expect(screen.getByText('largest mass')).toBeInTheDocument()
      expect(document.body.textContent ?? '').toContain('winning fiber is X=1 <- {5, 6}')
      expect(document.body.textContent ?? '').toContain('57%')

      await waitFor(() => {
        expect(observed.some((state) => state.conceptId === 'random-variables')).toBe(true)
      })

      const latest = observed[observed.length - 1]
      expect(latest.label).toBe('Random variable pushforward prediction')
      expect(latest.summary).toContain('prediction=x-1; actual=x-1')
      expect(latest.summary).toContain('support=[0, 1]')
      expect(latest.values).toEqual(
        expect.arrayContaining([
          'measurement=high (high-roll indicator)',
          'rule=X(omega) = 1 for omega >= 5, else 0',
          'tilt=0.350',
          'prediction=x-1',
          'actual=x-1',
          'prediction correct=yes',
          'winning fiber=X=1 <- {5, 6}',
          'E[X]=0.574',
          'Var(X)=0.245',
        ])
      )
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('resets the reveal when the measurement setup changes', () => {
    render(<RandomVariablesViz />)

    fireEvent.click(screen.getByRole('button', { name: 'X = 1, high-roll fiber' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal pushforward' }))
    expect(screen.getByText('support of X')).toBeInTheDocument()
    expect(document.body.textContent ?? '').toContain('winning fiber is X=1 <- {5, 6}')

    fireEvent.click(screen.getByRole('button', { name: 'face setup' }))

    expect(screen.queryByText('support of X')).not.toBeInTheDocument()
    expect(screen.queryByText('E[X]')).not.toBeInTheDocument()
    expect(screen.queryByText('Var(X)')).not.toBeInTheDocument()
    expect(document.body.textContent ?? '').not.toContain('winning fiber is X=1 <- {5, 6}')
    expect(screen.getAllByText('hidden').length).toBeGreaterThanOrEqual(4)
  })

  it('uses the exact largest fiber rather than a near-tie tolerance as the winner', () => {
    render(<RandomVariablesViz />)

    fireEvent.change(screen.getByLabelText(/measurement X/i), { target: { value: 'parity' } })
    fireEvent.change(screen.getByLabelText(/die tilt/i), { target: { value: '-0.01' } })

    fireEvent.click(screen.getByRole('button', { name: 'X = 1, odd fiber' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal pushforward' }))

    expect(screen.getByText('Correct.')).toBeInTheDocument()
    expect(document.body.textContent ?? '').toContain('winning fiber is X=1 <- {1, 3, 5}')
    expect(document.body.textContent ?? '').not.toContain('winning fiber is X=0 <-')
    expect(document.body.textContent ?? '').not.toContain('X=0 <- {2, 4, 6}')
  })

  it('clears stale measured state from the shared checkpoint when the scenario becomes unrevealed', async () => {
    const onReveal = jest.fn()

    render(
      <>
        <RandomVariablesViz />
        <DemoPredictionCheckpoint
          conceptId="random-variables"
          conceptTitle="Random Variables"
          demoPrompt="Predict the dominant measured value before saving the demo state."
          onReveal={onReveal}
        />
      </>
    )

    fireEvent.click(screen.getByRole('button', { name: 'X = 1, high-roll fiber' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal pushforward' }))

    expect(await screen.findByText('Current demo state')).toBeInTheDocument()
    expect(screen.getByText(/prediction=x-1; actual=x-1/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'face setup' }))

    await waitFor(() => {
      expect(screen.queryByText(/prediction=x-1; actual=x-1/)).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Reveal check' }))
    expect(onReveal).toHaveBeenCalledWith(expect.not.objectContaining({ demoState: expect.anything() }))
  })
})
