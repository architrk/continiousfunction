import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  clearLearningRouteSnapshot,
  getSavedLearningRouteSnapshot,
  saveLearningRouteSnapshot,
  type LearningRouteSnapshot,
} from '@/lib/learningRouteSnapshot'
import { clearLocalObjectActionJournal, saveLocalObjectActionDraft } from '@/lib/localObjectActionJournal'
import SearchRouteBridge from './SearchRouteBridge'

const flashEquationObjectKey = 'equation:attention-transformers/flash-attention#math-object-1'

function attentionServingSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  return {
    version: 'cf-route-snapshot-v1',
    source: 'attention-serving',
    paperTitle: 'Public trail: attention to serving',
    paperClueLabel: 'Attention to serving',
    inputKind: 'public local learning trail',
    mappingId: 'kv-cache',
    mappingTitle: 'Attention to Serving',
    routeLabels: ['Attention', 'Efficient Attention', 'RoPE', 'FlashAttention'],
    routeConceptIds: ['attention-transformers', 'efficient-attention', 'rope', 'flash-attention'],
    routeConcepts: [
      {
        label: 'Attention',
        href: '/domains/attention-transformers/attention-transformers/',
        role: 'Start with weighted copying.',
      },
      {
        label: 'Efficient Attention',
        href: '/domains/attention-transformers/efficient-attention/',
        role: 'Connect attention math to memory movement.',
      },
    ],
    nextRepair: 'Efficient Attention',
    currentQuestion: 'How does attention become a serving bottleneck?',
    labGoal: 'Predict which KV-cache term changes memory before opening the lab.',
    labStatus: 'live',
    currentObject: {
      type: 'concept',
      id: 'attention-transformers',
      title: 'Attention',
      href: '/domains/attention-transformers/attention-transformers/',
      role: 'Start with the weighted-copy equation.',
      status: 'first concept',
      confidence: 'high',
    },
    routeProgress: {
      version: 'cf-route-progress-v1',
      stageReadiness: [
        {
          stageId: 'attention-transformers',
          label: 'Attention',
          status: 'ready',
          updatedAt: '2026-05-11T00:00:00.000Z',
        },
        {
          stageId: 'efficient-attention',
          label: 'Efficient Attention',
          status: 'active',
          updatedAt: '2026-05-11T00:05:00.000Z',
        },
      ],
      checkpoints: [
        {
          id: 'public-trail-started',
          label: 'Trail started',
          status: 'saved',
          updatedAt: '2026-05-11T00:00:00.000Z',
        },
      ],
      nextRepair: 'Efficient Attention',
      updatedAt: '2026-05-11T00:05:00.000Z',
    },
    createdAt: '2026-05-11T00:00:00.000Z',
    ...overrides,
  }
}

describe('SearchRouteBridge', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      const message = args.map((arg) => String(arg)).join(' ')
      if (message.includes('non-boolean attribute') && message.includes('jsx')) return
      originalConsoleError(...args)
    })
    clearLearningRouteSnapshot()
    clearLocalObjectActionJournal()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('stays hidden until a browser-local route exists', () => {
    render(<SearchRouteBridge />)

    expect(screen.queryByLabelText('Saved route search lens')).not.toBeInTheDocument()
  })

  it('shows a saved route lens with search chips and a search-surface graph action', async () => {
    const onSelectQuery = jest.fn()
    saveLearningRouteSnapshot(attentionServingSnapshot())

    render(<SearchRouteBridge onSelectQuery={onSelectQuery} />)

    expect(await screen.findByLabelText('Saved route search lens')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Search inside the route you already started.' })).toBeInTheDocument()
    expect(screen.getByText('1/2 stages ready')).toBeInTheDocument()
    expect(screen.getByText('Now: Efficient Attention')).toBeInTheDocument()

    const continueRoute = screen.getByRole('link', { name: 'Continue graph route' })
    expect(continueRoute).toHaveAttribute('href', '/graph?route=kv-cache&from=search#learning-route')

    fireEvent.click(screen.getByRole('button', { name: 'Efficient Attention' }))

    expect(onSelectQuery).toHaveBeenCalledWith('Efficient Attention')
    expect(getSavedLearningRouteSnapshot()?.mappingId).toBe('kv-cache')
  })

  it('clears the search route lens and removes localStorage from the compact cockpit', async () => {
    saveLearningRouteSnapshot(attentionServingSnapshot())

    render(<SearchRouteBridge />)

    expect(await screen.findByLabelText('Saved route search lens')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear route' }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()).toBeNull()
    })
    expect(screen.queryByLabelText('Saved route search lens')).not.toBeInTheDocument()
  })

  it('refreshes when another surface saves a route during the session', async () => {
    render(<SearchRouteBridge />)

    expect(screen.queryByLabelText('Saved route search lens')).not.toBeInTheDocument()

    act(() => {
      saveLearningRouteSnapshot(attentionServingSnapshot())
    })

    expect(await screen.findByLabelText('Saved route search lens')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'FlashAttention' })).toBeInTheDocument()
  })

  it('shows a saved object action in the search route lens', async () => {
    saveLearningRouteSnapshot(
      attentionServingSnapshot({
        source: 'concept-notebook',
        mappingId: 'concept:flash-attention',
        currentObject: {
          type: 'equation',
          id: 'equation-1',
          objectKey: flashEquationObjectKey,
          title: 'FlashAttention equation 1',
          href: '/domains/attention-transformers/flash-attention/#math-object-1',
          status: 'prediction checkpoint revealed',
        },
      })
    )
    saveLocalObjectActionDraft({
      version: 'cf-object-action-draft-v1',
      objectKey: flashEquationObjectKey,
      objectTitle: 'FlashAttention equation 1',
      note: 'Prediction observation: use the memory slider as the next witness.',
      nextAction: 'Answer the carried question: test the memory claim.',
      updatedAt: '2026-05-11T00:00:00.000Z',
      source: 'research-reading-room',
    })

    render(<SearchRouteBridge />)

    expect(await screen.findByLabelText('Saved route search lens')).toBeInTheDocument()
    expect(screen.getByText('Saved object action')).toBeInTheDocument()
    expect(screen.getByText('Answer the carried question: test the memory claim.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open saved action' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
  })
})
