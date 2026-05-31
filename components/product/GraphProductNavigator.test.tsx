import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { LearningRouteProgress, LearningRouteSnapshot } from '@/lib/learningRouteSnapshot'
import {
  clearLearningRouteSnapshot,
  getSavedLearningRouteSnapshot,
  saveLearningRouteSnapshot,
} from '@/lib/learningRouteSnapshot'
import { clearLocalObjectActionJournal, saveLocalObjectActionDraft } from '@/lib/localObjectActionJournal'
import GraphProductNavigator, { preserveMatchingObservation } from './GraphProductNavigator'

const flashEquationObjectKey = 'equation:attention-transformers/flash-attention#math-object-1'

const mockReplace = jest.fn()
let mockRouter = {
  isReady: true,
  query: {} as Record<string, string>,
  replace: mockReplace,
}

jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}))

function routeProgress(overrides: Partial<LearningRouteProgress> = {}): LearningRouteProgress {
  return {
    version: 'cf-route-progress-v1',
    stageReadiness: [
      {
        stageId: 'attention',
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
        label: 'Public trail started',
        status: 'saved',
        updatedAt: '2026-05-11T00:00:00.000Z',
      },
      {
        id: 'kv-memory-prediction',
        label: 'KV memory prediction',
        status: 'pending',
      },
    ],
    resolvedObjectIds: ['equation/attention-serving/kv-memory-symbol'],
    nextRepair: 'RoPE',
    updatedAt: '2026-05-11T00:05:00.000Z',
    ...overrides,
  }
}

function snapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  return {
    version: 'cf-route-snapshot-v1',
    source: 'graph',
    paperTitle: 'Graph route snapshot',
    inputKind: 'learning question',
    mappingId: 'kv-cache',
    routeLabels: ['Attention', 'Efficient Attention', 'RoPE'],
    routeConceptIds: ['attention-transformers', 'efficient-attention', 'rope'],
    createdAt: '2026-05-11T00:00:00.000Z',
    ...overrides,
  }
}

describe('preserveMatchingObservation', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    mockReplace.mockClear()
    mockRouter = {
      isReady: true,
      query: {},
      replace: mockReplace,
    }
    clearLearningRouteSnapshot()
    clearLocalObjectActionJournal()
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      const message = args.map((arg) => String(arg)).join(' ')
      if (message.includes('non-boolean attribute') && message.includes('jsx')) return
      if (message.includes('Not implemented: navigation')) return
      originalConsoleError(...args)
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('keeps previous route progress when saving a matching graph route without routeProgress', () => {
    const previousProgress = routeProgress()
    const previousSnapshot = snapshot({
      source: 'attention-serving',
      routeProgress: previousProgress,
    })
    const nextSnapshot = snapshot({
      source: 'graph',
      routeProgress: undefined,
    })

    const merged = preserveMatchingObservation(nextSnapshot, previousSnapshot)

    expect(merged.routeProgress).toEqual(previousProgress)
    expect(merged.routeProgress?.stageReadiness).toEqual(previousProgress.stageReadiness)
    expect(merged.routeProgress?.checkpoints).toEqual(previousProgress.checkpoints)
  })

  it('uses the next snapshot route progress when it already exists', () => {
    const previousSnapshot = snapshot({
      source: 'attention-serving',
      routeProgress: routeProgress(),
    })
    const nextProgress = routeProgress({
      stageReadiness: [
        {
          stageId: 'rope',
          label: 'RoPE',
          status: 'ready',
          updatedAt: '2026-05-11T01:00:00.000Z',
        },
      ],
      checkpoints: [
        {
          id: 'graph-route-saved',
          label: 'Graph route saved',
          status: 'saved',
          updatedAt: '2026-05-11T01:00:00.000Z',
        },
      ],
      resolvedObjectIds: ['concept/attention-transformers/rope'],
      nextRepair: 'FlashAttention',
      updatedAt: '2026-05-11T01:00:00.000Z',
    })
    const nextSnapshot = snapshot({
      source: 'graph',
      routeProgress: nextProgress,
    })

    const merged = preserveMatchingObservation(nextSnapshot, previousSnapshot)

    expect(merged.routeProgress).toEqual(nextProgress)
  })

  it('renders a route workbench with learner, researcher, experimenter, and professor moves', () => {
    render(<GraphProductNavigator />)

    expect(screen.getByTestId('graph-route-workbench')).toBeInTheDocument()
    expect(screen.getByText('Learner Repair')).toBeInTheDocument()
    expect(screen.getByText('Researcher Object')).toBeInTheDocument()
    expect(screen.getByText('Experimenter Lab')).toBeInTheDocument()
    expect(screen.getByText('Professor Edge')).toBeInTheDocument()

    const repairLink = screen.getByRole('link', { name: 'Open Efficient Attention' })
    expect(repairLink.getAttribute('href')).toContain('/domains/attention-transformers/efficient-attention')
    expect(screen.getByRole('link', { name: 'Open research room' })).toHaveAttribute('href', '#graph-route-research-room')
    expect(screen.getByRole('link', { name: 'Search lab bridge' }).getAttribute('href')).toContain('/search/')
    expect(screen.getByRole('link', { name: 'Explain edge' })).toHaveAttribute('href', '#edge-title')
  })

  it('renders compact carried-route actions and clears graph query state', async () => {
    mockRouter = {
      isReady: true,
      query: { route: 'kv-cache', from: 'search' },
      replace: mockReplace,
    }
    saveLearningRouteSnapshot(
      snapshot({
        source: 'attention-serving',
        paperClueLabel: 'Attention to serving',
        currentQuestion: 'How does attention become a serving bottleneck?',
        nextRepair: 'Efficient Attention',
        routeConcepts: [
          {
            label: 'Attention',
            href: '/domains/attention-transformers/attention-transformers/',
          },
          {
            label: 'Efficient Attention',
            href: '/domains/attention-transformers/efficient-attention/',
          },
        ],
        currentObject: {
          type: 'concept',
          id: 'attention-transformers',
          title: 'Attention',
          href: '/domains/attention-transformers/attention-transformers/',
          role: 'Start with the weighted-copy equation.',
          status: 'first concept',
          confidence: 'high',
        },
        routeProgress: routeProgress(),
      })
    )

    render(<GraphProductNavigator />)

    expect(await screen.findByRole('link', { name: 'Open Efficient Attention' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/efficient-attention'
    )
    expect(screen.getByRole('link', { name: 'Search route' })).toHaveAttribute(
      'href',
      '/search?q=Efficient%20Attention&from=graph#route-search-lens'
    )
    expect(screen.getByRole('link', { name: 'Inspect object' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/attention-transformers'
    )

    fireEvent.click(screen.getByRole('button', { name: 'Clear route' }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()).toBeNull()
    })
    expect(mockReplace).toHaveBeenCalledWith('/graph/#learning-route', undefined, { shallow: true })
    expect(screen.queryByRole('link', { name: 'Open Efficient Attention' })).not.toBeInTheDocument()
  })

  it('surfaces a saved object action in the graph public cockpit', async () => {
    saveLearningRouteSnapshot(
      snapshot({
        source: 'concept-notebook',
        mappingId: 'concept:flash-attention',
        paperTitle: 'Concept notebook: FlashAttention',
        currentQuestion: 'Which slider tests the FlashAttention memory claim?',
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

    render(<GraphProductNavigator />)

    expect(await screen.findByText('Saved object action')).toBeInTheDocument()
    expect(screen.getByText('Answer the carried question: test the memory claim.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open saved action' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
  })

  it('previews a graph route query without clobbering a saved object action', async () => {
    mockRouter = {
      isReady: true,
      query: { route: 'kv-cache', from: 'search' },
      replace: mockReplace,
    }
    saveLearningRouteSnapshot(
      snapshot({
        source: 'concept-notebook',
        mappingId: 'concept:flash-attention',
        paperTitle: 'Concept notebook: FlashAttention',
        currentQuestion: 'Which slider tests the FlashAttention memory claim?',
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
      nextAction: 'Answer the carried question: keep the saved action visible.',
      updatedAt: '2026-05-11T00:00:00.000Z',
      source: 'research-reading-room',
    })

    render(<GraphProductNavigator />)

    expect(await screen.findByRole('heading', { name: 'A paper claims it compresses the KV cache. What should I inspect?' })).toBeInTheDocument()
    expect(screen.getByText('Saved object action')).toBeInTheDocument()
    expect(screen.getByText('Answer the carried question: keep the saved action visible.')).toBeInTheDocument()
    expect(getSavedLearningRouteSnapshot()?.mappingId).toBe('concept:flash-attention')
    expect(screen.getByRole('link', { name: 'Open saved action' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
  })
})
