import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import DiffusionScoreViz from './DiffusionScoreViz'
import { DEMO_STATE_EVENT, type DemoStateEventDetail, type DemoStateSummary } from '@/lib/demoState'

function isSummary(detail: DemoStateEventDetail): detail is DemoStateSummary {
  return !('cleared' in detail)
}

describe('DiffusionScoreViz', () => {
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

  it('does not leak the hidden DSM target into demo state before reveal', async () => {
    const events: DemoStateEventDetail[] = []
    const listener = ((event: Event) => {
      events.push((event as CustomEvent<DemoStateEventDetail>).detail)
    }) as EventListener
    window.addEventListener(DEMO_STATE_EVENT, listener)

    const { unmount } = render(<DiffusionScoreViz chrome="notebook" conceptId="score-matching" />)

    await waitFor(() => {
      expect(events.filter(isSummary).length).toBeGreaterThan(0)
    })

    const initial = events.filter(isSummary).at(-1)
    expect(initial).toEqual(
      expect.objectContaining({
        conceptId: 'score-matching',
        values: [
          'schedule: cosine',
          expect.stringMatching(/^alpha_bar: /),
          expect.stringMatching(/^sigma sqrt\(1-alpha_bar\): /),
          expect.stringMatching(/^probe id: /),
          'prediction: none',
          'revealed: no',
        ],
      })
    )
    expect(JSON.stringify(initial)).not.toContain('actual: against-noise')
    expect(JSON.stringify(initial)).not.toContain('conditional target magnitude')
    expect(JSON.stringify(initial)).not.toContain('marginal score at probe')
    expect(JSON.stringify(initial)).not.toContain('points against the injected noise')
    expect(screen.queryByText(/conditional target = -/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Against injected noise' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal target' }))

    await waitFor(() => {
      expect(
        events
          .filter(isSummary)
          .some((detail) => detail.values?.includes('actual: against-noise'))
      ).toBe(true)
    })

    const revealed = events.filter(isSummary).at(-1)
    expect(revealed?.values).toEqual(
      expect.arrayContaining([
        'prediction: against-noise',
        'actual: against-noise',
        'correct: yes',
        expect.stringMatching(/^conditional target magnitude: /),
        expect.stringMatching(/^marginal score at probe: /),
      ])
    )
    expect(screen.getByText(/conditional target = -/i)).toBeInTheDocument()

    unmount()
    window.removeEventListener(DEMO_STATE_EVENT, listener)
  })
})
