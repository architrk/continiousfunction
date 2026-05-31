import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import FlashAttentionConceptViz from '@/content/domains/attention-transformers/concepts/flash-attention/viz'
import { DEMO_STATE_EVENT, type DemoStateEventDetail, type DemoStateSummary } from '@/lib/demoState'

const DEFAULT_BYTES = {
  score: '8.0 MiB',
  qkv: '768.0 KiB',
  tile: '32.0 KiB',
  ratio: '256x',
}

function isSummary(detail: DemoStateEventDetail): detail is DemoStateSummary {
  return !('cleared' in detail)
}

function latestSummary(events: DemoStateSummary[]) {
  return events[events.length - 1]
}

describe('FlashAttentionConceptViz prediction-first reveal', () => {
  const originalConsoleError = console.error
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
      const text = args.map(String).join(' ')
      if (text.includes('non-boolean attribute') && text.includes('jsx')) return
      originalConsoleError(...args)
    })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('hides measured bytes before reveal and emits neutral setup state', async () => {
    const observed: DemoStateSummary[] = []
    const listener = ((event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && isSummary(detail)) observed.push(detail)
    }) as EventListener
    window.addEventListener(DEMO_STATE_EVENT, listener)

    try {
      render(<FlashAttentionConceptViz />)

      await waitFor(() => {
        expect(observed.length).toBeGreaterThan(0)
      })

      expect(screen.getByText('Tokens T')).toBeInTheDocument()
      expect(screen.getByText('Head dim d')).toBeInTheDocument()
      expect(screen.getByText('Score tile')).toBeInTheDocument()
      expect(screen.queryByText(DEFAULT_BYTES.score)).not.toBeInTheDocument()
      expect(screen.queryByText(DEFAULT_BYTES.qkv)).not.toBeInTheDocument()
      expect(screen.queryByText(DEFAULT_BYTES.tile)).not.toBeInTheDocument()
      expect(screen.queryByText(DEFAULT_BYTES.ratio)).not.toBeInTheDocument()
      expect(screen.getAllByText('Locked until reveal').length).toBeGreaterThanOrEqual(3)
      expect(screen.getAllByText('Computed after prediction').length).toBe(2)

      const dominantRow = screen.getByText('Dominant object').closest('div')
      expect(dominantRow).not.toBeNull()
      expect(within(dominantRow as HTMLElement).getByText('Locked until reveal')).toBeInTheDocument()

      const initial = latestSummary(observed)
      expect(initial).toEqual(
        expect.objectContaining({
          conceptId: 'flash-attention',
          values: expect.arrayContaining([
            'tokens: 2048',
            'head dim: 64',
            'tile: 128',
            'prediction: none',
            'merge prediction: none',
            'measured bytes: locked until reveal',
            'online softmax table: locked until reveal',
            'revealed: no',
          ]),
        })
      )

      const payload = JSON.stringify(initial)
      expect(payload).not.toContain(DEFAULT_BYTES.score)
      expect(payload).not.toContain(DEFAULT_BYTES.qkv)
      expect(payload).not.toContain(DEFAULT_BYTES.tile)
      expect(payload).not.toContain(DEFAULT_BYTES.ratio)
      expect(payload).not.toContain('actual dominant object')
      expect(payload).not.toContain('tile B old scale')
      expect(payload).not.toContain('tile B l')
      expect(payload).not.toContain('tile B out')
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, listener)
    }
  })

  it('reveals measured bytes and online-softmax state after predictions', async () => {
    const observed: DemoStateSummary[] = []
    const listener = ((event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && isSummary(detail)) observed.push(detail)
    }) as EventListener
    window.addEventListener(DEMO_STATE_EVENT, listener)

    try {
      render(<FlashAttentionConceptViz />)

      fireEvent.click(screen.getByRole('button', { name: 'T x T scores' }))
      fireEvent.click(screen.getByRole('button', { name: 'Rescale old l,o' }))
      fireEvent.click(screen.getByRole('button', { name: 'Reveal invariant' }))

      expect(await screen.findByRole('table', { name: 'Online softmax running state' })).toBeInTheDocument()
      expect(screen.getByText(DEFAULT_BYTES.score)).toBeInTheDocument()
      expect(screen.getByText(DEFAULT_BYTES.qkv)).toBeInTheDocument()
      expect(screen.getByText(DEFAULT_BYTES.tile)).toBeInTheDocument()
      expect(screen.getByText(DEFAULT_BYTES.ratio)).toBeInTheDocument()

      const dominantRow = screen.getByText('Dominant object').closest('div')
      expect(dominantRow).not.toBeNull()
      expect(within(dominantRow as HTMLElement).getByText('T x T scores')).toBeInTheDocument()

      await waitFor(() => {
        expect(observed.some((state) => state.values?.includes('revealed: yes'))).toBe(true)
      })

      const revealed = latestSummary(observed)
      expect(revealed.values).toEqual(
        expect.arrayContaining([
          'prediction: scores',
          'actual dominant object: T x T scores',
          'prediction correct: yes',
          'merge prediction: rescale',
          'merge rule actual: rescale old l,o',
          'merge prediction correct: yes',
          `naive score matrix: ${DEFAULT_BYTES.score}`,
          `QKV tensors: ${DEFAULT_BYTES.qkv}`,
          `single score tile: ${DEFAULT_BYTES.tile}`,
          `stored-score ratio: ${DEFAULT_BYTES.ratio}`,
          'revealed: yes',
        ])
      )
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, listener)
    }
  })

  it('clears reveal and returns emitted state to neutral when controls or predictions change', async () => {
    const observed: DemoStateSummary[] = []
    const listener = ((event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && isSummary(detail)) observed.push(detail)
    }) as EventListener
    window.addEventListener(DEMO_STATE_EVENT, listener)

    try {
      render(<FlashAttentionConceptViz />)

      fireEvent.click(screen.getByRole('button', { name: 'T x T scores' }))
      fireEvent.click(screen.getByRole('button', { name: 'Rescale old l,o' }))
      fireEvent.click(screen.getByRole('button', { name: 'Reveal invariant' }))
      expect(await screen.findByRole('table', { name: 'Online softmax running state' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: '4096' }))
      expect(screen.queryByRole('table', { name: 'Online softmax running state' })).not.toBeInTheDocument()
      expect(screen.queryByText(DEFAULT_BYTES.score)).not.toBeInTheDocument()

      await waitFor(() => {
        const latest = latestSummary(observed)
        expect(latest.values).toEqual(expect.arrayContaining(['tokens: 4096', 'revealed: no']))
      })

      let latest = latestSummary(observed)
      let payload = JSON.stringify(latest)
      expect(payload).not.toContain(DEFAULT_BYTES.score)
      expect(payload).not.toContain(DEFAULT_BYTES.qkv)
      expect(payload).not.toContain(DEFAULT_BYTES.tile)
      expect(payload).not.toContain(DEFAULT_BYTES.ratio)
      expect(payload).not.toContain('actual dominant object')

      fireEvent.click(screen.getByRole('button', { name: 'Reveal invariant' }))
      expect(await screen.findByRole('table', { name: 'Online softmax running state' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'About tied' }))
      expect(screen.queryByRole('table', { name: 'Online softmax running state' })).not.toBeInTheDocument()

      await waitFor(() => {
        const next = latestSummary(observed)
        expect(next.values).toEqual(expect.arrayContaining(['prediction: same', 'revealed: no']))
      })

      latest = latestSummary(observed)
      payload = JSON.stringify(latest)
      expect(payload).not.toContain(DEFAULT_BYTES.score)
      expect(payload).not.toContain(DEFAULT_BYTES.qkv)
      expect(payload).not.toContain(DEFAULT_BYTES.tile)
      expect(payload).not.toContain(DEFAULT_BYTES.ratio)
      expect(payload).not.toContain('actual dominant object')
      expect(payload).not.toContain('tile B old scale')
      expect(payload).not.toContain('tile B l')
      expect(payload).not.toContain('tile B out')
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, listener)
    }
  })
})
