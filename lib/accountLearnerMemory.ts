import { isContentObjectKey, type ContentObjectKey } from './contentObjectKeys'
import type { LearningRouteSnapshot, LearningRouteSourceObject } from './learningRouteSnapshot'
import { routeObjectKeyFromLearningRouteSnapshot } from './learningRouteObjectKeys'

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
  currentObjectKey: ContentObjectKey | undefined
): AccountLearnerMemoryWritePlan[] {
  const plan: AccountLearnerMemoryWritePlan[] = [
    {
      table: 'learning_route_snapshots',
      label: 'Save route snapshot',
      objectKey: routeObjectKey ?? undefined,
      detail: routeObjectKey
        ? 'Ready for a private learning_route_snapshots row owned by the signed-in learner.'
        : 'Needs a durable route object key before it can become account memory.',
      ready: routeObjectKey !== null,
    },
  ]

  if (snapshot.lastObservation) {
    plan.push({
      table: 'learning_observations',
      label: 'Attach last observation',
      objectKey: currentObjectKey,
      detail: currentObjectKey
        ? 'Ready for a learning_observations row attached to the current content object.'
        : 'Needs the selected object to carry a content object key.',
      ready: currentObjectKey !== undefined,
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

  if (snapshot.lastObservation && !currentObjectKey) {
    blockers.push({
      id: 'missing-observation-object-key',
      label: 'Observation cannot attach yet',
      detail: 'The last observation can only become durable if it attaches to an equation, concept, demo, code witness, claim, source, or route object key.',
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
    counts: progressCounts(snapshot),
    writePlan: writePlanForSnapshot(snapshot, routeObjectKey, currentObjectKey),
    blockers,
    nextServerContract: 'POST /api/me/learning-route-snapshots',
  }
}
