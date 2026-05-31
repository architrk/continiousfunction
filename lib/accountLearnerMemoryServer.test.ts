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

function sampleWorkbenchObservation(
  overrides: Partial<NonNullable<LearningRouteSnapshot['lastObservation']>> = {}
): NonNullable<LearningRouteSnapshot['lastObservation']> {
  return {
    label: 'Efficient attention workbench',
    value: 'KV sharing cut the cache by 4x',
    detail:
      'labId=efficient-attention-kv-cache-workbench; labVersion=2026-05-31; predictionId=quarter; g = 4 gives H_kv = 8.',
    nextQuestion: 'Reopen the lab at this equation and test a longer context.',
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
    workbench: {
      type: 'formula-workbench',
      equationObject: {
        label: 'Efficient Attention equation 2',
        equation: 'Mem_KV = B * L * T * H_kv * d_head * 2 * bytes',
        objectKey: 'equation:attention-transformers/efficient-attention#math-object-2',
        href: '/domains/attention-transformers/efficient-attention/#math-object-2',
      },
      committedPrediction: {
        id: 'quarter',
        label: 'It drops by the sharing factor',
        text: 'KV sharing cuts the cache by exactly the sharing factor when the other terms stay fixed.',
      },
      evidence: 'g = 4 gives H_kv = 8 and a 4.0x cache reduction.',
      invariant: 'For fixed B, L, T, d, and s, KV-cache memory scales linearly with stored K/V heads.',
      nextMove: 'Reopen the lab at this equation and test a longer context.',
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
      lab: {
        id: 'efficient-attention-kv-cache-workbench',
        version: '2026-05-31',
        restoreHref: '/domains/attention-transformers/efficient-attention/#math-object-2',
        state: {
          context: 32768,
          layers: 32,
          queryHeads: 32,
          kvHeads: 8,
          dHead: 128,
          batch: 1,
          bytes: 2,
        },
      },
    },
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
    expect(result.inserts?.routeSnapshot.routeSnapshotDedupeKey).toMatch(/^lrs_v1_[a-f0-9]{64}$/)
    expect(result.inserts?.routeSnapshot.routeObjectKey).toBe('route:domains/attention-transformers/efficient-attention')
    expect(result.inserts?.observation?.observationDedupeKey).toMatch(/^lob_v1_[a-f0-9]{64}$/)
    expect(result.inserts?.observation?.objectKey).toBe('equation:attention-transformers/efficient-attention#math-object-2')
    expect(result.persistenceHandoff?.routeSnapshot.conflictTarget).toEqual([
      'owner_user_id',
      'route_snapshot_dedupe_key',
    ])
  })

  it('keeps a typed workbench restore packet explicit before and after auth', () => {
    const snapshot = sampleSnapshot({
      currentObject: {
        type: 'concept',
        objectKey: 'concept:attention-transformers/efficient-attention',
        title: 'Efficient Attention',
        href: '/domains/attention-transformers/efficient-attention/',
      },
      lastObservation: sampleWorkbenchObservation(),
    })

    const authRequired = prepareAccountLearnerMemoryImport(snapshot)
    expect(authRequired.status).toBe('auth-required')
    expect(authRequired.workbenchRestore?.equationObject).toEqual({
      label: 'Efficient Attention equation 2',
      equation: 'Mem_KV = B * L * T * H_kv * d_head * 2 * bytes',
      objectKey: 'equation:attention-transformers/efficient-attention#math-object-2',
      href: '/domains/attention-transformers/efficient-attention/#math-object-2',
    })
    expect(authRequired.workbenchRestore?.committedPrediction.text).toContain('KV sharing cuts the cache')
    expect(authRequired.workbenchRestore?.lab.restoreHref).toBe('/domains/attention-transformers/efficient-attention/#math-object-2')
    expect(authRequired.workbenchRestore?.lab.state.kvHeads).toBe(8)

    const writeReady = prepareAccountLearnerMemoryImport(snapshot, { ownerUserId })
    expect(writeReady.status).toBe('write-ready')
    expect(writeReady.inserts?.observation?.objectKey).toBe('equation:attention-transformers/efficient-attention#math-object-2')
    expect(writeReady.inserts?.observation?.workbenchState).toEqual(writeReady.workbenchRestore)
    expect(writeReady.persistenceHandoff?.observation?.attachment).toEqual({
      objectKey: 'equation:attention-transformers/efficient-attention#math-object-2',
      resolution: 'typed-workbench-equation-object',
      currentObjectKey: 'concept:attention-transformers/efficient-attention',
      workbenchEquationObjectKey: 'equation:attention-transformers/efficient-attention#math-object-2',
    })
    expect(writeReady.persistenceHandoff?.observation?.dependsOn).toEqual({
      table: 'learning_route_snapshots',
      dedupeKey: writeReady.inserts?.routeSnapshot.routeSnapshotDedupeKey,
      snapshotIdResolution: 'resolve-after-route-snapshot-upsert',
    })
    expect(writeReady.inserts?.observation?.measuredState?.workbench?.committedPrediction.text).toContain(
      'KV sharing cuts the cache'
    )
  })
})
