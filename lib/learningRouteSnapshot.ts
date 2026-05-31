import type { DiscussionAnchorId } from './discussionAnchors'
import { isDiscussionAnchorId, isDiscussionObjectType } from './discussionAnchors'
import {
  contentObjectTypeFromKey,
  isContentObjectKey,
  type ContentObjectKey,
  type ContentObjectType,
} from './contentObjectKeys'

export const learningRouteSnapshotKey = 'cf:last-learning-route'
export const learningRouteSnapshotEventName = 'cf:learning-route-snapshot'

const maxSnapshotRawLength = 24000
const internalHrefBase = 'https://continuous-function.local'

export type LearningRouteSourceObject = {
  type:
    | 'paper'
    | 'concept'
    | 'equation'
    | 'source'
    | 'toy-experiment'
    | 'code-witness'
    | 'visualization'
    | 'claim'
    | 'misconception'
    | 'lab'
    | 'thread'
    | 'question'
  id?: string
  objectKey?: ContentObjectKey
  discussionAnchorId?: DiscussionAnchorId
  title: string
  href?: string
  role?: string
  status?: string
  sourceIds?: string[]
  sourceDetail?: string
  confidence?: 'high' | 'medium' | 'low'
}

export type LearningRouteGraphRoute = {
  knownConceptIds: string[]
  targetConceptId: string
  routeNodes: Array<{
    id: string
    label: string
    role: string
    group: string
    status: 'live' | 'planned'
    href?: string
  }>
  edgeWitnesses: Array<{
    from: string
    to: string
    type: string
    why: string
    weight: number
  }>
  totalWeight: number
  nextRepairId?: string
}

export type LearningRouteProgress = {
  version: 'cf-route-progress-v1'
  stageReadiness: Array<{
    stageId: string
    label: string
    status: 'not-started' | 'active' | 'ready' | 'needs-repair'
    evidence?: string
    updatedAt?: string
  }>
  checkpoints?: Array<{
    id: string
    label: string
    status: 'pending' | 'observed' | 'saved'
    detail?: string
    updatedAt?: string
  }>
  resolvedObjectIds?: string[]
  nextRepair?: string
  updatedAt: string
}

export type LearningRouteSnapshot = {
  version: 'cf-route-snapshot-v1'
  source: 'paper-map' | 'graph' | 'attention-serving' | 'concept-notebook'
  paperClueLabel?: string
  paperTitle: string
  inputKind: string
  mappingId: string
  mappingTitle?: string
  routeLabels: string[]
  routeConceptIds: string[]
  routeConcepts?: Array<{
    label: string
    href: string
    role?: string
  }>
  nextRepair?: string
  currentQuestion?: string
  primaryEquation?: {
    label: string
    equation: string
    confidence: 'high' | 'medium'
    sourceLabel?: string
  }
  labGoal?: string
  labStatus?: 'live' | 'planned'
  sourceObjects?: LearningRouteSourceObject[]
  currentObject?: LearningRouteSourceObject
  graphRoute?: LearningRouteGraphRoute
  routeProgress?: LearningRouteProgress
  lastObservation?: {
    label: string
    value: string
    detail?: string
    nextQuestion?: string
    source: 'kv-memory-lab' | 'prediction-checkpoint' | 'learning-route'
    updatedAt: string
    kind?: 'formula-comparison'
    changed?: {
      symbol: string
      from: number
      to: number
    }
    heldFixed?: Array<{
      symbol: string
      value: string | number
    }>
    result?: {
      before: number
      after: number
      ratio: number
      unit: 'GB-decimal' | 'GiB'
    }
    caveat?: string
    labState?: {
      context: number
      layers: number
      queryHeads: number
      kvHeads: number
      dHead: number
      batch: number
      bytes: number
    }
  }
  groundingStatus?: 'local-preview' | 'source-check-error' | 'source-checked' | 'metadata-resolved'
  createdAt: string
}

const validSources = new Set(['paper-map', 'graph', 'attention-serving', 'concept-notebook'])
const validLabStatuses = new Set(['live', 'planned'])
const validGroundingStatuses = new Set(['local-preview', 'source-check-error', 'source-checked', 'metadata-resolved'])
const validEquationConfidences = new Set(['high', 'medium'])
const validSourceObjectConfidences = new Set(['high', 'medium', 'low'])
const validObservationSources = new Set(['kv-memory-lab', 'prediction-checkpoint', 'learning-route'])
const validSourceObjectTypes = new Set([
  'paper',
  'concept',
  'equation',
  'source',
  'toy-experiment',
  'code-witness',
  'visualization',
  'claim',
  'misconception',
  'lab',
  'thread',
  'question',
])
const validGraphNodeStatuses = new Set(['live', 'planned'])
const validProgressStageStatuses = new Set(['not-started', 'active', 'ready', 'needs-repair'])
const validProgressCheckpointStatuses = new Set(['pending', 'observed', 'saved'])

function isBoundedStringArray(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => isBoundedString(item, maxLength))
  )
}

function isBoundedString(value: unknown, maxLength: number) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
}

function isOptionalBoundedString(value: unknown, maxLength: number) {
  return value === undefined || isBoundedString(value, maxLength)
}

function isNonNegativeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isNumberInRange(value: unknown, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function isIntegerStep(value: unknown, min: number, max: number, step = 1) {
  return Number.isInteger(value) && isNumberInRange(value, min, max) && ((value as number) - min) % step === 0
}

function isInternalHref(value: unknown) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 260 ||
    /[\u0000-\u001F\u007F\\]/.test(value)
  ) {
    return false
  }

  if (value.startsWith('#')) {
    return value.length > 1 && !value.includes(' ')
  }

  if (!value.startsWith('/') || value.startsWith('//')) return false

  try {
    return new URL(value, internalHrefBase).origin === internalHrefBase
  } catch {
    return false
  }
}

function isOptionalInternalHref(value: unknown) {
  return value === undefined || isInternalHref(value)
}

function isHeldFixed(value: unknown): value is NonNullable<NonNullable<LearningRouteSnapshot['lastObservation']>['heldFixed']> {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= 8 &&
      value.every((item) => {
        if (!item || typeof item !== 'object') return false
        const candidate = item as { symbol?: unknown; value?: unknown }
        return (
          isBoundedString(candidate.symbol, 32) &&
          (isNonNegativeNumber(candidate.value) || isBoundedString(candidate.value, 80))
        )
      }))
  )
}

function isChanged(value: unknown): value is NonNullable<NonNullable<LearningRouteSnapshot['lastObservation']>['changed']> {
  if (value === undefined) return true
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<NonNullable<NonNullable<LearningRouteSnapshot['lastObservation']>['changed']>>
  return isBoundedString(candidate.symbol, 32) && isIntegerStep(candidate.from, 0, 1_000_000) && isIntegerStep(candidate.to, 0, 1_000_000)
}

function isObservationResult(value: unknown): value is NonNullable<NonNullable<LearningRouteSnapshot['lastObservation']>['result']> {
  if (value === undefined) return true
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<NonNullable<NonNullable<LearningRouteSnapshot['lastObservation']>['result']>>
  return (
    isNumberInRange(candidate.before, 0, 1_000_000_000) &&
    isNumberInRange(candidate.after, 0, 1_000_000_000) &&
    isNumberInRange(candidate.ratio, 0.000001, 1_000_000) &&
    (candidate.unit === 'GB-decimal' || candidate.unit === 'GiB')
  )
}

function isKvLabState(value: unknown): value is NonNullable<NonNullable<LearningRouteSnapshot['lastObservation']>['labState']> {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<NonNullable<NonNullable<LearningRouteSnapshot['lastObservation']>['labState']>>
  return (
    isIntegerStep(candidate.context, 2048, 131072, 2048) &&
    isIntegerStep(candidate.layers, 8, 96, 4) &&
    isIntegerStep(candidate.queryHeads, 8, 96, 8) &&
    isIntegerStep(candidate.kvHeads, 1, candidate.queryHeads ?? 96) &&
    isIntegerStep(candidate.dHead, 64, 256, 32) &&
    isIntegerStep(candidate.batch, 1, 32) &&
    (candidate.bytes === 1 || candidate.bytes === 2 || candidate.bytes === 4)
  )
}

function isRouteConcepts(value: unknown): value is NonNullable<LearningRouteSnapshot['routeConcepts']> {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= 12 &&
      value.every(
        (item) =>
          item &&
          typeof item === 'object' &&
          isBoundedString((item as { label?: unknown }).label, 100) &&
          isInternalHref((item as { href?: unknown }).href) &&
          isOptionalBoundedString((item as { role?: unknown }).role, 120)
      ))
  )
}

function isOptionalSourceIds(value: unknown): value is LearningRouteSourceObject['sourceIds'] {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= 8 &&
      value.every((item) => isBoundedString(item, 80) && !/[\u0000-\u001F\u007F]/.test(item)))
  )
}

function isLearningRouteSourceObject(value: unknown): value is LearningRouteSourceObject {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<LearningRouteSourceObject>

  return (
    typeof candidate.type === 'string' &&
    validSourceObjectTypes.has(candidate.type) &&
    isOptionalBoundedString(candidate.id, 80) &&
    sourceObjectMatchesContentObjectKey(candidate.type, candidate.objectKey) &&
    discussionAnchorMatchesSourceObject(candidate.type, candidate.discussionAnchorId) &&
    isBoundedString(candidate.title, 180) &&
    isOptionalInternalHref(candidate.href) &&
    isOptionalBoundedString(candidate.role, 140) &&
    isOptionalBoundedString(candidate.status, 120) &&
    isOptionalSourceIds(candidate.sourceIds) &&
    isOptionalBoundedString(candidate.sourceDetail, 160) &&
    (candidate.confidence === undefined || validSourceObjectConfidences.has(candidate.confidence))
  )
}

function isSourceObjects(value: unknown): value is LearningRouteSnapshot['sourceObjects'] {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= 12 &&
      value.every(isLearningRouteSourceObject))
  )
}

function isCurrentObject(value: unknown): value is LearningRouteSnapshot['currentObject'] {
  return value === undefined || isLearningRouteSourceObject(value)
}

function discussionAnchorMatchesSourceObject(type: unknown, discussionAnchorId: unknown) {
  if (discussionAnchorId === undefined) return true
  if (!isDiscussionObjectType(type)) return false

  return isDiscussionAnchorId(discussionAnchorId) && discussionAnchorId.startsWith(`${type}/`)
}

function sourceObjectMatchesContentObjectKey(type: unknown, objectKey: unknown) {
  if (objectKey === undefined) return true
  if (typeof type !== 'string' || !validSourceObjectTypes.has(type)) return false
  if (!isContentObjectKey(objectKey)) return false

  const contentType = contentObjectTypeFromKey(objectKey)
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

  return allowedContentTypesBySourceObjectType[type as LearningRouteSourceObject['type']].includes(contentType)
}

function isGraphRoute(value: unknown): value is LearningRouteSnapshot['graphRoute'] {
  if (value === undefined) return true
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<NonNullable<LearningRouteSnapshot['graphRoute']>>

  return (
    isBoundedStringArray(candidate.knownConceptIds, 12, 80) &&
    candidate.knownConceptIds.length > 0 &&
    isBoundedString(candidate.targetConceptId, 80) &&
    Array.isArray(candidate.routeNodes) &&
    candidate.routeNodes.length > 0 &&
    candidate.routeNodes.length <= 12 &&
    candidate.routeNodes.every((node) => {
      if (!node || typeof node !== 'object') return false

      const routeNode = node as Partial<NonNullable<LearningRouteSnapshot['graphRoute']>['routeNodes'][number]>

      return (
        isBoundedString(routeNode.id, 80) &&
        isBoundedString(routeNode.label, 100) &&
        isBoundedString(routeNode.role, 140) &&
        isBoundedString(routeNode.group, 80) &&
        typeof routeNode.status === 'string' &&
        validGraphNodeStatuses.has(routeNode.status) &&
        isOptionalInternalHref(routeNode.href)
      )
    }) &&
    Array.isArray(candidate.edgeWitnesses) &&
    candidate.edgeWitnesses.length <= 12 &&
    candidate.edgeWitnesses.every((edge) => {
      if (!edge || typeof edge !== 'object') return false

      const witness = edge as Partial<NonNullable<LearningRouteSnapshot['graphRoute']>['edgeWitnesses'][number]>

      return (
        isBoundedString(witness.from, 80) &&
        isBoundedString(witness.to, 80) &&
        isBoundedString(witness.type, 80) &&
        isBoundedString(witness.why, 280) &&
        isNumberInRange(witness.weight, 0, 100)
      )
    }) &&
    isNumberInRange(candidate.totalWeight, 0, 100) &&
    isOptionalBoundedString(candidate.nextRepairId, 80)
  )
}

function isPrimaryEquation(value: unknown): value is LearningRouteSnapshot['primaryEquation'] {
  if (value === undefined) return true
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<NonNullable<LearningRouteSnapshot['primaryEquation']>>
  return (
    isBoundedString(candidate.label, 120) &&
    isBoundedString(candidate.equation, 500) &&
    typeof candidate.confidence === 'string' &&
    validEquationConfidences.has(candidate.confidence) &&
    isOptionalBoundedString(candidate.sourceLabel, 160)
  )
}

function isOptionalIsoDate(value: unknown) {
  return value === undefined || (typeof value === 'string' && !Number.isNaN(Date.parse(value)))
}

function isRouteProgress(value: unknown): value is LearningRouteProgress | undefined {
  if (value === undefined) return true
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<LearningRouteProgress>

  return (
	    candidate.version === 'cf-route-progress-v1' &&
	    Array.isArray(candidate.stageReadiness) &&
	    candidate.stageReadiness.length > 0 &&
	    candidate.stageReadiness.length <= 12 &&
    candidate.stageReadiness.every((stage) => {
      if (!stage || typeof stage !== 'object') return false

      const progressStage = stage as Partial<LearningRouteProgress['stageReadiness'][number]>
      return (
        isBoundedString(progressStage.stageId, 80) &&
        isBoundedString(progressStage.label, 100) &&
        typeof progressStage.status === 'string' &&
        validProgressStageStatuses.has(progressStage.status) &&
        isOptionalBoundedString(progressStage.evidence, 180) &&
        isOptionalIsoDate(progressStage.updatedAt)
      )
    }) &&
    (candidate.checkpoints === undefined ||
      (Array.isArray(candidate.checkpoints) &&
        candidate.checkpoints.length <= 12 &&
        candidate.checkpoints.every((checkpoint) => {
          if (!checkpoint || typeof checkpoint !== 'object') return false

          const progressCheckpoint = checkpoint as Partial<NonNullable<LearningRouteProgress['checkpoints']>[number]>
          return (
            isBoundedString(progressCheckpoint.id, 80) &&
            isBoundedString(progressCheckpoint.label, 100) &&
            typeof progressCheckpoint.status === 'string' &&
            validProgressCheckpointStatuses.has(progressCheckpoint.status) &&
            isOptionalBoundedString(progressCheckpoint.detail, 180) &&
            isOptionalIsoDate(progressCheckpoint.updatedAt)
          )
        }))) &&
    isBoundedStringArray(candidate.resolvedObjectIds ?? [], 24, 220) &&
    isOptionalBoundedString(candidate.nextRepair, 120) &&
    typeof candidate.updatedAt === 'string' &&
    !Number.isNaN(Date.parse(candidate.updatedAt))
  )
}

function isLastObservation(value: unknown): value is LearningRouteSnapshot['lastObservation'] {
  if (value === undefined) return true
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<NonNullable<LearningRouteSnapshot['lastObservation']>>
  const hasFormulaStructure =
    candidate.kind !== 'formula-comparison' ||
    (candidate.changed !== undefined &&
      Array.isArray(candidate.heldFixed) &&
      candidate.heldFixed.length > 0 &&
      candidate.result !== undefined &&
      isBoundedString(candidate.caveat, 180) &&
      candidate.labState !== undefined)

  return (
    isBoundedString(candidate.label, 80) &&
    isBoundedString(candidate.value, 160) &&
    isOptionalBoundedString(candidate.detail, 360) &&
    isOptionalBoundedString(candidate.nextQuestion, 220) &&
    typeof candidate.source === 'string' &&
    validObservationSources.has(candidate.source) &&
    typeof candidate.updatedAt === 'string' &&
    !Number.isNaN(Date.parse(candidate.updatedAt)) &&
    (candidate.kind === undefined || candidate.kind === 'formula-comparison') &&
    isChanged(candidate.changed) &&
    isHeldFixed(candidate.heldFixed) &&
    isObservationResult(candidate.result) &&
    isOptionalBoundedString(candidate.caveat, 180) &&
    hasFormulaStructure &&
    (candidate.labState === undefined || isKvLabState(candidate.labState))
  )
}

function isSnapshot(value: unknown): value is LearningRouteSnapshot {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<LearningRouteSnapshot>
  return (
    candidate.version === 'cf-route-snapshot-v1' &&
    typeof candidate.source === 'string' &&
    validSources.has(candidate.source) &&
    isOptionalBoundedString(candidate.paperClueLabel, 220) &&
    isBoundedString(candidate.paperTitle, 220) &&
    isBoundedString(candidate.inputKind, 80) &&
    isBoundedString(candidate.mappingId, 80) &&
    isOptionalBoundedString(candidate.mappingTitle, 140) &&
    isBoundedStringArray(candidate.routeLabels, 12, 100) &&
    isBoundedStringArray(candidate.routeConceptIds, 12, 80) &&
    isRouteConcepts(candidate.routeConcepts) &&
    isOptionalBoundedString(candidate.nextRepair, 120) &&
    isOptionalBoundedString(candidate.currentQuestion, 220) &&
    isPrimaryEquation(candidate.primaryEquation) &&
    isOptionalBoundedString(candidate.labGoal, 220) &&
    (candidate.labStatus === undefined || validLabStatuses.has(candidate.labStatus)) &&
    isSourceObjects(candidate.sourceObjects) &&
    isCurrentObject(candidate.currentObject) &&
    isGraphRoute(candidate.graphRoute) &&
    isRouteProgress(candidate.routeProgress) &&
    isLastObservation(candidate.lastObservation) &&
    (candidate.groundingStatus === undefined || validGroundingStatuses.has(candidate.groundingStatus)) &&
    typeof candidate.createdAt === 'string' &&
    !Number.isNaN(Date.parse(candidate.createdAt))
  )
}

export function isLearningRouteSnapshot(value: unknown): value is LearningRouteSnapshot {
  return isSnapshot(value)
}

export function getSavedLearningRouteSnapshot() {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(learningRouteSnapshotKey)
    if (!raw) return null
    if (raw.length > maxSnapshotRawLength) return null

    const parsed = JSON.parse(raw)
    return isSnapshot(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveLearningRouteSnapshot(snapshot: LearningRouteSnapshot) {
  if (typeof window === 'undefined') return false

  try {
    if (!isSnapshot(snapshot)) return false

    const raw = JSON.stringify(snapshot)
    if (raw.length > maxSnapshotRawLength) return false

    window.localStorage.setItem(learningRouteSnapshotKey, raw)
    if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent(learningRouteSnapshotEventName, { detail: snapshot }))
    }
    return true
  } catch {
    // Local storage is a convenience handoff, not required for the page to work.
    return false
  }
}

export function clearLearningRouteSnapshot() {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(learningRouteSnapshotKey)
    if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent(learningRouteSnapshotEventName, { detail: null }))
    }
  } catch {
    // Ignore storage failures; clearing should never block navigation.
  }
}
