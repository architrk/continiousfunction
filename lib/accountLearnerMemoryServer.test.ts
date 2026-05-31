import { prepareAccountLearnerMemoryImport } from './accountLearnerMemoryServer'
import type { LearningRouteSnapshot } from './learningRouteSnapshot'

const ownerUserId = '11111111-1111-4111-8111-111111111111'

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
      objectKey: 'equation:attention-transformers/efficient-attention#math-object-2',
      title: 'KV cache memory equation',
      href: '/domains/attention-transformers/efficient-attention/#math-object-2',
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

describe('account learner memory server import', () => {
  it('rejects malformed payloads before auth or database work', () => {
    const result = prepareAccountLearnerMemoryImport({ version: 'wrong' })

    expect(result.status).toBe('invalid')
    expect(result.persisted).toBe(false)
    expect(result.reason).toContain('cf-route-snapshot-v1')
  })

  it('requires auth after validating a ready snapshot', () => {
    const result = prepareAccountLearnerMemoryImport(sampleSnapshot())

    expect(result.status).toBe('auth-required')
    expect(result.preview.status).toBe('ready')
    expect(result.preview.routeObjectKey).toBe('route:domains/attention-transformers/efficient-attention')
    expect(result.inserts).toBeUndefined()
  })

  it('blocks snapshots whose selected object lacks a durable key', () => {
    const result = prepareAccountLearnerMemoryImport(
      sampleSnapshot({
        currentObject: {
          type: 'equation',
          title: 'KV cache memory equation',
          href: '/domains/attention-transformers/efficient-attention/#math-object-2',
        },
      }),
      { ownerUserId }
    )

    expect(result.status).toBe('blocked')
    expect(result.preview.blockers.map((blocker) => blocker.id)).toEqual([
      'missing-route-object-key',
      'missing-current-object-key',
      'missing-observation-object-key',
    ])
    expect(result.inserts).toBeUndefined()
  })

  it('prepares DB-shaped inserts when the app-owned user exists', () => {
    const result = prepareAccountLearnerMemoryImport(sampleSnapshot(), { ownerUserId })

    expect(result.status).toBe('write-ready')
    expect(result.persisted).toBe(false)
    expect(result.inserts?.routeSnapshot.ownerUserId).toBe(ownerUserId)
    expect(result.inserts?.routeSnapshot.routeObjectKey).toBe('route:domains/attention-transformers/efficient-attention')
    expect(result.inserts?.observation?.objectKey).toBe('equation:attention-transformers/efficient-attention#math-object-2')
  })
})
