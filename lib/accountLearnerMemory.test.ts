import { buildAccountLearnerMemoryPreview } from './accountLearnerMemory'
import type { LearningRouteSnapshot } from './learningRouteSnapshot'

function sampleSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  return {
    version: 'cf-route-snapshot-v1',
    source: 'concept-notebook',
    paperTitle: 'Efficient Attention notebook',
    inputKind: 'concept',
    mappingId: 'concept:efficient-attention',
    mappingTitle: 'Efficient Attention',
    routeLabels: ['Attention', 'Efficient Attention', 'FlashAttention'],
    routeConceptIds: ['attention-transformers', 'efficient-attention', 'flash-attention'],
    currentQuestion: 'Which object explains why the cache changes memory movement?',
    currentObject: {
      type: 'equation',
      objectKey: 'equation:attention-transformers/efficient-attention#math-object-1',
      title: 'KV cache memory equation',
      href: '/domains/attention-transformers/efficient-attention/#math-object-1',
    },
    sourceObjects: [
      {
        type: 'source',
        objectKey: 'source:attention-transformers/efficient-attention#dao-flashattention-2022',
        title: 'FlashAttention source span',
        confidence: 'high',
      },
    ],
    routeProgress: {
      version: 'cf-route-progress-v1',
      stageReadiness: [
        { stageId: 'question', label: 'Question', status: 'ready' },
        { stageId: 'evidence', label: 'Evidence', status: 'active' },
      ],
      checkpoints: [{ id: 'prediction', label: 'Prediction', status: 'observed' }],
      updatedAt: '2026-05-22T00:00:00.000Z',
    },
    lastObservation: {
      label: 'Prediction checkpoint',
      value: 'Reducing KV heads shrinks the cache',
      detail: 'The query heads stayed fixed while the KV heads changed.',
      nextQuestion: 'Which term stays invariant?',
      source: 'prediction-checkpoint',
      updatedAt: '2026-05-22T00:00:00.000Z',
    },
    createdAt: '2026-05-22T00:00:00.000Z',
    ...overrides,
  }
}

describe('account learner memory preview', () => {
  it('explains the empty state without inventing durable memory', () => {
    const preview = buildAccountLearnerMemoryPreview(null)

    expect(preview.status).toBe('empty')
    expect(preview.writePlan).toEqual([])
    expect(preview.blockers[0].id).toBe('no-local-snapshot')
  })

  it('builds a ready account import preview from an exact selected equation object', () => {
    const preview = buildAccountLearnerMemoryPreview(sampleSnapshot())

    expect(preview.status).toBe('ready')
    expect(preview.routeObjectKey).toBe('route:domains/attention-transformers/efficient-attention')
    expect(preview.currentObject?.objectKey).toBe('equation:attention-transformers/efficient-attention#math-object-1')
    expect(preview.counts).toEqual({
      routeSteps: 3,
      sourceObjects: 1,
      readyStages: 2,
      savedCheckpoints: 1,
    })
    expect(preview.writePlan.map((item) => item.table)).toEqual(['learning_route_snapshots', 'learning_observations'])
    expect(preview.writePlan.every((item) => item.ready)).toBe(true)
  })

  it('blocks route import when the selected object has no content object key', () => {
    const preview = buildAccountLearnerMemoryPreview(
      sampleSnapshot({
        currentObject: {
          type: 'concept',
          title: 'Efficient Attention',
          href: '/domains/attention-transformers/efficient-attention/',
        },
      })
    )

    expect(preview.status).toBe('blocked')
    expect(preview.routeObjectKey).toBeUndefined()
    expect(preview.writePlan.every((item) => item.ready)).toBe(false)
    expect(preview.blockers.map((item) => item.id)).toEqual([
      'missing-route-object-key',
      'missing-current-object-key',
      'missing-observation-object-key',
    ])
  })

  it('does not require an observation to preserve the route snapshot', () => {
    const preview = buildAccountLearnerMemoryPreview(
      sampleSnapshot({
        lastObservation: undefined,
      })
    )

    expect(preview.status).toBe('ready')
    expect(preview.writePlan).toHaveLength(1)
    expect(preview.writePlan[0].table).toBe('learning_route_snapshots')
  })
})
