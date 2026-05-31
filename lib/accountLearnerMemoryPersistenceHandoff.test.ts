import { prepareAccountLearnerMemoryImport } from './accountLearnerMemoryServer'
import type { LearningRouteSnapshot } from './learningRouteSnapshot'

const ownerUserId = '11111111-1111-4111-8111-111111111111'

function sampleObservation(
  overrides: Partial<NonNullable<LearningRouteSnapshot['lastObservation']>> = {}
): NonNullable<LearningRouteSnapshot['lastObservation']> {
  return {
    label: 'Efficient attention workbench',
    value: 'KV sharing cut the cache by 4x',
    detail: 'g = 4 gives H_kv = 8 and a 4.0x reduction.',
    nextQuestion: 'Reopen the lab and test longer context.',
    source: 'kv-memory-lab',
    updatedAt: '2026-05-31T00:00:00.000Z',
    kind: 'formula-comparison',
    changed: { symbol: 'H_kv', from: 32, to: 8 },
    heldFixed: [
      { symbol: 'B', value: 1 },
      { symbol: 'L', value: 32 },
      { symbol: 'T', value: 32768 },
      { symbol: 'H_q', value: 32 },
      { symbol: 'd', value: 128 },
      { symbol: 's', value: 2 },
    ],
    result: { before: 17.179869184, after: 4.294967296, ratio: 4, unit: 'GB-decimal' },
    caveat: 'Memory witness only.',
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
        text: 'KV sharing cuts the cache by exactly the sharing factor.',
      },
      evidence: 'g = 4 gives H_kv = 8 and a 4.0x cache reduction.',
      invariant: 'For fixed B, L, T, d, and s, KV-cache memory scales linearly with stored K/V heads.',
      nextMove: 'Reopen the lab and test longer context.',
      changed: { symbol: 'H_kv', from: 32, to: 8 },
      heldFixed: [
        { symbol: 'B', value: 1 },
        { symbol: 'L', value: 32 },
        { symbol: 'T', value: 32768 },
        { symbol: 'H_q', value: 32 },
        { symbol: 'd', value: 128 },
        { symbol: 's', value: 2 },
      ],
      result: { before: 17.179869184, after: 4.294967296, ratio: 4, unit: 'GB-decimal' },
      caveat: 'Memory witness only.',
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
      type: 'concept',
      objectKey: 'concept:attention-transformers/efficient-attention',
      title: 'Efficient Attention',
      href: '/domains/attention-transformers/efficient-attention/',
    },
    lastObservation: sampleObservation(),
    createdAt: '2026-05-31T00:00:00.000Z',
    ...overrides,
  }
}

describe('account learner memory persistence handoff', () => {
  it('does not build a handoff before auth ownership exists', () => {
    const result = prepareAccountLearnerMemoryImport(sampleSnapshot())

    expect(result.status).toBe('auth-required')
    expect(result.persistenceHandoff).toBeUndefined()
  })

  it('describes a not-executed deterministic handoff for write-ready imports', () => {
    const result = prepareAccountLearnerMemoryImport(sampleSnapshot(), { ownerUserId })

    expect(result.status).toBe('write-ready')
    expect(result.persisted).toBe(false)
    expect(result.persistenceHandoff).toEqual(
      expect.objectContaining({
        serverMode: 'contract-only',
        persisted: false,
        execution: {
          status: 'not-executed',
          reason: 'persistence-runtime-adapter-not-connected',
        },
      })
    )
    expect(result.persistenceHandoff?.routeSnapshot).toEqual(
      expect.objectContaining({
        operation: 'upsert-latest-route-state',
        dedupeKey: result.inserts?.routeSnapshot.routeSnapshotDedupeKey,
        contentHash: result.inserts?.routeSnapshot.snapshotContentHash,
        conflictTarget: ['owner_user_id', 'route_snapshot_dedupe_key'],
      })
    )
    expect(result.persistenceHandoff?.observation).toEqual(
      expect.objectContaining({
        operation: 'insert-if-absent',
        dedupeKey: result.inserts?.observation?.observationDedupeKey,
        measuredStateHash: result.inserts?.observation?.measuredStateHash,
        workbenchStateHash: result.inserts?.observation?.workbenchStateHash,
        conflictTarget: ['owner_user_id', 'observation_dedupe_key'],
      })
    )
  })

  it('keeps route dedupe stable across state edits while content hash changes', () => {
    const first = prepareAccountLearnerMemoryImport(sampleSnapshot(), { ownerUserId })
    const second = prepareAccountLearnerMemoryImport(
      sampleSnapshot({
        currentQuestion: 'A different next question',
        lastObservation: sampleObservation({ value: 'A different measured result' }),
      }),
      { ownerUserId }
    )

    expect(first.inserts?.routeSnapshot.routeSnapshotDedupeKey).toBe(second.inserts?.routeSnapshot.routeSnapshotDedupeKey)
    expect(first.inserts?.routeSnapshot.snapshotContentHash).not.toBe(second.inserts?.routeSnapshot.snapshotContentHash)
  })

  it('dedupes repeated observations across timestamp-only saves but keeps measured hashes exact', () => {
    const first = prepareAccountLearnerMemoryImport(sampleSnapshot(), { ownerUserId })
    const second = prepareAccountLearnerMemoryImport(
      sampleSnapshot({
        lastObservation: sampleObservation({ updatedAt: '2026-05-31T00:05:00.000Z' }),
      }),
      { ownerUserId }
    )

    expect(first.inserts?.observation?.observationDedupeKey).toBe(second.inserts?.observation?.observationDedupeKey)
    expect(first.inserts?.observation?.measuredStateHash).not.toBe(second.inserts?.observation?.measuredStateHash)
  })

  it('changes observation dedupe when the learner changes the measured workbench state', () => {
    const first = prepareAccountLearnerMemoryImport(sampleSnapshot(), { ownerUserId })
    const changedObservation = sampleObservation()
    const changedWorkbench = changedObservation.workbench!

    const second = prepareAccountLearnerMemoryImport(
      sampleSnapshot({
        lastObservation: {
          ...changedObservation,
          changed: { symbol: 'H_kv', from: 32, to: 16 },
          result: { before: 17.179869184, after: 8.589934592, ratio: 2, unit: 'GB-decimal' },
          workbench: {
            ...changedWorkbench,
            changed: { symbol: 'H_kv', from: 32, to: 16 },
            result: { before: 17.179869184, after: 8.589934592, ratio: 2, unit: 'GB-decimal' },
            lab: {
              ...changedWorkbench.lab,
              state: {
                ...changedWorkbench.lab.state,
                kvHeads: 16,
              },
            },
          },
        },
      }),
      { ownerUserId }
    )

    expect(first.inserts?.routeSnapshot.routeSnapshotDedupeKey).toBe(second.inserts?.routeSnapshot.routeSnapshotDedupeKey)
    expect(first.inserts?.observation?.observationDedupeKey).not.toBe(second.inserts?.observation?.observationDedupeKey)
  })
})
