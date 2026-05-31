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

describe('object memory mappers', () => {
  it('maps a concept-notebook snapshot to a DB-shaped route snapshot insert', () => {
    const insert = learningRouteSnapshotToSnapshotInsert(sampleSnapshot(), { ownerUserId })

    expect(insert.ownerUserId).toBe(ownerUserId)
    expect(insert.visibility).toBe('private')
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
    expect(insert.objectKey).toBe('concept:optimization/adam')
    expect(insert.observationSource).toBe('prediction-checkpoint')
    expect(insert.observationKind).toBe('route-state')
    expect(insert.measuredState?.value).toContain('Bias correction')
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
