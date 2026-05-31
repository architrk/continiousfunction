import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'fs'
import path from 'path'
import { DEMO_STATE_EVENT, type DemoStateEventDetail, type DemoStateSummary } from '@/lib/demoState'
import TreeSearchReasoningViz from './TreeSearchReasoningViz'

describe('TreeSearchReasoningViz prediction reveal', () => {
  it('hides backed-up answer, node values, correctness, and DOM selected path before reveal', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<TreeSearchReasoningViz />)
      await new Promise((resolve) => window.setTimeout(resolve, 0))

      expect(observed).toHaveLength(0)
      expect(screen.getByRole('button', { name: /Reveal backed-up path/ })).toBeDisabled()
      expect(screen.getByText('hidden correctness locked')).toBeInTheDocument()
      expect(screen.queryByLabelText(/show hidden correctness/i)).not.toBeInTheDocument()
      expect(screen.queryByText('root -> C -> C1 -> C1a')).not.toBeInTheDocument()
      expect(screen.queryByText('hidden truth: correct')).not.toBeInTheDocument()
      expect(screen.queryByText('hidden truth: wrong')).not.toBeInTheDocument()
      expect(document.querySelector('.demo')?.getAttribute('data-selected-path')).toBeNull()
      expect(document.querySelector('.node.selected')).toBeNull()
      expect(screen.getAllByText('hidden').length).toBeGreaterThanOrEqual(6)

      fireEvent.click(screen.getByRole('button', { name: /C: expanded algebra branch wins/ }))
      expect(screen.getByRole('button', { name: /Reveal backed-up path/ })).toBeEnabled()
      expect(observed).toHaveLength(0)
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('reveals the clean verifier C-branch backup and emits compact measured state', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<TreeSearchReasoningViz />)

      fireEvent.click(screen.getByRole('button', { name: /C: expanded algebra branch wins/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal backed-up path/ }))

      expect(screen.getByText('root -> C -> C1 -> C1a')).toBeInTheDocument()
      expect(document.querySelector('.result')?.textContent).toContain('Actual recommendation: C')
      expect(screen.getByLabelText(/show hidden correctness/i)).toBeInTheDocument()
      expect(document.querySelector('.node.selected')).not.toBeNull()
      expect(document.querySelector('.backupScores')?.textContent).toContain('A: r(A) + V(A)-1.50')
      expect(document.querySelector('.backupScores')?.textContent).toContain('B: r(B) + V(B)1.70')
      expect(document.querySelector('.backupScores')?.textContent).toContain('C: r(C) + V(C)2.40')

      await waitFor(() => {
        expect(observed.some((state) => state.conceptId === 'tree-search-reasoning')).toBe(true)
      })

      const latest = observed[observed.length - 1]
      expect(latest.label).toBe('Prefix-tree max-backup prediction reveal')
      expect(latest.summary).toContain('clean verifier, budget 2')
      expect(latest.summary).toContain('learner predicted C')
      expect(latest.summary).toContain('max backup selected root -> C -> C1 -> C1a')
      expect(latest.values).toEqual(
        expect.arrayContaining([
          'verifier mode: clean',
          'learner prediction: C',
          'expected root branch: C',
          'prediction correct: yes',
          'selected path: root -> C -> C1 -> C1a',
          'selected terminal: C1a',
          'hidden correctness: hidden',
        ])
      )

      fireEvent.click(screen.getByLabelText(/show hidden correctness/i))
      expect(await screen.findByText('hidden truth: correct')).toBeInTheDocument()
      await waitFor(() => {
        expect(observed[observed.length - 1].values).toContain('selected terminal correctness: correct')
      })

      fireEvent.click(screen.getByLabelText(/show hidden correctness/i))
      await waitFor(() => {
        expect(observed[observed.length - 1].values).not.toContain('selected terminal correctness: correct')
      })
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('reveals noisy verifier false-positive amplification only after correctness is toggled', async () => {
    const observed: DemoStateSummary[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail && !('cleared' in detail)) observed.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<TreeSearchReasoningViz />)

      fireEvent.change(screen.getByLabelText(/verifier mode/i), { target: { value: 'noisy' } })
      fireEvent.click(screen.getByRole('button', { name: /A: shortcut branch wins/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal backed-up path/ }))

      expect(screen.getByText('root -> A -> A1')).toBeInTheDocument()
      expect(document.querySelector('.result')?.textContent).toContain('Actual recommendation: A')
      expect(screen.queryByText('hidden truth: wrong')).not.toBeInTheDocument()
      expect(document.querySelector('.backupScores')?.textContent).toContain('A: r(A) + V(A)2.80')
      expect(document.querySelector('.backupScores')?.textContent).toContain('B: r(B) + V(B)1.70')
      expect(document.querySelector('.backupScores')?.textContent).toContain('C: r(C) + V(C)2.40')

      await waitFor(() => {
        expect(observed.some((state) => state.summary.includes('noisy verifier, budget 2'))).toBe(true)
      })
      expect(observed[observed.length - 1].values).toContain('hidden correctness: hidden')

      fireEvent.click(screen.getByLabelText(/show hidden correctness/i))
      expect((await screen.findAllByText('hidden truth: wrong')).length).toBeGreaterThan(0)
      expect(screen.getByText(/amplified a verifier false positive/)).toBeInTheDocument()
      await waitFor(() => {
        expect(observed[observed.length - 1].values).toContain('selected terminal correctness: wrong')
      })
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('clears stale revealed state when the budget changes', async () => {
    const events: DemoStateEventDetail[] = []
    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail) events.push(detail)
    }
    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)

    try {
      render(<TreeSearchReasoningViz />)

      fireEvent.click(screen.getByRole('button', { name: /C: expanded algebra branch wins/ }))
      fireEvent.click(screen.getByRole('button', { name: /Reveal backed-up path/ }))
      expect(await screen.findByText('root -> C -> C1 -> C1a')).toBeInTheDocument()

      const clearsBefore = events.filter((event) => 'cleared' in event).length
      fireEvent.change(screen.getByLabelText(/prefix expansions after root/i), { target: { value: '3' } })

      await waitFor(() => {
        expect(events.filter((event) => 'cleared' in event).length).toBeGreaterThan(clearsBefore)
      })
      expect(screen.queryByText('root -> C -> C1 -> C1a')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reveal backed-up path/ })).toBeDisabled()
      expect(screen.queryByLabelText(/show hidden correctness/i)).not.toBeInTheDocument()
      expect(document.querySelector('.node.selected')).toBeNull()
    } finally {
      window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
    }
  })

  it('keeps the Interactive Demo copy from pre-announcing clean or noisy outcomes', () => {
    const mdx = readFileSync(
      path.join(process.cwd(), 'content/domains/scaling/concepts/tree-search-reasoning/content.mdx'),
      'utf8'
    )
    const interactiveDemo = mdx.split('## Interactive Demo')[1]

    expect(interactiveDemo).toBeTruthy()
    expect(interactiveDemo).not.toContain('backs up a correct algebra path')
    expect(interactiveDemo).not.toContain('invalid shortcut attractive')
    expect(interactiveDemo).toContain('predict which root branch')
  })
})
