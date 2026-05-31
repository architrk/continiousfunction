import { act, fireEvent, render, screen, within } from '@testing-library/react'
import {
  clearLearningRouteSnapshot,
  getSavedLearningRouteSnapshot,
  saveLearningRouteSnapshot,
  type LearningRouteSnapshot,
} from '@/lib/learningRouteSnapshot'
import { clearLocalObjectActionJournal, saveLocalObjectActionDraft } from '@/lib/localObjectActionJournal'
import HomeResumeRoutePanel from './HomeResumeRoutePanel'

const flashEquationObjectKey = 'equation:attention-transformers/flash-attention#math-object-1'

function baseSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  return {
    version: 'cf-route-snapshot-v1',
    source: 'concept-notebook',
    paperTitle: 'Concept notebook: Efficient Attention',
    inputKind: 'concept notebook',
    mappingId: 'concept:efficient-attention',
    mappingTitle: 'Efficient Attention Route',
    routeLabels: ['Attention', 'Efficient Attention', 'Long Context'],
    routeConceptIds: ['attention-transformers', 'efficient-attention', 'long-context'],
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
    nextRepair: 'Efficient Attention',
    currentQuestion: 'How do I reduce memory while keeping quality?',
    currentObject: {
      type: 'concept',
      id: 'efficient-attention',
      title: 'Efficient Attention',
      href: '/domains/attention-transformers/efficient-attention/',
      status: 'active',
    },
    createdAt: '2026-05-04T00:00:00.000Z',
    ...overrides,
  }
}

function attentionServingSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  return {
    version: 'cf-route-snapshot-v1',
    source: 'attention-serving',
    paperTitle: 'Public trail: attention to serving',
    paperClueLabel: 'Attention to serving',
    inputKind: 'public local learning trail',
    mappingId: 'kv-cache',
    mappingTitle: 'Attention to Serving',
    routeLabels: ['Attention', 'Efficient Attention', 'RoPE', 'FlashAttention', 'Long Context', 'LLM Serving', 'Decoding'],
    routeConceptIds: [
      'attention-transformers',
      'efficient-attention',
      'rope',
      'flash-attention',
      'long-context',
      'llm-serving',
      'decoding-sampling',
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
    createdAt: '2026-05-08T00:00:00.000Z',
    ...overrides,
  }
}

function compactCockpit() {
  const panel = screen.getByLabelText('Resume saved learning route')
  const cockpit = panel.querySelector('.continuity-banner')
  if (!(cockpit instanceof HTMLElement)) throw new Error('Expected compact continuity banner to render')
  return within(cockpit)
}

function compactNextAction() {
  const panel = screen.getByLabelText('Resume saved learning route')
  const nextAction = panel.querySelector('.continuity-banner .next-action-card')
  if (!(nextAction instanceof HTMLElement)) throw new Error('Expected compact next action card to render')
  return within(nextAction)
}

describe('HomeResumeRoutePanel', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      const message = args.map((arg) => String(arg)).join(' ')
      if (message.includes('non-boolean attribute') && message.includes('jsx')) return
      if (message.includes('Not implemented: navigation')) return
      originalConsoleError(...args)
    })
    clearLearningRouteSnapshot()
    clearLocalObjectActionJournal()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('shows compact local progress metadata for the saved route', async () => {
    saveLearningRouteSnapshot(
      baseSnapshot({
        routeProgress: {
          version: 'cf-route-progress-v1',
          stageReadiness: [
            {
              stageId: 'attention',
              label: 'Attention',
              status: 'ready',
              updatedAt: '2026-05-06T00:00:00.000Z',
            },
            {
              stageId: 'efficient-attention',
              label: 'Efficient Attention',
              status: 'active',
            },
          ],
          checkpoints: [
            {
              id: 'memory-prediction',
              label: 'Memory prediction',
              status: 'saved',
              updatedAt: '2026-05-06T00:00:00.000Z',
            },
          ],
          resolvedObjectIds: ['equation/attention-serving/kv-memory-symbol'],
          updatedAt: '2026-05-06T00:00:00.000Z',
        },
      })
    )

    render(<HomeResumeRoutePanel />)

    expect(await screen.findByText('Local progress')).toBeInTheDocument()
    const cockpit = compactCockpit()
    expect(cockpit.getByText('1/2 stages ready')).toBeInTheDocument()
    expect(screen.getByText(/1 checkpoint saved/)).toBeInTheDocument()
    expect(screen.getByText(/1 object resolved/)).toBeInTheDocument()
    expect(screen.getByText(/Last active/)).toBeInTheDocument()
  })

  it('resurfaces a saved object action in the home cockpit', async () => {
    saveLearningRouteSnapshot(
      baseSnapshot({
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

    render(<HomeResumeRoutePanel />)

    expect(await screen.findByText('Saved object action')).toBeInTheDocument()
    expect(screen.getByText('Answer the carried question: test the memory claim.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open saved action' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
  })

  it('offers a public local starter trail before any account-backed progress exists', async () => {
    render(<HomeResumeRoutePanel />)

    expect(await screen.findByRole('heading', { name: /Start with a path this browser can remember/i })).toBeInTheDocument()
    expect(
      screen.getByText('Attention -> Efficient Attention -> RoPE -> FlashAttention -> Long Context -> LLM Serving -> Decoding')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Start local trail' }))

    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.source).toBe('attention-serving')
    expect(snapshot?.mappingId).toBe('kv-cache')
    expect(snapshot?.routeLabels).toEqual([
      'Attention',
      'Efficient Attention',
      'RoPE',
      'FlashAttention',
      'Long Context',
      'LLM Serving',
      'Decoding',
    ])
    expect(snapshot?.routeConceptIds).toEqual([
      'attention-transformers',
      'efficient-attention',
      'rope',
      'flash-attention',
      'long-context',
      'llm-serving',
      'decoding-sampling',
    ])
    expect(snapshot?.routeProgress?.stageReadiness).toHaveLength(7)
    expect(snapshot?.routeProgress?.stageReadiness?.map((stage) => stage.status)).toEqual([
      'ready',
      'active',
      'not-started',
      'not-started',
      'needs-repair',
      'needs-repair',
      'not-started',
    ])
    expect(snapshot?.routeProgress?.checkpoints?.[0]).toMatchObject({
      id: 'public-trail-started',
      status: 'saved',
    })
    expect(snapshot?.routeProgress?.checkpoints?.[1]).toMatchObject({
      id: 'kv-memory-prediction',
      status: 'pending',
    })
    expect(await screen.findByRole('heading', { name: 'How does attention become a serving bottleneck?' })).toBeInTheDocument()
    const cockpit = compactCockpit()
    expect(cockpit.getByText('1/7 stages ready')).toBeInTheDocument()
    expect(cockpit.getByText('Now: Efficient Attention')).toBeInTheDocument()
    const nextAction = compactNextAction()
    expect(nextAction.getByText('Continue route')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Search route' })).toHaveAttribute(
      'href',
      '/search?q=Efficient%20Attention&from=home#route-search-lens'
    )
    expect(cockpit.queryByRole('link', { name: 'Open KV memory lab' })).not.toBeInTheDocument()
  })

  it('keeps lab-oriented next action when a saved observation already exists', async () => {
    saveLearningRouteSnapshot(
      attentionServingSnapshot({
        lastObservation: {
          label: 'KV memory prediction',
          value: 'Reducing kv heads lowers cache size.',
          nextQuestion: 'Now compare grouped-query attention to multi-query.',
          source: 'kv-memory-lab',
          updatedAt: '2026-05-08T01:00:00.000Z',
        },
      })
    )

    render(<HomeResumeRoutePanel />)

    expect(await screen.findByRole('heading', { name: 'How does attention become a serving bottleneck?' })).toBeInTheDocument()
    const nextAction = compactNextAction()
    expect(nextAction.getByText('Open KV memory lab')).toBeInTheDocument()
    expect(nextAction.getByText('Now compare grouped-query attention to multi-query.')).toBeInTheDocument()
    expect(compactCockpit().getByRole('link', { name: 'Open KV memory lab' })).toBeInTheDocument()
  })

  it('keeps route-first next action after graph updates when no lab observation is saved', async () => {
    saveLearningRouteSnapshot(
      attentionServingSnapshot({
        source: 'graph',
      })
    )

    render(<HomeResumeRoutePanel />)

    expect(await screen.findByRole('heading', { name: 'How does attention become a serving bottleneck?' })).toBeInTheDocument()
    const nextAction = compactNextAction()
    expect(nextAction.getByText('Continue route')).toBeInTheDocument()
    expect(nextAction.queryByText('Open KV memory lab')).not.toBeInTheDocument()
    const cockpit = compactCockpit()
    expect(cockpit.getByRole('link', { name: 'Continue route' })).toBeInTheDocument()
    expect(cockpit.queryByRole('link', { name: 'Open KV memory lab' })).not.toBeInTheDocument()
  })

  it('refreshes the home panel when a new snapshot is saved during the session', async () => {
    saveLearningRouteSnapshot(
      baseSnapshot({
        currentQuestion: 'Question A',
        routeProgress: {
          version: 'cf-route-progress-v1',
          stageReadiness: [
            {
              stageId: 'attention',
              label: 'Attention',
              status: 'ready',
            },
          ],
          updatedAt: '2026-05-06T00:00:00.000Z',
        },
      })
    )

    render(<HomeResumeRoutePanel />)

    expect(await screen.findByRole('heading', { name: 'Question A' })).toBeInTheDocument()

    act(() => {
      saveLearningRouteSnapshot(
        baseSnapshot({
          currentQuestion: 'Question B',
          routeProgress: {
            version: 'cf-route-progress-v1',
            stageReadiness: [
              {
                stageId: 'long-context',
                label: 'Long Context',
                status: 'not-started',
              },
            ],
            updatedAt: '2026-05-07T00:00:00.000Z',
          },
        })
      )
    })

    expect(await screen.findByRole('heading', { name: 'Question B' })).toBeInTheDocument()
    expect(compactCockpit().getByText('0/1 stages ready')).toBeInTheDocument()
  })

  it('clears the local panel immediately when the clear action is used', async () => {
    saveLearningRouteSnapshot(baseSnapshot({ currentQuestion: 'Clear me' }))

    render(<HomeResumeRoutePanel />)

    expect(await screen.findByRole('heading', { name: 'Clear me' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear route' }))

    expect(getSavedLearningRouteSnapshot()).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Clear me' })).not.toBeInTheDocument()
  })
})
