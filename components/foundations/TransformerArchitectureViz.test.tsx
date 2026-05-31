import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  clearDemoState,
  DEMO_STATE_EVENT,
  getLatestDemoState,
  type DemoStateEventDetail,
  type DemoStateSummary,
} from '@/lib/demoState'
import TransformerArchitectureViz from './TransformerArchitectureViz'

jest.mock('d3', () => ({
  interpolateNumber: (a: number, b: number) => (t: number) => a + (b - a) * t,
}))

jest.mock('next/dynamic', () => {
  return (loader: () => Promise<unknown>) => {
    const source = String(loader)
    if (source.includes('TransformerArchitectureViz')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('./TransformerArchitectureViz').default
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactForMock = require('react')
    return function MockDynamicComponent() {
      return ReactForMock.createElement('div', null, 'Mock attention child')
    }
  }
})

function collectDemoEvents() {
  const events: DemoStateEventDetail[] = []
  const handleDemoState = (event: Event) => {
    const detail = (event as CustomEvent<DemoStateEventDetail>).detail
    if (detail) events.push(detail)
  }
  window.addEventListener(DEMO_STATE_EVENT, handleDemoState)
  return {
    events,
    stop: () => window.removeEventListener(DEMO_STATE_EVENT, handleDemoState),
  }
}

function measuredStates(events: DemoStateEventDetail[]): DemoStateSummary[] {
  return events.filter((event): event is DemoStateSummary => !('cleared' in event))
}

describe('TransformerArchitectureViz residual-shape reveal', () => {
  it('hides shape labels, formulas, and measured state before reveal', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<TransformerArchitectureViz />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))

      expect(measuredStates(events)).toHaveLength(0)
      expect(screen.getByRole('button', { name: /Reveal residual shape/ })).toBeDisabled()
      expect(screen.getByText('Tensor shapes, formulas, hover equations, and measured architecture state are locked until reveal.')).toBeInTheDocument()
      expect(screen.getByText('Residual-stream shape locked')).toBeInTheDocument()
      expect(screen.getByText('Tensor shapes locked')).toBeInTheDocument()
      expect(screen.getByLabelText('Tensor shapes locked')).toBeDisabled()
      expect(screen.getByRole('button', { name: /Quiz locked/ })).toBeDisabled()

      const text = document.body.textContent ?? ''
      expect(text).not.toContain('src: 6 × 512')
      expect(text).not.toContain('tgt: 6 × 512')
      expect(text).not.toContain('Q: 6 × 512, K,V: 6 × 512')
      expect(text).not.toContain('6 × 32000')
      expect(text).not.toContain('Default hyperparameters')
      expect(text).not.toContain('Attention(Q, K, V) = softmax')
      expect(text).not.toContain('FFN(x) =')
      expect(text).not.toContain('Both attention and the FFN return')
      expect(text).not.toContain('residual add legal')

      fireEvent.click(screen.getByRole('button', { name: 'Play token flow' }))
      fireEvent.change(screen.getByLabelText(/Speed/), { target: { value: '1.5' } })
      await new Promise((resolve) => window.setTimeout(resolve, 0))
      expect(measuredStates(events)).toHaveLength(0)
    } finally {
      stop()
    }
  })

  it('reveals the residual-stream boundary invariant and emits compact measured state', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<TransformerArchitectureViz />)
      fireEvent.click(screen.getByRole('button', { name: 'Attention and FFN return to T × d_model' }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal residual shape/ }))

      expect(screen.getByText(/Prediction matched\./)).toBeInTheDocument()
      expect(screen.getByText(/Residual-shape reveal:/)).toBeInTheDocument()
      expect(screen.getByText('src: 6 × 512')).toBeInTheDocument()
      expect(screen.getByText('tgt: 6 × 512')).toBeInTheDocument()
      expect(screen.getByText('Default hyperparameters')).toBeInTheDocument()
      expect(screen.getByText('512')).toBeInTheDocument()
      expect(screen.getByText('2048')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Self-Attention (enc)'))
      expect(screen.getByText('Tensor shapes')).toBeInTheDocument()
      expect(screen.getByText('Key formulas')).toBeInTheDocument()
      expect(screen.getByText('Attention(Q, K, V) = softmax(Q Kᵀ / √d_k) V')).toBeInTheDocument()

      await waitFor(() => {
        expect(measuredStates(events).some((state) => state.label === 'Transformer architecture residual-shape reveal')).toBe(true)
      })

      const latest = measuredStates(events).at(-1)
      expect(latest?.summary).toContain('Learner predicted attention and FFN return to T × d_model')
      expect(latest?.values).toEqual(
        expect.arrayContaining([
          'slice: transformer-architecture-prediction-first-residual-shape-reveal',
          'prediction: attention and FFN return to T × d_model',
          'actual: attention and FFN return to T × d_model at the residual boundary',
          'prediction correct: yes',
          'residual stream shape: T × d_model',
          'attention weights shape: h × T × T',
          'attention output shape: T × d_model',
          'ffn hidden shape: T × d_ff',
          'ffn output shape: T × d_model',
          'residual add legal: yes, sublayer output matches input stream shape',
          'd_model: 512',
          'd_ff: 2048',
          'heads: 8',
          'd_k: 64',
        ])
      )
    } finally {
      stop()
    }
  })

  it('reveals the same residual answer after a wrong prediction', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<TransformerArchitectureViz />)
      fireEvent.click(screen.getByRole('button', { name: 'The FFN hands T × d_ff to the next layer' }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal residual shape/ }))

      expect(screen.getByText(/Prediction missed\. Actual: attention and FFN return to T × d_model\./)).toBeInTheDocument()
      await waitFor(() => {
        expect(measuredStates(events).some((state) => state.values?.includes('prediction correct: no'))).toBe(true)
      })
      const latest = measuredStates(events).at(-1)
      expect(latest?.values).toEqual(
        expect.arrayContaining([
          'prediction: the FFN hands T × d_ff forward',
          'actual: attention and FFN return to T × d_model at the residual boundary',
          'prediction correct: no',
        ])
      )
    } finally {
      stop()
    }
  })

  it('clears stale reveal and shared state when prediction or architecture variant changes', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<TransformerArchitectureViz />)
      fireEvent.click(screen.getByRole('button', { name: 'Attention and FFN return to T × d_model' }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal residual shape/ }))
      expect(await screen.findByText(/Prediction matched\./)).toBeInTheDocument()

      const clearsBeforePrediction = events.filter((event) => 'cleared' in event).length
      fireEvent.click(screen.getByRole('button', { name: 'The block outputs T × V logits' }))
      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBeforePrediction)
      })
      expect(screen.queryByText(/Prediction matched\./)).not.toBeInTheDocument()
      expect(screen.queryByText(/Residual-shape reveal:/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal residual shape/ })).toBeEnabled()

      fireEvent.click(screen.getByRole('button', { name: /Reveal residual shape/ }))
      expect(await screen.findByText(/Prediction missed/)).toBeInTheDocument()
      const clearsBeforeVariant = events.filter((event) => 'cleared' in event).length
      fireEvent.click(screen.getByRole('button', { name: /GPT/ }))
      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBeforeVariant)
      })
      expect(screen.queryByText(/Prediction missed/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Residual-shape reveal:/)).not.toBeInTheDocument()
    } finally {
      stop()
    }
  })

  it('keeps quiz results from changing variants and closes quiz when a preset clears reveal', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      render(<TransformerArchitectureViz />)
      fireEvent.click(screen.getByRole('button', { name: 'Attention and FFN return to T × d_model' }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal residual shape/ }))
      expect(await screen.findByText(/Prediction matched\./)).toBeInTheDocument()

      await waitFor(() => {
        expect(measuredStates(events).some((state) => state.label === 'Transformer architecture residual-shape reveal')).toBe(true)
      })
      const measuredBeforeQuiz = measuredStates(events).length

      fireEvent.click(screen.getByRole('button', { name: /Try Architecture Quiz/ }))
      fireEvent.click(screen.getByRole('button', { name: /The Chatbot/ }))
      const gptButtons = screen.getAllByRole('button', { name: /GPT/ })
      fireEvent.click(gptButtons[gptButtons.length - 1])

      expect(screen.getByText(/The answer is/)).toBeInTheDocument()
      expect(screen.getByText(/Prediction matched\./)).toBeInTheDocument()
      await new Promise((resolve) => window.setTimeout(resolve, 0))
      expect(measuredStates(events)).toHaveLength(measuredBeforeQuiz)

      const clearsBeforeVariant = events.filter((event) => 'cleared' in event).length
      fireEvent.click(screen.getByRole('button', { name: /GPT/ }))
      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBeforeVariant)
      })
      expect(screen.queryByText(/Prediction matched\./)).not.toBeInTheDocument()
      expect(screen.queryByText(/Architecture Identification Challenge/)).not.toBeInTheDocument()
      expect(screen.queryByText(/The answer is/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Quiz locked/ })).toBeDisabled()
    } finally {
      stop()
    }
  })

  it('clears shared state on component focus, animation reset, concept id change, and unmount', async () => {
    const { events, stop } = collectDemoEvents()

    try {
      const { rerender, unmount } = render(<TransformerArchitectureViz conceptId="architecture-a" />)
      fireEvent.click(screen.getByRole('button', { name: 'Attention and FFN return to T × d_model' }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal residual shape/ }))
      expect(await screen.findByText(/Prediction matched\./)).toBeInTheDocument()

      const clearsBeforeFocus = events.filter((event) => 'cleared' in event).length
      fireEvent.click(screen.getAllByText('Feed-Forward')[0])
      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBeforeFocus)
      })
      expect(screen.getAllByText('Position-wise Feed-Forward Network').length).toBeGreaterThan(0)

      const clearsBeforeReset = events.filter((event) => 'cleared' in event).length
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBeforeReset)
      })
      expect(screen.queryByText(/Prediction matched\./)).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Attention and FFN return to T × d_model' }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal residual shape/ }))
      expect(await screen.findByText(/Prediction matched\./)).toBeInTheDocument()
      rerender(<TransformerArchitectureViz conceptId="architecture-b" />)
      await waitFor(() => {
        expect(screen.queryByText(/Prediction matched\./)).not.toBeInTheDocument()
      })
      expect(events.some((event) => 'cleared' in event && event.conceptId === 'architecture-a')).toBe(true)
      expect(events.some((event) => 'cleared' in event && event.conceptId === 'architecture-b')).toBe(true)

      fireEvent.click(screen.getByRole('button', { name: 'Attention and FFN return to T × d_model' }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal residual shape/ }))
      expect(await screen.findByText(/Prediction matched\./)).toBeInTheDocument()
      const clearsBeforeUnmount = events.filter((event) => 'cleared' in event).length
      unmount()
      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBeforeUnmount)
      })
    } finally {
      stop()
    }
  })

  it('clears the Transformer Block child reveal when the parent attention tab unmounts and remounts it', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AttentionTransformersViz = require('../../content/domains/attention-transformers/concepts/attention-transformers/viz').default
    const { stop } = collectDemoEvents()

    try {
      render(<AttentionTransformersViz />)
      fireEvent.click(screen.getByRole('tab', { name: 'Transformer Block' }))
      fireEvent.click(screen.getByRole('button', { name: 'Block composition' }))
      fireEvent.click(screen.getByRole('button', { name: 'Reveal mechanism' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Attention and FFN return to T × d_model' }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal residual shape/ }))
      expect(await screen.findByText(/Prediction matched\./)).toBeInTheDocument()

      fireEvent.click(screen.getByRole('tab', { name: 'Geometry' }))
      fireEvent.click(screen.getByRole('tab', { name: 'Transformer Block' }))
      fireEvent.click(screen.getByRole('button', { name: 'Block composition' }))
      fireEvent.click(screen.getByRole('button', { name: 'Reveal mechanism' }))

      expect(await screen.findByText('Tensor shapes, formulas, hover equations, and measured architecture state are locked until reveal.')).toBeInTheDocument()
      expect(screen.queryByText(/Prediction matched\./)).not.toBeInTheDocument()
      expect(screen.queryByText(/Residual-shape reveal:/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal residual shape/ })).toBeDisabled()
    } finally {
      stop()
    }
  })

  it('keeps child measured state after the parent router delayed re-emit fires', async () => {
    jest.useFakeTimers()
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AttentionTransformersViz = require('../../content/domains/attention-transformers/concepts/attention-transformers/viz').default
    const { stop } = collectDemoEvents()

    try {
      render(<AttentionTransformersViz />)
      fireEvent.click(screen.getByRole('tab', { name: 'Transformer Block' }))
      fireEvent.click(screen.getByRole('button', { name: 'Block composition' }))
      fireEvent.click(screen.getByRole('button', { name: 'Reveal mechanism' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Attention and FFN return to T × d_model' }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal residual shape/ }))

      await waitFor(() => {
        expect(getLatestDemoState('attention-transformers')?.label).toBe('Transformer architecture residual-shape reveal')
      })

      act(() => {
        jest.advanceTimersByTime(400)
      })

      expect(getLatestDemoState('attention-transformers')?.label).toBe('Transformer architecture residual-shape reveal')
      expect(getLatestDemoState('attention-transformers')?.values).toEqual(
        expect.arrayContaining([
          'prediction: attention and FFN return to T × d_model',
          'residual stream shape: T × d_model',
        ])
      )
    } finally {
      clearDemoState('attention-transformers')
      stop()
      jest.useRealTimers()
    }
  })
})
