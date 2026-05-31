import type { ContentObjectKey, ContentObjectType } from '../lib/contentObjectKeys'
import type { ContentObjectManifestObject } from '../lib/contentObjectManifest'
import type { LearningRouteSnapshot, LearningRouteSourceObject } from '../lib/learningRouteSnapshot'
import {
  accountWorkbenchRestoreStateVersion,
  type AccountWorkbenchRestoreState,
} from '../lib/workbenchRestoreProjection'

export const contentObjectOrigins = [
  'atlas-manifest',
  'user-upload',
  'paper-mapper',
  'external-source',
] as const

export const visibilityModes = ['private', 'organization'] as const
export const membershipRoles = ['owner', 'admin', 'member', 'viewer'] as const
export const threadStatuses = ['open', 'resolved', 'archived'] as const
export const aiRunStatuses = ['queued', 'running', 'succeeded', 'failed', 'cancelled'] as const

export type ContentObjectOrigin = (typeof contentObjectOrigins)[number]
export type VisibilityMode = (typeof visibilityModes)[number]
export type MembershipRole = (typeof membershipRoles)[number]
export type ThreadStatus = (typeof threadStatuses)[number]
export type AiRunStatus = (typeof aiRunStatuses)[number]

export const objectMemoryContractVersion = 'cf-object-memory-contract-v1' as const

export const requiredObjectMemoryTables = [
  'users',
  'organizations',
  'memberships',
  'webhook_events',
  'content_object_refs',
  'learning_route_snapshots',
  'learning_observations',
  'research_notes',
  'research_threads',
  'research_comments',
  'ai_runs',
  'evidence_refs',
  'uploaded_documents',
  'document_spans',
] as const

export const objectAttachedMemoryTables = [
  'learning_observations',
  'research_notes',
  'research_threads',
  'ai_runs',
  'evidence_refs',
  'uploaded_documents',
  'document_spans',
] as const

export const ownerScopedMemoryTables = [
  'learning_route_snapshots',
  'learning_observations',
  'research_notes',
  'ai_runs',
  'uploaded_documents',
] as const

export const maxRouteSnapshotJsonChars = 24000
export const maxMeasuredStateJsonChars = 8000
export const maxWorkbenchStateJsonChars = 8000
export const maxEvidenceLocatorJsonChars = 8000
export const maxAiRunJsonChars = 8000
export const maxDocumentMetadataJsonChars = 8000

export const learningObservationWorkbenchStateVersion = accountWorkbenchRestoreStateVersion

export type ObjectMemoryOwnership = {
  ownerUserId: string
  organizationId?: string | null
  visibility?: VisibilityMode
}

export type ContentObjectRefInsert = {
  objectKey: ContentObjectKey
  objectType: ContentObjectType
  origin: ContentObjectOrigin
  title: string
  href?: string | null
  domain?: string | null
  conceptId?: string | null
  status?: string | null
  stability?: ContentObjectManifestObject['stability'] | null
  manifestVersion?: string | null
  keyVersion?: string | null
  sourceIds?: readonly string[] | null
  objectRefs?: readonly ContentObjectKey[] | null
  discussionAnchorId?: string | null
}

export type LearningRouteSnapshotInsert = ObjectMemoryOwnership & {
  routeSnapshotDedupeKey: string
  snapshotContentHash: string
  source: LearningRouteSnapshot['source']
  mappingId: string
  paperTitle: string
  inputKind: string
  routeObjectKey: ContentObjectKey
  currentObjectKey?: ContentObjectKey | null
  currentQuestion?: string | null
  routeConceptIds: readonly string[]
  routeLabels: readonly string[]
  routeConcepts?: LearningRouteSnapshot['routeConcepts'] | null
  sourceObjects?: readonly LearningRouteSourceObject[] | null
  graphRoute?: LearningRouteSnapshot['graphRoute'] | null
  routeProgress?: LearningRouteSnapshot['routeProgress'] | null
  primaryEquation?: LearningRouteSnapshot['primaryEquation'] | null
  snapshotJson: LearningRouteSnapshot
}

export type LearningObservationWorkbenchState = AccountWorkbenchRestoreState

export type LearningObservationInsert = {
  ownerUserId: string
  organizationId?: string | null
  observationDedupeKey: string
  measuredStateHash: string
  workbenchStateHash?: string | null
  routeSnapshotDedupeKey?: string | null
  snapshotId?: string | null
  objectKey: ContentObjectKey
  observationSource: NonNullable<LearningRouteSnapshot['lastObservation']>['source']
  observationKind: NonNullable<LearningRouteSnapshot['lastObservation']>['kind'] | 'route-state'
  label: string
  value: string
  detail?: string | null
  nextQuestion?: string | null
  workbenchState?: LearningObservationWorkbenchState | null
  measuredState?: NonNullable<LearningRouteSnapshot['lastObservation']> | null
}

export type EvidenceRefCandidate = {
  createdByUserId: string
  organizationId?: string | null
  objectKey: ContentObjectKey
  sourceObjectKey?: ContentObjectKey | null
  sourceSpanKey?: ContentObjectKey | null
  claimText?: string | null
  quoteSnippet?: string | null
  locator?: {
    sourceObjectType: LearningRouteSourceObject['type']
    sourceObjectId?: string
    href?: string
    role?: string
    status?: string
    confidence?: LearningRouteSourceObject['confidence']
  } | null
  confidence?: LearningRouteSourceObject['confidence'] | null
}

export type UploadedDocumentInsert = ObjectMemoryOwnership & {
  objectKey: ContentObjectKey
  title: string
  sourceKind: string
  originalFilename?: string | null
  storageUri?: string | null
  mimeType?: string | null
  byteSize?: number | null
  sha256: string
  parserVersion?: string | null
  parserStatus?: string | null
  sourceProcessingConsentAt?: string | null
}

export type DocumentSpanInsert = {
  documentId: string
  objectKey: ContentObjectKey
  spanKind: string
  pageNumber?: number | null
  lineStart?: number | null
  lineEnd?: number | null
  charStart?: number | null
  charEnd?: number | null
  bbox?: Record<string, unknown> | null
  textSha256?: string | null
  extractionConfidence?: string | null
  parserVersion?: string | null
}

export class ObjectMemoryContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ObjectMemoryContractError'
  }
}
