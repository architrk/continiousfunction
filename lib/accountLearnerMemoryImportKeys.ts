import { createHash } from 'node:crypto'
import type { ContentObjectKey } from './contentObjectKeys'
import type { LearningRouteSnapshot } from './learningRouteSnapshot'
import type { LearningObservationWorkbenchState } from '../db/objectMemoryTypes'

export const accountLearnerMemoryDedupeKeyVersion = 'cf-account-learner-memory-dedupe-v1' as const

type JsonLike =
  | string
  | number
  | boolean
  | null
  | readonly JsonLike[]
  | {
      readonly [key: string]: JsonLike | undefined
    }

function stableJson(value: unknown): JsonLike | undefined {
  if (value === undefined) return undefined
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => stableJson(item)).filter((item): item is JsonLike => item !== undefined)
  }
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>
    return Object.keys(object)
      .sort()
      .reduce<Record<string, JsonLike>>((acc, key) => {
        const next = stableJson(object[key])
        if (next !== undefined) acc[key] = next
        return acc
      }, {})
  }

  return String(value)
}

function sha256Canonical(value: JsonLike) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function digestDedupeKey(prefix: 'lrs' | 'lob', value: JsonLike) {
  return `${prefix}_v1_${sha256Canonical(value)}`
}

export function accountLearnerMemoryContentHash(value: unknown) {
  const stable = stableJson(value)
  const digest = sha256Canonical(stable ?? null)
  return `sha256_v1_${digest}`
}

export function normalizedObservationForDedupe(input: {
  observation: NonNullable<LearningRouteSnapshot['lastObservation']>
  workbenchState?: LearningObservationWorkbenchState | null
}) {
  const observation = input.observation
  return stableJson({
    label: observation.label,
    value: observation.value,
    detail: observation.detail,
    nextQuestion: observation.nextQuestion,
    source: observation.source,
    kind: observation.kind ?? 'route-state',
    changed: observation.changed,
    heldFixed: observation.heldFixed,
    result: observation.result,
    caveat: observation.caveat,
    labState: observation.labState,
    workbench: input.workbenchState ?? observation.workbench,
  })
}

function normalizedRouteSnapshotForDedupe(snapshot: LearningRouteSnapshot, routeObjectKey: ContentObjectKey) {
  return stableJson({
    keyVersion: accountLearnerMemoryDedupeKeyVersion,
    kind: 'learning-route-snapshot',
    snapshotVersion: snapshot.version,
    source: snapshot.source,
    mappingId: snapshot.mappingId,
    inputKind: snapshot.inputKind,
    routeObjectKey,
  })!
}

function normalizedObservationKeyMaterial(input: {
  routeSnapshotDedupeKey: string
  objectKey: ContentObjectKey
  observation: NonNullable<LearningRouteSnapshot['lastObservation']>
  workbenchState?: LearningObservationWorkbenchState | null
}) {
  return stableJson({
    keyVersion: accountLearnerMemoryDedupeKeyVersion,
    kind: 'learning-observation',
    routeSnapshotDedupeKey: input.routeSnapshotDedupeKey,
    objectKey: input.objectKey,
    normalizedObservation: normalizedObservationForDedupe({
      observation: input.observation,
      workbenchState: input.workbenchState,
    }),
  })!
}

export function accountLearnerRouteSnapshotDedupeKey(
  snapshot: LearningRouteSnapshot,
  routeObjectKey: ContentObjectKey
) {
  return digestDedupeKey('lrs', normalizedRouteSnapshotForDedupe(snapshot, routeObjectKey))
}

export function accountLearnerObservationDedupeKey(input: {
  routeSnapshotDedupeKey: string
  objectKey: ContentObjectKey
  observation: NonNullable<LearningRouteSnapshot['lastObservation']>
  workbenchState?: LearningObservationWorkbenchState | null
}) {
  return digestDedupeKey('lob', normalizedObservationKeyMaterial(input))
}

export function accountLearnerRouteSnapshotContentHash(snapshot: LearningRouteSnapshot) {
  return accountLearnerMemoryContentHash(snapshot)
}

export function accountLearnerObservationMeasuredStateHash(
  observation: NonNullable<LearningRouteSnapshot['lastObservation']>
) {
  return accountLearnerMemoryContentHash(observation)
}

export function accountLearnerWorkbenchStateHash(workbenchState: LearningObservationWorkbenchState | null | undefined) {
  return workbenchState ? accountLearnerMemoryContentHash(workbenchState) : null
}
