import {
  buildAccountLearnerMemoryPreview,
  type AccountLearnerMemoryPreview,
} from './accountLearnerMemory'
import {
  isLearningRouteSnapshot,
  type LearningRouteSnapshot,
} from './learningRouteSnapshot'
import {
  learningRouteSnapshotToWorkbenchState,
  learningRouteSnapshotToObservationInsert,
  learningRouteSnapshotToSnapshotInsert,
} from '../db/objectMemoryMappers'
import type {
  LearningObservationInsert,
  LearningObservationWorkbenchState,
  LearningRouteSnapshotInsert,
  ObjectMemoryOwnership,
} from '../db/objectMemoryTypes'

export const accountLearnerMemoryImportVersion = 'cf-account-learner-memory-import-v1' as const

export type AccountLearnerMemoryImportStatus =
  | 'invalid'
  | 'blocked'
  | 'auth-required'
  | 'write-ready'

export type AccountLearnerMemoryImportResult = {
  version: typeof accountLearnerMemoryImportVersion
  status: AccountLearnerMemoryImportStatus
  persisted: false
  preview: AccountLearnerMemoryPreview
  reason?: string
  workbenchRestore?: LearningObservationWorkbenchState | null
  inserts?: {
    routeSnapshot: LearningRouteSnapshotInsert
    observation?: LearningObservationInsert
  }
}

const invalidPreview: AccountLearnerMemoryPreview = {
  version: 'cf-account-learner-memory-preview-v1',
  status: 'empty',
  routeTitle: 'Invalid route snapshot',
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
      label: 'Route snapshot rejected',
      detail: 'The server only accepts the compact cf-route-snapshot-v1 contract from the local learner-memory layer.',
    },
  ],
  nextServerContract: 'POST /api/me/learning-route-snapshots',
}

export function prepareAccountLearnerMemoryImport(
  candidate: unknown,
  ownership?: ObjectMemoryOwnership | null
): AccountLearnerMemoryImportResult {
  if (!isLearningRouteSnapshot(candidate)) {
    return {
      version: accountLearnerMemoryImportVersion,
      status: 'invalid',
      persisted: false,
      preview: invalidPreview,
      reason: 'The request did not include a valid cf-route-snapshot-v1 payload.',
    }
  }

  const snapshot: LearningRouteSnapshot = candidate
  const preview = buildAccountLearnerMemoryPreview(snapshot)
  const workbenchRestore = learningRouteSnapshotToWorkbenchState(snapshot)

  if (preview.status !== 'ready') {
    return {
      version: accountLearnerMemoryImportVersion,
      status: 'blocked',
      persisted: false,
      preview,
      reason: preview.blockers[0]?.detail ?? 'The snapshot is not ready for durable account memory.',
      workbenchRestore,
    }
  }

  if (!ownership?.ownerUserId) {
    return {
      version: accountLearnerMemoryImportVersion,
      status: 'auth-required',
      persisted: false,
      preview,
      reason: 'A signed-in app user is required before account memory can be written.',
      workbenchRestore,
    }
  }

  const routeSnapshot = learningRouteSnapshotToSnapshotInsert(snapshot, ownership)
  const observation = snapshot.lastObservation
    ? learningRouteSnapshotToObservationInsert(snapshot, ownership)
    : undefined

  return {
    version: accountLearnerMemoryImportVersion,
    status: 'write-ready',
    persisted: false,
    preview,
    workbenchRestore: observation?.workbenchState ?? workbenchRestore,
    inserts: {
      routeSnapshot,
      observation,
    },
  }
}
