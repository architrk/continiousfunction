import {
  CONTENT_OBJECT_KEY_VERSION,
  contentObjectTypeFromKey,
  type ContentObjectType,
  isContentObjectKey,
  parseContentObjectKey,
  type ContentObjectKey,
} from '../lib/contentObjectKeys'
import {
  CONTENT_OBJECT_MANIFEST_VERSION,
  validateContentObjectManifest,
  type ContentObjectManifest,
  type ContentObjectManifestObject,
} from '../lib/contentObjectManifest'
import { routeObjectKeyFromContentObjectKey } from '../lib/learningRouteObjectKeys'
import type { LearningRouteSnapshot, LearningRouteSourceObject } from '../lib/learningRouteSnapshot'
import { projectLearningRouteWorkbenchRestoreState } from '../lib/workbenchRestoreProjection'
import {
  accountLearnerObservationDedupeKey,
  accountLearnerObservationMeasuredStateHash,
  accountLearnerRouteSnapshotContentHash,
  accountLearnerRouteSnapshotDedupeKey,
  accountLearnerWorkbenchStateHash,
} from '../lib/accountLearnerMemoryImportKeys'
import {
  maxEvidenceLocatorJsonChars,
  maxMeasuredStateJsonChars,
  maxRouteSnapshotJsonChars,
  maxWorkbenchStateJsonChars,
  ObjectMemoryContractError,
  type ContentObjectRefInsert,
  type EvidenceRefCandidate,
  type LearningObservationInsert,
  type LearningObservationWorkbenchState,
  type LearningRouteSnapshotInsert,
  type ObjectMemoryOwnership,
  type VisibilityMode,
} from './objectMemoryTypes'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonSize(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).length
}

function assertJsonSize(value: unknown, maxChars: number, label: string) {
  const size = jsonSize(value)
  if (size > maxChars) {
    throw new ObjectMemoryContractError(`${label} is too large for the object-memory contract (${size}/${maxChars} chars)`)
  }
}

function assertUuid(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new ObjectMemoryContractError(`${label} must be an app-owned uuid`)
  }
}

function assertObjectKey(value: unknown, label: string): asserts value is ContentObjectKey {
  if (!isContentObjectKey(value)) {
    throw new ObjectMemoryContractError(`${label} must be a valid content object key`)
  }
}

function assertSourceObjectMatchesContentObjectKey(sourceObject: LearningRouteSourceObject) {
  assertObjectKey(sourceObject.objectKey, 'source object objectKey')

  const contentType = contentObjectTypeFromKey(sourceObject.objectKey)
  const allowedContentTypesBySourceObjectType: Record<LearningRouteSourceObject['type'], readonly ContentObjectType[]> = {
    paper: ['paper'],
    concept: ['concept'],
    equation: ['equation'],
    source: ['source', 'source-span'],
    'toy-experiment': ['demo', 'route'],
    'code-witness': ['code'],
    visualization: ['demo'],
    claim: ['claim'],
    misconception: ['misconception'],
    lab: ['demo', 'route'],
    thread: ['route', 'claim'],
    question: ['route', 'claim'],
  }

  if (!allowedContentTypesBySourceObjectType[sourceObject.type].includes(contentType)) {
    throw new ObjectMemoryContractError(`source object type ${sourceObject.type} cannot attach to ${contentType} key ${sourceObject.objectKey}`)
  }
}

function normalizeVisibility(value: VisibilityMode | undefined): VisibilityMode {
  return value ?? 'private'
}

function assertOwnership(ownership: ObjectMemoryOwnership) {
  assertUuid(ownership.ownerUserId, 'ownerUserId')
  if (ownership.organizationId !== undefined && ownership.organizationId !== null) {
    assertUuid(ownership.organizationId, 'organizationId')
  }
  if (ownership.visibility !== undefined && ownership.visibility !== 'private' && ownership.visibility !== 'organization') {
    throw new ObjectMemoryContractError('visibility must be private or organization')
  }
  if (ownership.visibility === 'organization' && !ownership.organizationId) {
    throw new ObjectMemoryContractError('organization visibility requires organizationId')
  }
}

export function contentObjectManifestObjectToRefInsert(
  object: ContentObjectManifestObject,
  options: {
    manifestVersion?: string
    keyVersion?: string
  } = {}
): ContentObjectRefInsert {
  assertObjectKey(object.key, 'manifest object key')

  if (contentObjectTypeFromKey(object.key) !== object.type) {
    throw new ObjectMemoryContractError(`manifest object ${object.key} has mismatched type ${object.type}`)
  }

  return {
    objectKey: object.key,
    objectType: object.type,
    origin: 'atlas-manifest',
    title: object.title,
    href: object.href ?? null,
    domain: object.domain ?? null,
    conceptId: object.conceptId ?? null,
    status: object.status ?? null,
    stability: object.stability,
    manifestVersion: options.manifestVersion ?? CONTENT_OBJECT_MANIFEST_VERSION,
    keyVersion: options.keyVersion ?? CONTENT_OBJECT_KEY_VERSION,
    sourceIds: object.sourceIds ?? null,
    objectRefs: object.objectRefs ?? null,
    discussionAnchorId: object.discussionAnchorId ?? null,
  }
}

export function contentObjectManifestToRefInserts(manifest: ContentObjectManifest): ContentObjectRefInsert[] {
  const issues = validateContentObjectManifest(manifest)
  if (issues.length > 0) {
    throw new ObjectMemoryContractError(`content object manifest is invalid: ${issues[0]}`)
  }

  return manifest.objects.map((object) =>
    contentObjectManifestObjectToRefInsert(object, {
      manifestVersion: manifest.version,
      keyVersion: manifest.keyVersion,
    })
  )
}

export function learningRouteSnapshotToSnapshotInsert(
  snapshot: LearningRouteSnapshot,
  ownership: ObjectMemoryOwnership,
  options: { routeObjectKey?: ContentObjectKey } = {}
): LearningRouteSnapshotInsert {
  assertOwnership(ownership)
  assertJsonSize(snapshot, maxRouteSnapshotJsonChars, 'LearningRouteSnapshot.snapshotJson')

  const currentObjectKey = snapshot.currentObject?.objectKey ?? null
  if (currentObjectKey !== null) {
    assertObjectKey(currentObjectKey, 'snapshot.currentObject.objectKey')
  }
  const routeObjectKey = resolveRouteObjectKey(snapshot, options.routeObjectKey)
  const routeSnapshotDedupeKey = accountLearnerRouteSnapshotDedupeKey(snapshot, routeObjectKey)

  return {
    ownerUserId: ownership.ownerUserId,
    organizationId: ownership.organizationId ?? null,
    visibility: normalizeVisibility(ownership.visibility),
    routeSnapshotDedupeKey,
    snapshotContentHash: accountLearnerRouteSnapshotContentHash(snapshot),
    source: snapshot.source,
    mappingId: snapshot.mappingId,
    paperTitle: snapshot.paperTitle,
    inputKind: snapshot.inputKind,
    routeObjectKey,
    currentObjectKey,
    currentQuestion: snapshot.currentQuestion ?? null,
    routeConceptIds: snapshot.routeConceptIds,
    routeLabels: snapshot.routeLabels,
    routeConcepts: snapshot.routeConcepts ?? null,
    sourceObjects: snapshot.sourceObjects ?? null,
    graphRoute: snapshot.graphRoute ?? null,
    routeProgress: snapshot.routeProgress ?? null,
    primaryEquation: snapshot.primaryEquation ?? null,
    snapshotJson: snapshot,
  }
}

function resolveRouteObjectKey(snapshot: LearningRouteSnapshot, explicitRouteObjectKey?: ContentObjectKey): ContentObjectKey {
  if (explicitRouteObjectKey !== undefined) {
    assertObjectKey(explicitRouteObjectKey, 'routeObjectKey')
    if (contentObjectTypeFromKey(explicitRouteObjectKey) !== 'route') {
      throw new ObjectMemoryContractError('routeObjectKey must use the route: content object type')
    }
    return explicitRouteObjectKey
  }

  const currentObjectKey = snapshot.currentObject?.objectKey
  if (!currentObjectKey) {
    throw new ObjectMemoryContractError('durable route snapshots require routeObjectKey or currentObject.objectKey')
  }

  const routeKey = routeObjectKeyFromContentObjectKey(currentObjectKey)
  if (routeKey) return routeKey

  throw new ObjectMemoryContractError('durable route snapshots require a route: object key anchor')
}

export function learningRouteSnapshotToObservationInsert(
  snapshot: LearningRouteSnapshot,
  ownership: ObjectMemoryOwnership,
  options: { snapshotId?: string | null; objectKey?: ContentObjectKey } = {}
): LearningObservationInsert {
  assertOwnership(ownership)
  if (options.snapshotId !== undefined && options.snapshotId !== null) {
    assertUuid(options.snapshotId, 'snapshotId')
  }

  if (!snapshot.lastObservation) {
    throw new ObjectMemoryContractError('snapshot.lastObservation is required to create a learning_observations insert')
  }

  const objectKey = snapshot.lastObservation.workbench?.equationObject.objectKey ?? options.objectKey ?? snapshot.currentObject?.objectKey
  assertObjectKey(objectKey, 'learning observation objectKey')
  assertJsonSize(snapshot.lastObservation, maxMeasuredStateJsonChars, 'learning observation measuredState')
  const workbenchState = learningRouteSnapshotToWorkbenchState(snapshot)
  const routeObjectKey = resolveRouteObjectKey(snapshot)
  const routeSnapshotDedupeKey = accountLearnerRouteSnapshotDedupeKey(snapshot, routeObjectKey)
  const observationDedupeKey = accountLearnerObservationDedupeKey({
    routeSnapshotDedupeKey,
    objectKey,
    observation: snapshot.lastObservation,
    workbenchState,
  })

  return {
    ownerUserId: ownership.ownerUserId,
    organizationId: ownership.organizationId ?? null,
    observationDedupeKey,
    measuredStateHash: accountLearnerObservationMeasuredStateHash(snapshot.lastObservation),
    workbenchStateHash: accountLearnerWorkbenchStateHash(workbenchState),
    routeSnapshotDedupeKey,
    snapshotId: options.snapshotId ?? null,
    objectKey,
    observationSource: snapshot.lastObservation.source,
    observationKind: snapshot.lastObservation.kind ?? 'route-state',
    label: snapshot.lastObservation.label,
    value: snapshot.lastObservation.value,
    detail: snapshot.lastObservation.detail ?? null,
    nextQuestion: snapshot.lastObservation.nextQuestion ?? null,
    workbenchState,
    measuredState: snapshot.lastObservation,
  }
}

export function learningRouteSnapshotToWorkbenchState(snapshot: LearningRouteSnapshot): LearningObservationWorkbenchState | null {
  const state = projectLearningRouteWorkbenchRestoreState(snapshot)
  if (!state) return null
  assertJsonSize(state, maxWorkbenchStateJsonChars, 'learning observation workbenchState')
  return state
}

export function sourceObjectToEvidenceCandidate(
  sourceObject: LearningRouteSourceObject,
  ownership: ObjectMemoryOwnership
): EvidenceRefCandidate {
  assertOwnership(ownership)
  assertSourceObjectMatchesContentObjectKey(sourceObject)
  const objectKey = sourceObject.objectKey as ContentObjectKey

  const parsed = parseContentObjectKey(objectKey)
  if (!parsed) {
    throw new ObjectMemoryContractError('source object objectKey must parse before evidence mapping')
  }

  const sourceObjectKey = parsed.type === 'source' ? objectKey : null
  const sourceSpanKey = parsed.type === 'source-span' ? objectKey : null

  const locator = {
    sourceObjectType: sourceObject.type,
    sourceObjectId: sourceObject.id,
    href: sourceObject.href,
    role: sourceObject.role,
    status: sourceObject.status,
    confidence: sourceObject.confidence,
  }
  assertJsonSize(locator, maxEvidenceLocatorJsonChars, 'evidence locator')

  return {
    createdByUserId: ownership.ownerUserId,
    organizationId: ownership.organizationId ?? null,
    objectKey,
    sourceObjectKey,
    sourceSpanKey,
    claimText: sourceObject.sourceDetail ?? null,
    quoteSnippet: null,
    locator,
    confidence: sourceObject.confidence ?? null,
  }
}
