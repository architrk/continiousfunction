import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import LearningCompanionPanel from './LearningCompanionPanel'
import { clearDemoState, emitDemoState } from '@/lib/demoState'

describe('LearningCompanionPanel demo state handoff', () => {
  it('removes stale measured demo state from the prompt when the scope is cleared', async () => {
    render(<LearningCompanionPanel title="Probability Basics" demoStateScope="probability-basics" />)

    act(() => {
      emitDemoState({
        conceptId: 'probability-basics',
        label: 'Probability conditioning prediction',
        summary: 'prediction=increase; actual=increase; P(B)=0.080 -> P(B|H)=0.183.',
        values: ['P(H)=0.394', 'P(B|H)=0.183'],
        updatedAt: '2026-05-06T00:00:00.000Z',
      })
    })

    expect(await screen.findByText('Demo state')).toBeInTheDocument()
    expect(document.body.textContent ?? '').toContain('P(B|H)=0.183')
    expect(document.body.textContent ?? '').toContain('Current interactive demo state')

    act(() => {
      clearDemoState('probability-basics')
    })

    await waitFor(() => {
      expect(screen.queryByText('Demo state')).not.toBeInTheDocument()
    })
    expect(document.body.textContent ?? '').not.toContain('P(B|H)=0.183')
    expect(document.body.textContent ?? '').not.toContain('Current interactive demo state')
  })

  it('drops demo state when the scoped concept changes during client-side reuse', async () => {
    const { rerender } = render(<LearningCompanionPanel title="Probability Basics" demoStateScope="probability-basics" />)

    act(() => {
      emitDemoState({
        conceptId: 'probability-basics',
        label: 'Probability conditioning prediction',
        summary: 'prediction=increase; actual=increase; P(B)=0.080 -> P(B|H)=0.183.',
      })
    })

    expect(await screen.findByText('Demo state')).toBeInTheDocument()

    rerender(<LearningCompanionPanel title="Random Variables" demoStateScope="random-variables" />)

    await waitFor(() => {
      expect(screen.queryByText('Demo state')).not.toBeInTheDocument()
    })
    expect(document.body.textContent ?? '').not.toContain('P(B|H)=0.183')
  })
})
