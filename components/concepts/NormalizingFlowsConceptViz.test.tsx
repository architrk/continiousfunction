import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import NormalizingFlowsConceptViz from '../../content/domains/generative-models/concepts/normalizing-flows/viz'
import { DEMO_STATE_EVENT, type DemoStateEventDetail, type DemoStateSummary } from '@/lib/demoState'

function isSummary(detail: DemoStateEventDetail): detail is DemoStateSummary {
  return !('cleared' in detail)
}

describe('NormalizingFlowsConceptViz', () => {
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

  it('does not leak hidden likelihood terms into demo state before reveal', async () => {
    const events: DemoStateEventDetail[] = []
    const listener = ((event: Event) => {
      events.push((event as CustomEvent<DemoStateEventDetail>).detail)
    }) as EventListener
    window.addEventListener(DEMO_STATE_EVENT, listener)

    const { unmount } = render(<NormalizingFlowsConceptViz />)

    await waitFor(() => {
      expect(events.filter(isSummary).length).toBeGreaterThan(0)
    })

    const initial = events.filter(isSummary).at(-1)
    expect(initial).toEqual(
      expect.objectContaining({
        conceptId: 'normalizing-flows',
        values: ['transform: wide stretch', 'probe: near mode', 'prediction: none', 'revealed: no'],
      })
    )
    expect(JSON.stringify(initial)).not.toContain('det(A):')
    expect(JSON.stringify(initial)).not.toContain('log p_z')
    expect(JSON.stringify(initial)).not.toContain('log p_x')
    expect(JSON.stringify(initial)).not.toContain('log |det A^-1|')

    fireEvent.click(screen.getByRole('button', { name: 'density decreases' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal likelihood' }))

    await waitFor(() => {
      expect(
        events
          .filter(isSummary)
          .some((detail) => detail.values?.some((value) => value.startsWith('log |det A^-1|:')))
      ).toBe(true)
    })

    const revealed = events.filter(isSummary).at(-1)
    expect(revealed?.values).toEqual(
      expect.arrayContaining([
        'prediction: decrease',
        'actual: decrease',
        'correct: yes',
        expect.stringMatching(/^det\(A\): /),
        expect.stringMatching(/^log p_x\(x\): /),
      ])
    )

    unmount()
    window.removeEventListener(DEMO_STATE_EVENT, listener)
  })
})
