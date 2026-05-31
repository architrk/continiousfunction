import { isContentObjectKey, type ContentObjectKey } from './contentObjectKeys'
import type { LearningRouteSnapshot, LearningRouteSourceObject } from './learningRouteSnapshot'
import { routeObjectKeyFromLearningRouteSnapshot } from './learningRouteObjectKeys'
import { projectLearningRouteWorkbenchRestoreState } from './workbenchRestoreProjection'

export const accountLearnerMemoryPreviewVersion = 'cf-account-learner-memory-preview-v1' as const

export type AccountLearnerMemoryStatus = 'empty' | 'blocked' | 'ready'

export type AccountLearnerMemoryBlocker = {
  id: 'no-local-snapshot' | 'missing-route-object-key' | 'missing-current-object-key' | 'missing-observation-object-key'
  label: string
  detail: string
}

export type AccountLearnerMemoryWritePlan = {
  table: 'learning_route_snapshots' | 'learning_observations'
  label: string
  objectKey?: ContentObjectKey
  detail: string
  ready: boolean
}

export type AccountLearnerMemoryWorkbenchObservation = {
  label: string
  source: NonNullable<LearningRouteSnapshot['lastObservation']>['source']
  objectTitle?: string
  objectType?: LearningRouteSourceObject['type']
  objectKey?: ContentObjectKey
  objectHref?: string
  equation?: string
  predictionId?: string
  predictionLabel?: string
  predictionText?: string
  evidence: string
  invariant?: string
  nextMove?: string
  changed?: NonNullable<LearningRouteSnapshot['lastObservation']>['changed']
  heldFixed: NonNullable<NonNullable<LearningRouteSnapshot['lastObservation']>['heldFixed']>
  result?: NonNullable<LearningRouteSnapshot['lastObservation']>['result']
  caveat?: string
  labId?: string
  labVersion?: string
  restoreHref?: string
  labState?: NonNullable<LearningRouteSnapshot['lastObservation']>['labState']
}

export type AccountLearnerMemoryPreview = {
  version: typeof accountLearnerMemoryPreviewVersion
  status: AccountLearnerMemoryStatus
  routeTitle: string
  routeObjectKey?: ContentObjectKey
  currentObject?: {
    title: string
    type: LearningRouteSourceObject['type']
    href?: string
    objectKey?: ContentObjectKey
  }
  currentQuestion?: string
  lastObservation?: NonNullable<LearningRouteSnapshot['lastObservation']>
  workbenchObservation?: AccountLearnerMemoryWorkbenchObservation
  counts: {
    routeSteps: number
    sourceObjects: number
    readyStages: number
    savedCheckpoints: number
  }
  writePlan: AccountLearnerMemoryWritePlan[]
  blockers: AccountLearnerMemoryBlocker[]
  nextServerContract: string
}

function titleForSnapshot(snapshot: LearningRouteSnapshot) {
  return snapshot.mappingTitle ?? snapshot.paperClueLabel ?? snapshot.paperTitle
}

function currentObjectSummary(snapshot: LearningRouteSnapshot): AccountLearnerMemoryPreview['currentObject'] {
  const object = snapshot.currentObject
  if (!object) return undefined

  return {
    title: object.title,
    type: object.type,
    href: object.href,
    objectKey: isContentObjectKey(object.objectKey) ? object.objectKey : undefined,
  }
}

function detailMetadataValue(detail: string | undefined, key: string) {
  const match = detail?.match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`))
  return match?.[1]?.trim()
}

function stripDetailMetadata(detail: string | undefined) {
  return detail?.replace(/^(?:[a-zA-Z]+=[^;]+;\s*)+/, '').trim()
}

function invariantFromObservationDetail(detail: string | undefined) {
  const stripped = stripDetailMetadata(detail)
  if (!stripped) return undefined

  const fixedIndex = stripped.indexOf('For fixed ')
  if (fixedIndex < 0) return undefined

  const endIndex = stripped.indexOf('.', fixedIndex)
  return endIndex >= 0 ? stripped.slice(fixedIndex, endIndex + 1).trim() : stripped.slice(fixedIndex).trim()
}

function evidenceFromObservation(
  observation: NonNullable<LearningRouteSnapshot['lastObservation']>
) {
  const stripped = stripDetailMetadata(observation.detail)
  const invariant = invariantFromObservationDetail(observation.detail)
  if (!stripped) return observation.value
  if (!invariant) return stripped

  const evidence = stripped.replace(invariant, '').trim()
  return evidence || observation.value
}

function predictionLabelFromObservationValue(value: string) {
  const [candidate] = value.split(':')
  return candidate?.trim() || undefined
}

function typedWorkbenchObservationSummary(
  snapshot: LearningRouteSnapshot,
  observation: NonNullable<LearningRouteSnapshot['lastObservation']>
): AccountLearnerMemoryWorkbenchObservation | undefined {
  const workbench = observation.workbench
  if (!workbench) return undefined
  const restore = projectLearningRouteWorkbenchRestoreState(snapshot)
  if (!restore) return undefined

  return {
    label: observation.label,
    source: observation.source,
    objectTitle: restore.equationObject.label,
    objectType: 'equation',
    objectKey: restore.equationObject.objectKey,
    objectHref: restore.equationObject.href,
    equation: restore.equationObject.equation,
    predictionId: restore.committedPrediction.id,
    predictionLabel: restore.committedPrediction.label,
    predictionText: restore.committedPrediction.text,
    evidence: restore.evidence,
    invariant: restore.invariant,
    nextMove: restore.nextMove,
    changed: restore.changed,
    heldFixed: restore.heldFixed,
    result: restore.result,
    caveat: restore.caveat,
    labId: restore.lab.id,
    labVersion: restore.lab.version,
    restoreHref: restore.lab.restoreHref,
    labState: restore.lab.state,
  }
}

function workbenchObservationSummary(snapshot: LearningRouteSnapshot): AccountLearnerMemoryWorkbenchObservation | undefined {
  const observation = snapshot.lastObservation
  if (!observation) return undefined

  const typedWorkbench = typedWorkbenchObservationSummary(snapshot, observation)
  if (typedWorkbench) return typedWorkbench

  if (observation.kind !== 'formula-comparison') return undefined

  const objectKey = isContentObjectKey(snapshot.currentObject?.objectKey) ? snapshot.currentObject.objectKey : undefined

  return {
    label: observation.label,
    source: observation.source,
    objectTitle: snapshot.currentObject?.title,
    objectType: snapshot.currentObject?.type,
    objectKey,
    predictionId: detailMetadataValue(observation.detail, 'predictionId'),
    predictionLabel: predictionLabelFromObservationValue(observation.value),
    evidence: evidenceFromObservation(observation),
    invariant: invariantFromObservationDetail(observation.detail),
    nextMove: observation.nextQuestion,
    changed: observation.changed,
    heldFixed: observation.heldFixed ?? [],
    result: observation.result,
    caveat: observation.caveat,
    labId: detailMetadataValue(observation.detail, 'labId'),
    labVersion: detailMetadataValue(observation.detail, 'labVersion'),
    labState: observation.labState,
  }
}

function progressCounts(snapshot: LearningRouteSnapshot): AccountLearnerMemoryPreview['counts'] {
  const readyStages =
    snapshot.routeProgress?.stageReadiness.filter((stage) => stage.status === 'ready' || stage.status === 'active').length ?? 0
  const savedCheckpoints =
    snapshot.routeProgress?.checkpoints?.filter((checkpoint) => checkpoint.status === 'saved' || checkpoint.status === 'observed')
      .length ?? 0

  return {
    routeSteps: snapshot.routeLabels.length,
    sourceObjects: snapshot.sourceObjects?.length ?? 0,
    readyStages,
    savedCheckpoints,
  }
}

function writePlanForSnapshot(
  snapshot: LearningRouteSnapshot,
  routeObjectKey: ContentObjectKey | null,
  currentObjectKey: ContentObjectKey | undefined,
  observationObjectKey: ContentObjectKey | undefined
): AccountLearnerMemoryWritePlan[] {
  const plan: AccountLearnerMemoryWritePlan[] = [
    {
      table: 'learning_route_snapshots',
      label: 'Save route snapshot',
      objectKey: routeObjectKey ?? undefined,
      detail: routeObjectKey
        ? 'Persistence-handoff preview for a private learning_route_snapshots row once signed-in account memory is enabled.'
        : 'Needs a durable route object key before it can become account memory.',
      ready: routeObjectKey !== null,
    },
  ]

  if (snapshot.lastObservation) {
    plan.push({
      table: 'learning_observations',
      label: 'Attach last observation',
      objectKey: observationObjectKey,
      detail: observationObjectKey
        ? 'Persistence-handoff preview for a learning_observations row attached to the exact observed object.'
        : 'Needs the selected or observed workbench object to carry a content object key.',
      ready: observationObjectKey !== undefined,
    })
  }

  return plan
}

export function buildAccountLearnerMemoryPreview(snapshot: LearningRouteSnapshot | null): AccountLearnerMemoryPreview {
  if (!snapshot) {
    return {
      version: accountLearnerMemoryPreviewVersion,
      status: 'empty',
      routeTitle: 'No local route yet',
      counts: {
        routeSteps: 0,
        sourceObjects: 0,
        readyStages: 0,
        savedCheckpoints: 0,
      },
      writePlan: [],
      blockers: [
        {
          id: 'no-local-snapshot',
          label: 'Start or save a learning route',
          detail: 'Account memory imports the same compact browser-local route snapshot that Home, Graph, Paper Mapper, and concept notebooks already use.',
        },
      ],
      nextServerContract: 'POST /api/me/learning-route-snapshots',
    }
  }

  const routeObjectKey = routeObjectKeyFromLearningRouteSnapshot(snapshot)
  const currentObjectKey = isContentObjectKey(snapshot.currentObject?.objectKey) ? snapshot.currentObject.objectKey : undefined
  const workbenchEquationObjectKey = isContentObjectKey(snapshot.lastObservation?.workbench?.equationObject.objectKey)
    ? snapshot.lastObservation.workbench.equationObject.objectKey
    : undefined
  const observationObjectKey = workbenchEquationObjectKey ?? currentObjectKey
  const blockers: AccountLearnerMemoryBlocker[] = []

  if (!routeObjectKey) {
    blockers.push({
      id: 'missing-route-object-key',
      label: 'Route anchor missing',
      detail: 'The snapshot needs a route: object key derived from the selected concept object before it can be written durably.',
    })
  }

  if (snapshot.currentObject && !currentObjectKey) {
    blockers.push({
      id: 'missing-current-object-key',
      label: 'Selected object lacks durable identity',
      detail: 'The selected object has a title or href, but account memory needs a content object key.',
    })
  }

  if (snapshot.lastObservation && !observationObjectKey) {
    blockers.push({
      id: 'missing-observation-object-key',
      label: 'Observation cannot attach yet',
      detail: 'The last observation can only become durable if it attaches to an exact equation, concept, demo, code witness, claim, source, or route object key.',
    })
  }

  return {
    version: accountLearnerMemoryPreviewVersion,
    status: blockers.length === 0 ? 'ready' : 'blocked',
    routeTitle: titleForSnapshot(snapshot),
    routeObjectKey: routeObjectKey ?? undefined,
    currentObject: currentObjectSummary(snapshot),
    currentQuestion: snapshot.currentQuestion,
    lastObservation: snapshot.lastObservation,
    workbenchObservation: workbenchObservationSummary(snapshot),
    counts: progressCounts(snapshot),
    writePlan: writePlanForSnapshot(snapshot, routeObjectKey, currentObjectKey, observationObjectKey),
    blockers,
    nextServerContract: 'POST /api/me/learning-route-snapshots',
  }
}
