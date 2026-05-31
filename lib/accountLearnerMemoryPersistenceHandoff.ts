import {
  accountLearnerMemoryDedupeKeyVersion,
} from './accountLearnerMemoryImportKeys'
import { isContentObjectKey, type ContentObjectKey } from './contentObjectKeys'
import type { AccountLearnerMemoryImportResult } from './accountLearnerMemoryServer'
import type {
  LearningObservationInsert,
  LearningRouteSnapshotInsert,
  ObjectMemoryOwnership,
} from '../db/objectMemoryTypes'

export const accountLearnerMemoryPersistenceHandoffVersion =
  'cf-account-learner-memory-persistence-handoff-v1' as const

export type AccountLearnerMemoryPersistenceHandoff = {
  version: typeof accountLearnerMemoryPersistenceHandoffVersion
  dedupeKeyVersion: typeof accountLearnerMemoryDedupeKeyVersion
  serverMode: 'contract-only'
  persisted: false
  execution: {
    status: 'not-executed'
    reason: 'persistence-runtime-adapter-not-connected'
  }
  ownership: Required<Pick<ObjectMemoryOwnership, 'ownerUserId' | 'visibility'>> & {
    organizationId: string | null
  }
  sourceSnapshot: {
    snapshotVersion: LearningRouteSnapshotInsert['snapshotJson']['version']
    source: LearningRouteSnapshotInsert['source']
    mappingId: string
    routeObjectKey: ContentObjectKey
    currentObjectKey: ContentObjectKey | null
    snapshotContentHash: string
  }
  routeSnapshot: {
    table: 'learning_route_snapshots'
    operation: 'upsert-latest-route-state'
    dedupeKey: string
    contentHash: string
    conflictTarget: readonly ['owner_user_id', 'route_snapshot_dedupe_key']
    row: LearningRouteSnapshotInsert
  }
  observation?: {
    table: 'learning_observations'
    operation: 'insert-if-absent'
    dedupeKey: string
    measuredStateHash: string
    workbenchStateHash: string | null
    conflictTarget: readonly ['owner_user_id', 'observation_dedupe_key']
    dependsOn: {
      table: 'learning_route_snapshots'
      dedupeKey: string
      snapshotIdResolution: 'resolve-after-route-snapshot-upsert'
    }
    attachment: {
      objectKey: ContentObjectKey
      resolution: 'typed-workbench-equation-object' | 'snapshot-current-object'
      currentObjectKey: ContentObjectKey | null
      workbenchEquationObjectKey: ContentObjectKey | null
    }
    row: LearningObservationInsert
  }
}

type AccountLearnerMemoryObservationHandoff = NonNullable<AccountLearnerMemoryPersistenceHandoff['observation']>

function ownershipFromRouteSnapshot(row: LearningRouteSnapshotInsert): AccountLearnerMemoryPersistenceHandoff['ownership'] {
  return {
    ownerUserId: row.ownerUserId,
    organizationId: row.organizationId ?? null,
    visibility: row.visibility ?? 'private',
  }
}

function attachmentForObservation(
  routeSnapshot: LearningRouteSnapshotInsert,
  observation: LearningObservationInsert
): AccountLearnerMemoryObservationHandoff['attachment'] {
  const workbenchEquationObjectKey = isContentObjectKey(observation.measuredState?.workbench?.equationObject.objectKey)
    ? observation.measuredState.workbench.equationObject.objectKey
    : null

  return {
    objectKey: observation.objectKey,
    resolution:
      workbenchEquationObjectKey && observation.objectKey === workbenchEquationObjectKey
        ? 'typed-workbench-equation-object'
        : 'snapshot-current-object',
    currentObjectKey: routeSnapshot.currentObjectKey ?? null,
    workbenchEquationObjectKey,
  }
}

export function buildAccountLearnerMemoryPersistenceHandoff(
  result: AccountLearnerMemoryImportResult
): AccountLearnerMemoryPersistenceHandoff | undefined {
  if (result.status !== 'write-ready' || !result.inserts) return undefined

  const { routeSnapshot, observation } = result.inserts

  return {
    version: accountLearnerMemoryPersistenceHandoffVersion,
    dedupeKeyVersion: accountLearnerMemoryDedupeKeyVersion,
    serverMode: 'contract-only',
    persisted: false,
    execution: {
      status: 'not-executed',
      reason: 'persistence-runtime-adapter-not-connected',
    },
    ownership: ownershipFromRouteSnapshot(routeSnapshot),
    sourceSnapshot: {
      snapshotVersion: routeSnapshot.snapshotJson.version,
      source: routeSnapshot.source,
      mappingId: routeSnapshot.mappingId,
      routeObjectKey: routeSnapshot.routeObjectKey,
      currentObjectKey: routeSnapshot.currentObjectKey ?? null,
      snapshotContentHash: routeSnapshot.snapshotContentHash,
    },
    routeSnapshot: {
      table: 'learning_route_snapshots',
      operation: 'upsert-latest-route-state',
      dedupeKey: routeSnapshot.routeSnapshotDedupeKey,
      contentHash: routeSnapshot.snapshotContentHash,
      conflictTarget: ['owner_user_id', 'route_snapshot_dedupe_key'],
      row: routeSnapshot,
    },
    observation: observation
      ? {
          table: 'learning_observations',
          operation: 'insert-if-absent',
          dedupeKey: observation.observationDedupeKey,
          measuredStateHash: observation.measuredStateHash,
          workbenchStateHash: observation.workbenchStateHash ?? null,
          conflictTarget: ['owner_user_id', 'observation_dedupe_key'],
          dependsOn: {
            table: 'learning_route_snapshots',
            dedupeKey: routeSnapshot.routeSnapshotDedupeKey,
            snapshotIdResolution: 'resolve-after-route-snapshot-upsert',
          },
          attachment: attachmentForObservation(routeSnapshot, observation),
          row: observation,
        }
      : undefined,
  }
}
