import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import DemoPredictionCheckpoint from './DemoPredictionCheckpoint'
import { clearDemoState, emitDemoState } from '@/lib/demoState'

describe('DemoPredictionCheckpoint', () => {
  it('reports the revealed prediction lens for route handoff', () => {
    const onReveal = jest.fn()

    render(
      <DemoPredictionCheckpoint
        conceptTitle="Efficient Attention"
        demoPrompt="Manipulate one control and predict the visible change."
        nextConcept="LLM Serving"
        onReveal={onReveal}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'An invariant holds' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal check' }))

    expect(onReveal).toHaveBeenCalledWith({
      modeId: 'stable',
      label: 'An invariant holds',
      check: expect.stringContaining('Carry the observation into LLM Serving.'),
    })
    expect(screen.getByText(/Name the thing that should remain true/)).toBeInTheDocument()
  })

  it('carries the latest matching emitted demo state into the reveal payload', async () => {
    const onReveal = jest.fn()

    emitDemoState({
      conceptId: 'efficient-attention',
      label: 'Grouped-query attention sharing prediction',
      summary: 'GQA maps Q9 to KV2; KV cache is 67 GB, 25% of MHA.',
      values: ['query heads Hq: 32', 'KV heads Hkv: 8'],
      updatedAt: '2026-05-04T00:00:00.000Z',
    })

    render(
      <DemoPredictionCheckpoint
        conceptId="efficient-attention"
        conceptTitle="Efficient Attention"
        demoPrompt="Manipulate one control and predict the visible change."
        nextConcept="LLM Serving"
        onReveal={onReveal}
      />
    )

    expect(await screen.findByText('Current demo state')).toBeInTheDocument()
    expect(screen.getByText('GQA maps Q9 to KV2; KV cache is 67 GB, 25% of MHA.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reveal check' }))

    expect(onReveal).toHaveBeenCalledWith(
      expect.objectContaining({
        demoState: expect.objectContaining({
          conceptId: 'efficient-attention',
          label: 'Grouped-query attention sharing prediction',
          summary: 'GQA maps Q9 to KV2; KV cache is 67 GB, 25% of MHA.',
        }),
      })
    )
  })

  it('clears a previously emitted matching demo state', async () => {
    const onReveal = jest.fn()

    emitDemoState({
      conceptId: 'probability-basics',
      label: 'Probability conditioning prediction',
      summary: 'prediction=increase; actual=increase; P(B)=0.080 -> P(B|H)=0.183.',
      values: ['P(H)=0.394', 'P(B|H)=0.183'],
      updatedAt: '2026-05-06T00:00:00.000Z',
    })

    render(
      <DemoPredictionCheckpoint
        conceptId="probability-basics"
        conceptTitle="Probability Basics"
        demoPrompt="Predict the conditioning direction."
        onReveal={onReveal}
      />
    )

    expect(await screen.findByText('Current demo state')).toBeInTheDocument()
    expect(screen.getByText('prediction=increase; actual=increase; P(B)=0.080 -> P(B|H)=0.183.')).toBeInTheDocument()

    act(() => {
      clearDemoState('probability-basics')
    })
    await waitFor(() => {
      expect(screen.queryByText('Current demo state')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Reveal check' }))
    expect(onReveal).toHaveBeenCalledWith(expect.not.objectContaining({ demoState: expect.anything() }))
  })
})
