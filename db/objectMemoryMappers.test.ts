import type { LearningRouteSnapshot, LearningRouteSourceObject } from '../lib/learningRouteSnapshot'
import {
  learningRouteSnapshotToObservationInsert,
  learningRouteSnapshotToSnapshotInsert,
  sourceObjectToEvidenceCandidate,
} from './objectMemoryMappers'

const ownerUserId = '11111111-1111-4111-8111-111111111111'

function sampleSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  return {
    version: 'cf-route-snapshot-v1',
    source: 'concept-notebook',
    paperTitle: 'Adam optimizer notebook',
    inputKind: 'concept',
    mappingId: 'adam-notebook-route',
    routeLabels: ['Adam', 'Bias correction'],
    routeConceptIds: ['adam', 'bias-correction'],
    currentQuestion: 'Which moment correction changes the early update?',
    currentObject: {
      type: 'concept',
      objectKey: 'concept:optimization/adam',
      title: 'Adam',
      href: '/domains/optimization/adam',
    },
    sourceObjects: [
      {
        type: 'source',
        objectKey: 'source:optimization/adam#kingma-ba-2014',
        title: 'Kingma and Ba 2014',
        href: '#source-span-kingma-ba-2014',
        confidence: 'high',
      },
    ],
    lastObservation: {
      label: 'Prediction',
      value: 'Bias correction changes early steps',
      detail: 'The first-moment estimate starts at zero.',
      source: 'prediction-checkpoint',
      updatedAt: '2026-05-06T00:00:00.000Z',
    },
    createdAt: '2026-05-06T00:00:00.000Z',
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
    nextQuestion: 'Restore the KV lab and explain the invariant before changing context length.',
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
        label: 'KV cache memory equation',
        equation: 'Mem_KV = B * L * T * H_kv * d_head * 2 * bytes',
        objectKey: 'equation:optimization/adam#math-object-1',
        href: '/domains/optimization/adam/#math-object-1',
      },
      committedPrediction: {
        id: 'quarter',
        label: 'It drops by the sharing factor',
        text: 'KV sharing cuts the cache by exactly the sharing factor when the other terms stay fixed.',
      },
      evidence: 'g = 4 gives H_kv = 8 and a 4.0x cache reduction.',
      invariant: 'For fixed B, L, T, d, and s, KV-cache memory scales linearly with stored K/V heads.',
      nextMove: 'Restore the KV lab and explain the invariant before changing context length.',
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
        restoreHref: '/domains/optimization/adam/#math-object-1',
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

describe('object memory mappers', () => {
  it('maps a concept-notebook snapshot to a DB-shaped route snapshot insert', () => {
    const insert = learningRouteSnapshotToSnapshotInsert(sampleSnapshot(), { ownerUserId })

    expect(insert.ownerUserId).toBe(ownerUserId)
    expect(insert.visibility).toBe('private')
    expect(insert.routeSnapshotDedupeKey).toMatch(/^lrs_v1_[a-f0-9]{64}$/)
    expect(insert.snapshotContentHash).toMatch(/^sha256_v1_[a-f0-9]{64}$/)
    expect(insert.routeObjectKey).toBe('route:domains/optimization/adam')
    expect(insert.currentObjectKey).toBe('concept:optimization/adam')
    expect(insert.snapshotJson.currentObject?.href).toBe('/domains/optimization/adam')
    expect(insert.snapshotJson.currentObject?.href).not.toBe(insert.currentObjectKey)
  })

  it('derives a route snapshot anchor from exact concept-local objects', () => {
    const insert = learningRouteSnapshotToSnapshotInsert(
      sampleSnapshot({
        currentObject: {
          type: 'equation',
          objectKey: 'equation:optimization/adam#math-object-1',
          title: 'Adam bias-correction equation',
          href: '/domains/optimization/adam/#math-object-1',
        },
      }),
      { ownerUserId }
    )

    expect(insert.routeObjectKey).toBe('route:domains/optimization/adam')
    expect(insert.currentObjectKey).toBe('equation:optimization/adam#math-object-1')
  })

  it('maps a prediction checkpoint to an object-attached observation insert', () => {
    const insert = learningRouteSnapshotToObservationInsert(sampleSnapshot(), { ownerUserId })

    expect(insert.ownerUserId).toBe(ownerUserId)
    expect(insert.observationDedupeKey).toMatch(/^lob_v1_[a-f0-9]{64}$/)
    expect(insert.measuredStateHash).toMatch(/^sha256_v1_[a-f0-9]{64}$/)
    expect(insert.routeSnapshotDedupeKey).toMatch(/^lrs_v1_[a-f0-9]{64}$/)
    expect(insert.objectKey).toBe('concept:optimization/adam')
    expect(insert.observationSource).toBe('prediction-checkpoint')
    expect(insert.observationKind).toBe('route-state')
    expect(insert.measuredState?.value).toContain('Bias correction')
    expect(insert.workbenchState).toBeNull()
  })

  it('maps a typed workbench payload to an explicit restorable observation state', () => {
    const insert = learningRouteSnapshotToObservationInsert(
      sampleSnapshot({
        lastObservation: sampleWorkbenchObservation(),
      }),
      { ownerUserId },
      { objectKey: 'concept:optimization/adam' }
    )

    expect(insert.objectKey).toBe('equation:optimization/adam#math-object-1')
    expect(insert.observationSource).toBe('kv-memory-lab')
    expect(insert.observationKind).toBe('formula-comparison')
    expect(insert.workbenchState).toEqual(
      expect.objectContaining({
        version: 'cf-learning-observation-workbench-state-v1',
        evidence: 'g = 4 gives H_kv = 8 and a 4.0x cache reduction.',
        invariant: 'For fixed B, L, T, d, and s, KV-cache memory scales linearly with stored K/V heads.',
        nextMove: 'Restore the KV lab and explain the invariant before changing context length.',
        caveat: 'Memory witness only; model quality still needs a separate experiment.',
      })
    )
    expect(insert.workbenchState?.equationObject).toEqual({
      label: 'KV cache memory equation',
      equation: 'Mem_KV = B * L * T * H_kv * d_head * 2 * bytes',
      objectKey: 'equation:optimization/adam#math-object-1',
      href: '/domains/optimization/adam/#math-object-1',
    })
    expect(insert.workbenchState?.committedPrediction).toEqual({
      id: 'quarter',
      label: 'It drops by the sharing factor',
      text: 'KV sharing cuts the cache by exactly the sharing factor when the other terms stay fixed.',
    })
    expect(insert.workbenchState?.lab).toEqual(
      expect.objectContaining({
        id: 'efficient-attention-kv-cache-workbench',
        version: '2026-05-31',
        restoreHref: '/domains/optimization/adam/#math-object-1',
        state: expect.objectContaining({ kvHeads: 8, context: 32768 }),
      })
    )
    expect(insert.workbenchState?.changed).toEqual({ symbol: 'H_kv', from: 32, to: 8 })
    expect(insert.workbenchState?.heldFixed).toHaveLength(6)
    expect(insert.workbenchState?.result).toEqual(
      expect.objectContaining({
        after: 4.294967296,
        ratio: 4,
        unit: 'GB-decimal',
      })
    )
    expect(insert.measuredState?.workbench?.lab.restoreHref).toBe('/domains/optimization/adam/#math-object-1')
  })

  it('preserves incomplete typed workbench packets raw without projecting them as restorable state', () => {
    const observation = sampleWorkbenchObservation()
    const insert = learningRouteSnapshotToObservationInsert(
      sampleSnapshot({
        lastObservation: {
          ...observation,
          workbench: {
            ...observation.workbench!,
            equationObject: {
              ...observation.workbench!.equationObject,
              objectKey: undefined,
            },
          },
        },
      }),
      { ownerUserId }
    )

    expect(insert.objectKey).toBe('concept:optimization/adam')
    expect(insert.workbenchState).toBeNull()
    expect(insert.measuredState?.workbench?.equationObject.objectKey).toBeUndefined()
    expect(insert.measuredState?.workbench?.lab.restoreHref).toBe('/domains/optimization/adam/#math-object-1')
  })

  it('does not project external restore hrefs as restorable workbench state', () => {
    const observation = sampleWorkbenchObservation()
    const insert = learningRouteSnapshotToObservationInsert(
      sampleSnapshot({
        lastObservation: {
          ...observation,
          workbench: {
            ...observation.workbench!,
            lab: {
              ...observation.workbench!.lab,
              restoreHref: 'https://example.com/not-a-cf-restore',
            },
          },
        },
      }),
      { ownerUserId }
    )

    expect(insert.objectKey).toBe('equation:optimization/adam#math-object-1')
    expect(insert.workbenchState).toBeNull()
    expect(insert.measuredState?.workbench?.lab.restoreHref).toBe('https://example.com/not-a-cf-restore')
  })

  it('rejects durable learner rows without app-owned user ids', () => {
    expect(() => learningRouteSnapshotToSnapshotInsert(sampleSnapshot(), { ownerUserId: 'user_123' })).toThrow(/app-owned uuid/)
    expect(() => learningRouteSnapshotToObservationInsert(sampleSnapshot(), { ownerUserId: '' })).toThrow(/app-owned uuid/)
  })

  it('rejects organization-visible inserts without an organization id', () => {
    expect(() => learningRouteSnapshotToSnapshotInsert(sampleSnapshot(), { ownerUserId, visibility: 'organization' })).toThrow(
      /organizationId/
    )
  })

  it('rejects URL-only observation identity', () => {
    const snapshot = sampleSnapshot({
      currentObject: {
        type: 'concept',
        title: 'Adam',
        href: '/domains/optimization/adam',
      },
    })

    expect(() => learningRouteSnapshotToObservationInsert(snapshot, { ownerUserId })).toThrow(/objectKey/)
  })

  it('rejects objectless durable route snapshots unless an explicit route key is provided', () => {
    const snapshot = sampleSnapshot({
      currentObject: undefined,
    })

    expect(() => learningRouteSnapshotToSnapshotInsert(snapshot, { ownerUserId })).toThrow(/routeObjectKey/)
    expect(
      learningRouteSnapshotToSnapshotInsert(snapshot, { ownerUserId }, { routeObjectKey: 'route:domains/optimization/adam' })
        .routeObjectKey
    ).toBe('route:domains/optimization/adam')
  })

  it('maps source objects into evidence candidates with source keys preserved', () => {
    const sourceObject = sampleSnapshot().sourceObjects![0]
    const candidate = sourceObjectToEvidenceCandidate(sourceObject, { ownerUserId })

    expect(candidate.createdByUserId).toBe(ownerUserId)
    expect(candidate.objectKey).toBe('source:optimization/adam#kingma-ba-2014')
    expect(candidate.sourceObjectKey).toBe('source:optimization/adam#kingma-ba-2014')
    expect(candidate.locator?.href).toBe('#source-span-kingma-ba-2014')
  })

  it('rejects source objects whose object key type does not match the source object type', () => {
    const sourceObject: LearningRouteSourceObject = {
      type: 'source',
      objectKey: 'concept:optimization/adam',
      title: 'Adam',
    }

    expect(() => sourceObjectToEvidenceCandidate(sourceObject, { ownerUserId })).toThrow(/cannot attach/)
  })
})
