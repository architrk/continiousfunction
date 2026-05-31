import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DEMO_STATE_EVENT, formatDemoStateForPrompt, type DemoStateSummary } from '@/lib/demoState'
import KTOViz from './KTOViz'

describe('KTOViz', () => {
  it('does not seed shared demo state unless emission is enabled', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      observed.push((event as CustomEvent<DemoStateSummary>).detail)
    }

    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<KTOViz conceptId="kto-test" />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))
      expect(observed).toHaveLength(0)
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('emits measured KTO state for route handoff', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      observed.push((event as CustomEvent<DemoStateSummary>).detail)
    }

    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<KTOViz conceptId="kto-test" emitState />)

      await waitFor(() => {
        expect(observed.some((state) => state.conceptId === 'kto-test')).toBe(true)
      })

      const initialState = observed[observed.length - 1]
      expect(initialState).toEqual(
        expect.objectContaining({
          conceptId: 'kto-test',
          label: 'KTO state',
          summary: expect.stringContaining('label=desirable; delta=-0.200'),
        })
      )
      expect(initialState.values).toEqual(
        expect.arrayContaining([
          'r_theta=0.200',
          'z0=0.400',
          'loss=0.510',
          'dL/dr=-0.050',
          'saturation=high-gradient',
        ])
      )
      expect(initialState.values).toHaveLength(6)
      expect(formatDemoStateForPrompt(initialState)).toContain('gd=increase r_theta')
      expect(formatDemoStateForPrompt(initialState).length).toBeLessThan(260)

      fireEvent.click(screen.getByLabelText('undesirable'))

      await waitFor(() => {
        const latestState = observed[observed.length - 1]
        expect(latestState.summary).toContain('label=undesirable; delta=-0.200')
        expect(latestState.values).toEqual(
          expect.arrayContaining([
            'r_theta=0.200',
            'z0=0.400',
            'target=negative delta',
            'dL/dr=0.050',
          ])
        )
        expect(formatDemoStateForPrompt(latestState)).toContain('gd=decrease r_theta')
        expect(formatDemoStateForPrompt(latestState).length).toBeLessThan(260)
      })
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })
})
