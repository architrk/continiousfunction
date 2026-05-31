import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DEMO_STATE_EVENT, type DemoStateEventDetail, type DemoStateSummary } from '@/lib/demoState'
import DemoPredictionCheckpoint from './DemoPredictionCheckpoint'
import ProbabilityBasicsViz from '@/content/domains/probability/concepts/probability-basics/viz'

describe('ProbabilityBasicsViz prediction reveal', () => {
  it('hides evidence and posterior before reveal, then emits measured conditioning state', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<ProbabilityBasicsViz />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))

      expect(observed).toHaveLength(0)
      expect(screen.getByText('evidence P(H)')).toBeInTheDocument()
      expect(screen.getByText('posterior P(B | H)')).toBeInTheDocument()
      expect(screen.getAllByText('hidden').length).toBeGreaterThanOrEqual(5)
      expect(document.body.textContent ?? '').not.toContain('P(B) moves from 0.080 to 0.183')
      expect(screen.queryByText('0.394')).not.toBeInTheDocument()
      expect(screen.queryByText('0.183')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /B gets more likely/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Reveal conditioning' }))

      expect(document.body.textContent ?? '').toContain('Correct. Actual movement: increase. P(B) moves from 0.080 to 0.183')
      expect(screen.getAllByText('0.394').length).toBeGreaterThan(0)
      expect(screen.getAllByText('0.183').length).toBeGreaterThan(0)

      await waitFor(() => {
        expect(observed.some((state) => state.conceptId === 'probability-basics')).toBe(true)
      })

      const latest = observed[observed.length - 1]
      expect(latest.label).toBe('Probability conditioning prediction')
      expect(latest.summary).toContain('prediction=increase; actual=increase')
      expect(latest.values).toEqual(
        expect.arrayContaining([
          'observation=H',
          'P(B)=0.080',
          'P(H|A)=0.350',
          'P(H|B)=0.900',
          'P(H)=0.394',
          'P(B and H)=0.072',
          'P(B|H)=0.183',
          'prediction correct=yes',
        ])
      )
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('resets the reveal when the scenario changes', () => {
    render(<ProbabilityBasicsViz />)

    fireEvent.click(screen.getByRole('button', { name: /B gets more likely/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal conditioning' }))
    expect(document.body.textContent ?? '').toContain('P(B) moves from 0.080 to 0.183')

    fireEvent.click(screen.getByRole('button', { name: 'tail setup' }))
    expect(screen.getByText('posterior P(B | T)')).toBeInTheDocument()
    expect(screen.getAllByText('hidden').length).toBeGreaterThanOrEqual(5)
    expect(document.body.textContent ?? '').not.toContain('P(B) moves from 0.080 to 0.183')
  })

  it('clears stale measured state from the shared checkpoint when the scenario becomes unrevealed', async () => {
    const onReveal = jest.fn()

    render(
      <>
        <ProbabilityBasicsViz />
        <DemoPredictionCheckpoint
          conceptId="probability-basics"
          conceptTitle="Probability Basics"
          demoPrompt="Predict the conditioning direction before saving the demo state."
          onReveal={onReveal}
        />
      </>
    )

    fireEvent.click(screen.getByRole('button', { name: /B gets more likely/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal conditioning' }))

    expect(await screen.findByText('Current demo state')).toBeInTheDocument()
    expect(screen.getByText(/P\(B\)=0\.080 -> P\(B\|H\)=0\.183/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'tail setup' }))

    await waitFor(() => {
      expect(screen.queryByText(/P\(B\)=0\.080 -> P\(B\|H\)=0\.183/)).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Reveal check' })[0])
    expect(onReveal).toHaveBeenCalledWith(expect.not.objectContaining({ demoState: expect.anything() }))
  })
})
