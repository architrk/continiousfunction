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

function efficientAttentionWorkbenchObservation(
  overrides: Partial<NonNullable<LearningRouteSnapshot['lastObservation']>> = {}
): NonNullable<LearningRouteSnapshot['lastObservation']> {
  return {
    label: 'Efficient attention workbench',
    value: 'It drops by the sharing factor: 4.29 GB, 4.0x reduction vs MHA',
    detail:
      'labId=efficient-attention-kv-cache-workbench; labVersion=2026-05-31; predictionId=quarter; g = 4 gives H_kv = 8, 4.29 GB cache at 32k, and 4.0x reduction vs ordinary MHA. For fixed B, L, T, d, and s, KV-cache memory scales linearly with stored K/V heads, not query heads.',
    nextQuestion: 'Move g from 1 to 4, then say why the ratio changes before reading the invariant.',
    source: 'kv-memory-lab',
    updatedAt: '2026-05-31T00:00:00.000Z',
    kind: 'formula-comparison',
    changed: {
      symbol: 'H_kv',
      from: 32,
      to: 8,
    },
    heldFixed: [
      { symbol: 'B', value: 1 },
      { symbol: 'L', value: 32 },
      { symbol: 'T', value: 32768 },
      { symbol: 'H_q', value: 32 },
      { symbol: 'd', value: 128 },
      { symbol: 's', value: 2 },
    ],
    result: {
      before: 17.179869184,
      after: 4.294967296,
      ratio: 4,
      unit: 'GB-decimal',
    },
    caveat: 'Memory witness only; model quality still needs a separate experiment.',
    labState: {
      context: 32768,
      layers: 32,
      queryHeads: 32,
      kvHeads: 8,
      dHead: 128,
      batch: 1,
      bytes: 2,
    },
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

  it('promotes formula workbench observations into first-class study memory summaries', () => {
    const preview = buildAccountLearnerMemoryPreview(
      sampleSnapshot({
        currentObject: {
          type: 'equation',
          objectKey: 'equation:attention-transformers/efficient-attention#math-object-2',
          title: 'Efficient Attention equation 2',
          href: '/domains/attention-transformers/efficient-attention/#math-object-2',
          status: 'workbench observation carried',
        },
        lastObservation: efficientAttentionWorkbenchObservation(),
      })
    )

    expect(preview.workbenchObservation).toEqual(
      expect.objectContaining({
        label: 'Efficient attention workbench',
        source: 'kv-memory-lab',
        objectKey: 'equation:attention-transformers/efficient-attention#math-object-2',
        predictionId: 'quarter',
        predictionLabel: 'It drops by the sharing factor',
        invariant:
          'For fixed B, L, T, d, and s, KV-cache memory scales linearly with stored K/V heads, not query heads.',
        caveat: 'Memory witness only; model quality still needs a separate experiment.',
        labId: 'efficient-attention-kv-cache-workbench',
        labVersion: '2026-05-31',
      })
    )
    expect(preview.workbenchObservation?.changed).toEqual({ symbol: 'H_kv', from: 32, to: 8 })
    expect(preview.workbenchObservation?.heldFixed).toHaveLength(6)
    expect(preview.workbenchObservation?.labState?.kvHeads).toBe(8)
  })

  it('does not promote ordinary prediction checkpoints even when they contain formula-like facts', () => {
    const preview = buildAccountLearnerMemoryPreview(
      sampleSnapshot({
        lastObservation: {
          ...efficientAttentionWorkbenchObservation({
            kind: undefined,
            label: 'Prediction checkpoint',
            source: 'prediction-checkpoint',
          }),
        },
      })
    )

    expect(preview.lastObservation?.label).toBe('Prediction checkpoint')
    expect(preview.workbenchObservation).toBeUndefined()
  })

  it('keeps formula observations useful when detail metadata is missing', () => {
    const preview = buildAccountLearnerMemoryPreview(
      sampleSnapshot({
        lastObservation: efficientAttentionWorkbenchObservation({
          detail:
            'g = 4 gives H_kv = 8, 4.29 GB cache at 32k, and 4.0x reduction vs ordinary MHA. For fixed B, L, T, d, and s, KV-cache memory scales linearly with stored K/V heads, not query heads.',
        }),
      })
    )

    expect(preview.workbenchObservation).toEqual(
      expect.objectContaining({
        evidence: 'g = 4 gives H_kv = 8, 4.29 GB cache at 32k, and 4.0x reduction vs ordinary MHA.',
        invariant:
          'For fixed B, L, T, d, and s, KV-cache memory scales linearly with stored K/V heads, not query heads.',
        predictionId: undefined,
        labId: undefined,
        labVersion: undefined,
      })
    )
  })
})
