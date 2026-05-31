import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import katex from 'katex'
import SectionAIActionStrip from '../ai/SectionAIActionStrip'
import NotebookLayout from '../editorial/NotebookLayout'
import PracticeShell from '../practice/PracticeShell'
import LearningRouteContinuityBanner from '../product/LearningRouteContinuityBanner'
import VizShell from '../viz/VizShell'
import ConceptNotebookRail from './ConceptNotebookRail'
import EfficientAttentionLivingLabPanel, {
  efficientAttentionWorkbenchLabId,
  efficientAttentionWorkbenchLabVersion,
  type EfficientAttentionWorkbenchObservation,
} from './EfficientAttentionLivingLabPanel'
import ConceptMechanismStoryboard from './ConceptMechanismStoryboard'
import ConceptVisualInquiryPanel, { type ConceptVisualInquiryReveal } from './ConceptVisualInquiryPanel'
import ConceptSection from './ConceptSection'
import ObjectRoomPanel from './ObjectRoomPanel'
import SelectedObjectBar, {
  type SelectedObjectAction,
  type SelectedObjectBadge,
  type SelectedObjectHistoryBridge,
  type SelectedObjectOption,
  type SelectedObjectSavedAction,
  type SelectedObjectWitness,
} from './SelectedObjectBar'
import WitnessTriad from './WitnessTriad'
import DemoPredictionCheckpoint, { type DemoPredictionCheckpointReveal } from './DemoPredictionCheckpoint'
import ResearchReadingRoom from '../discussion/ResearchReadingRoom'
import { type DiscussionAnchorListItem } from '@/lib/discussionAnchors'
import {
  buildConceptDiscussionItems,
  claimCheckDomIdForConceptClaimCheck,
  sourceDomIdForConceptSource,
  sourceSpanDomIdForConceptSource,
} from '@/lib/conceptNotebookDiscussion'
import { conceptObjectSpanLabel, type ConceptObjectSpan } from '@/lib/conceptObjectSpans'
import {
  buildWitnessTriadsForConcept,
  type WitnessTriadObservation,
} from '@/lib/conceptWitnessTriads'
import {
  getSavedLearningRouteSnapshot,
  learningRouteSnapshotEventName,
  saveLearningRouteSnapshot,
  type LearningRouteSnapshot,
  type LearningRouteSourceObject,
} from '@/lib/learningRouteSnapshot'
import {
  getLocalObjectActionDraft,
  getLocalObjectActionResolution,
  localObjectActionJournalEventName,
  type LocalObjectActionDraft,
  type LocalObjectActionResolution,
} from '@/lib/localObjectActionJournal'
import { routeSourceObjectFromDiscussionItem } from '@/lib/researchDiscussionRoom'
import { formatDemoStateForPrompt } from '@/lib/demoState'
import {
  claimEvidenceReviewLabel,
  claimEvidenceReviewWarning,
  isSubstantiveEvidenceReview,
  normalizeClaimEvidenceReview,
  type ClaimEvidenceReview,
} from '@/lib/claimEvidenceReview'
import { sanitizeRenderedHtml } from '@/lib/htmlSafety'

type ConceptMetaPublic = {
  id: string
  title: string
  domain: string
  slug: string
  difficulty: number
  status: string
  importance: string
  prerequisites?: string[]
  leads_to?: string[]
  related?: string[]
  tags?: string[]
  has_visualization?: boolean
  has_interactive_demo?: boolean
  has_code_example?: boolean
  math_level?: string
  sources?: ConceptSource[]
  claim_checks?: ConceptClaimCheck[]
  short_description?: string
  author?: string
  created?: string
  updated?: string
  estimated_read_time?: number
}

type ResolvedLink = {
  id: string
  title?: string
  href?: string
}

type Neighbor = {
  title: string
  href: string
}

type ConceptImage = {
  src: string
  alt: string
}

type ConceptSource = {
  id: string
  title: string
  authors?: string
  year?: number
  kind?: string
  url?: string
  note?: string
}

type ConceptClaimCheck = {
  id: string
  claim: string
  status: 'source-checked' | 'needs-review' | 'weakened'
  source_ids?: string[]
  support?: string
  caveat?: string
  object_refs?: string[]
  evidence_review?: ClaimEvidenceReview
}

type Props = {
  domainTitle: string
  concept: ConceptMetaPublic
  sections: {
    intuitionHtml: string
    mathHtml: string
    codeHtml: string
    demoHtml: string
  }
  sectionPrompts?: {
    intuition: string
    math: string
    code: string
    demo: string
  }
  objectSpans?: ConceptObjectSpan[]
  prerequisites: ResolvedLink[]
  leadsTo: ResolvedLink[]
  related: ResolvedLink[]
  prevInDomain: Neighbor | null
  nextInDomain: Neighbor | null
  conceptImage?: ConceptImage | null
  Viz?: ComponentType
}

type SectionOverview = {
  id: 'intuition' | 'math' | 'code' | 'interactive-demo'
  label: string
  step: string
  summary: string
  ready: boolean
}

function snapshotString(value: string | undefined, limit: number, fallback = 'Concept notebook') {
  const text = value?.trim() || fallback
  if (text.length <= limit) return text
  if (limit <= 3) return text.slice(0, limit)
  return `${text.slice(0, limit - 3).trimEnd()}...`
}

function snapshotRouteConcept(item: ResolvedLink, role: string) {
  if (!item.href) return null

  return {
    label: snapshotString(item.title ?? item.id, 100),
    href: item.href,
    role: snapshotString(role, 120),
  }
}

function compactDemoStateForObservation(state: DemoPredictionCheckpointReveal['demoState']) {
  if (!state) return undefined

  const values = state.values ?? []
  const compactAssignmentValue = (value: string) => {
    const match = value.match(/^([^:]+):\s*(.*)$/)
    if (!match) return value
    const [, label, rawItems] = match
    const items = rawItems.split(';').map((item) => item.trim()).filter(Boolean)
    if (items.length <= 3) return value
    return `${label}: ${items.slice(0, 3).join('; ')}; ...`
  }
  const priorityPatterns = [
    /actual gate regime/i,
    /silu/i,
    /product/i,
    /selected-channel/i,
    /parameter-budget/i,
    /actual: capacity-/i,
    /servedAssignments:/i,
    /droppedAssignments:/i,
    /overflowExpertIds:/i,
    /winner/i,
    /mechanism/i,
    /prediction correct/i,
    /expected/i,
    /active demo/i,
    /invariant/i,
    /constraint/i,
    /revealed/i,
  ]
  const hasCapacityDiagnostics =
    values.some((value) => /actual: capacity-/i.test(value)) &&
    values.some((value) => /servedAssignments:/i.test(value)) &&
    values.some((value) => /droppedAssignments:/i.test(value))
  const hasMoeServingDiagnostics =
    values.some((value) => /^winner:/i.test(value)) &&
    values.some((value) => /^all-to-all bytes:/i.test(value)) &&
    values.some((value) => /^expert straggler time:/i.test(value))
  const capacityValues = hasCapacityDiagnostics
    ? [
        values.find((value) => /actual: capacity-/i.test(value)),
        values.find((value) => /servedAssignments:/i.test(value)),
        values.find((value) => /droppedAssignments:/i.test(value)),
        values.find((value) => /overflowExpertIds:/i.test(value)),
        values.find((value) => /prediction correct/i.test(value)),
      ].filter(Boolean).map((value) => compactAssignmentValue(value!))
    : []
  const moeServingValues = hasMoeServingDiagnostics
    ? [
        values.find((value) => /^winner:/i.test(value)),
        values.find((value) => /prediction correct/i.test(value)),
        values.find((value) => /^max\/mean load:/i.test(value)),
        values.find((value) => /^all-to-all bytes:/i.test(value)),
        values.find((value) => /^communication time:/i.test(value)),
        values.find((value) => /^expert straggler time:/i.test(value)),
      ].filter((value): value is string => Boolean(value))
    : []
  const visibleValues = hasCapacityDiagnostics
    ? capacityValues
    : hasMoeServingDiagnostics
      ? moeServingValues
      : values.length > 5
        ? [
            ...priorityPatterns.flatMap((pattern) => values.filter((value) => pattern.test(value))),
            ...values,
          ].filter((value, index, list) => list.indexOf(value) === index).slice(0, 5)
        : values

  return formatDemoStateForPrompt({
    ...state,
    summary: hasCapacityDiagnostics
      ? snapshotString(state.summary, 96)
      : hasMoeServingDiagnostics
        ? snapshotString(state.summary, 72)
        : state.summary,
    values: visibleValues,
  })
}

const objectFlowPreferredTypes = ['concept', 'equation', 'code-witness', 'visualization', 'claim', 'source'] as const

function objectFlowTypeLabel(type: DiscussionAnchorListItem['anchor']['objectType']) {
  if (type === 'code-witness') return 'Code'
  if (type === 'visualization') return 'Demo'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function objectFlowHrefFragment(item: DiscussionAnchorListItem | undefined) {
  const href = item?.anchor.href
  if (!href) return null
  const fragmentIndex = href.indexOf('#')
  if (fragmentIndex < 0) return null
  const fragment = href.slice(fragmentIndex + 1).trim()
  return fragment || null
}

function decodeHtmlText(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function codeWitnessLineFromHtml(codeHtml: string | undefined) {
  if (!codeHtml) return null

  const text = decodeHtmlText(
    codeHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(pre|code|span|div|p)>/gi, '\n')
      .replace(/<[^>]*>/g, '')
  )
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('import ') && !line.startsWith('from ') && !line.startsWith('def '))

  return (
    lines.find((line) => /assert|out_stream|stream|scores\s*=|q\s*@|matmul|einsum/i.test(line)) ??
    lines.find((line) => /=/.test(line)) ??
    lines[0] ??
    null
  )
}

function codeWitnessDetail(
  item: DiscussionAnchorListItem | undefined,
  codeObjectSpans: ConceptObjectSpan[],
  codeHtml: string | undefined
) {
  const fragment = objectFlowHrefFragment(item)
  const span =
    (fragment ? codeObjectSpans.find((candidate) => candidate.domId === fragment) : undefined) ??
    codeObjectSpans[0]
  const codeLine = codeWitnessLineFromHtml(codeHtml)
  const spanSnippet = span?.snippet
  const spanStartsWithBoilerplate = Boolean(spanSnippet && /^\s*(import|from)\b/i.test(spanSnippet))

  return (
    (spanSnippet && !spanStartsWithBoilerplate ? spanSnippet : undefined) ??
    codeLine ??
    spanSnippet ??
    item?.anchor.contextLabel ??
    'Compare the implementation against the selected object.'
  )
}

function isExactObjectFlowItem(item: DiscussionAnchorListItem) {
  if (!item.anchor.objectKey) return false

  const fragment = objectFlowHrefFragment(item)
  if (item.anchor.objectType === 'claim') return Boolean(fragment && fragment !== 'claim-review')
  if (item.anchor.objectType === 'source') return Boolean(fragment && fragment !== 'source-grounding')
  if (item.anchor.objectType === 'equation') return Boolean(fragment && fragment !== 'math')
  if (item.anchor.objectType === 'code-witness') return Boolean(fragment && fragment !== 'code')
  return true
}

function buildObjectFlowItems(items: DiscussionAnchorListItem[], maxItems = 6) {
  const selected: DiscussionAnchorListItem[] = []
  const seen = new Set<string>()

  const pushItem = (item: DiscussionAnchorListItem | undefined) => {
    if (!item?.anchor.href) return
    const key = item.anchor.objectKey ?? item.anchor.id
    if (seen.has(key)) return
    seen.add(key)
    selected.push(item)
  }

  objectFlowPreferredTypes.forEach((type) => {
    const exactObject = items.find((item) => item.anchor.objectType === type && isExactObjectFlowItem(item))
    pushItem(exactObject ?? items.find((item) => item.anchor.objectType === type))
  })

  items.forEach((item) => {
    if (selected.length >= maxItems) return
    pushItem(item)
  })

  return selected.slice(0, maxItems)
}

function efficientAttentionKvCacheRoomItem(items: DiscussionAnchorListItem[]) {
  return (
    items.find((item) => item.anchor.objectKey === 'equation:attention-transformers/efficient-attention#math-object-2') ??
    items.find((item) => item.anchor.href?.endsWith('#math-object-2')) ??
    items.find((item) => item.anchor.objectType === 'equation' && /Mem|H_\\?\\{?kv\\}?|cache/i.test(item.anchor.contextLabel ?? '')) ??
    null
  )
}

function objectFlowItemsForConcept(conceptId: string, discussionItems: DiscussionAnchorListItem[]) {
  const maxItems = conceptId === 'efficient-attention' ? 7 : 6
  const baseItems = buildObjectFlowItems(discussionItems, maxItems)
  if (conceptId !== 'efficient-attention') return baseItems

  const kvCacheItem = efficientAttentionKvCacheRoomItem(discussionItems)
  if (!kvCacheItem) return baseItems

  const kvCacheKey = kvCacheItem.anchor.objectKey ?? kvCacheItem.anchor.id
  const withoutKvCache = baseItems.filter((item) => (item.anchor.objectKey ?? item.anchor.id) !== kvCacheKey)
  return [kvCacheItem, ...withoutKvCache].slice(0, maxItems)
}

function defaultObjectFlowItemForConcept(conceptId: string, objectFlowItems: DiscussionAnchorListItem[]) {
  if (conceptId === 'efficient-attention') {
    return efficientAttentionKvCacheRoomItem(objectFlowItems) ?? objectFlowItems[0]
  }

  return objectFlowItems[0]
}

function claimCheckMatchesObjectFlowItem(
  check: ConceptClaimCheck,
  index: number,
  item: DiscussionAnchorListItem | undefined
) {
  const fragment = objectFlowHrefFragment(item)
  if (!fragment) return false

  if (claimCheckDomIdForConceptClaimCheck(check, index) === fragment) return true

  const localFragmentRef = `#${fragment}`
  return (check.object_refs ?? [])
    .map((objectRef) => objectRef.trim())
    .some((objectRef) => objectRef === localFragmentRef || objectRef.endsWith(localFragmentRef))
}

function selectedObjectClaimBadge(check: ConceptClaimCheck | undefined) {
  if (!check) return 'No claim check matched'
  if (isSubstantiveEvidenceReview(check.evidence_review)) return 'Claim reviewed'
  if (check.status === 'source-checked') return 'Claim metadata checked'
  return check.status === 'weakened' ? 'Claim caveat flagged' : 'Claim needs review'
}

function objectFlowContextLabel(item: DiscussionAnchorListItem, maxLength = 86) {
  if (item.anchor.objectKey && item.anchor.objectType === 'equation') return 'Exact equation object'
  if (item.anchor.objectKey && item.anchor.objectType === 'code-witness') return 'Exact code witness'
  if (item.anchor.objectType === 'claim') return isExactObjectFlowItem(item) ? 'Exact claim check' : 'Mechanism claim'
  if (item.anchor.objectType === 'source') return isExactObjectFlowItem(item) ? 'Exact source object' : 'Source grounding'
  if (item.anchor.contextLabel) return snapshotString(item.anchor.contextLabel, maxLength)
  if (item.anchor.sourceIds?.length) return snapshotString(`${item.anchor.sourceIds.length} source IDs attached`, maxLength)
  return 'Object attached'
}

function objectFlowProgressSummary(snapshot: LearningRouteSnapshot | null) {
  const stages = snapshot?.routeProgress?.stageReadiness ?? []
  if (!stages.length) return null

  const readyCount = stages.filter((stage) => stage.status === 'ready').length
  const checkpointCount = snapshot?.routeProgress?.checkpoints?.filter((checkpoint) => checkpoint.status !== 'pending').length ?? 0
  const baseSummary = `${readyCount}/${stages.length} sections ready`
  return checkpointCount > 0 ? `${baseSummary} | ${checkpointCount} checkpoints observed` : baseSummary
}

function isRouteHistoryObject(object: LearningRouteSourceObject | undefined) {
  return (
    Boolean(object?.href) &&
    (object?.status === 'resolved route history' || object?.status === 'route handoff history')
  )
}

function normalizedHrefPath(href: string | undefined) {
  if (!href) return null
  return href.split('#')[0]?.replace(/\/+$/, '') || '/'
}

function conceptIdFromHref(href: string | undefined, fallback = 'nearby-domain-concept') {
  const normalized = normalizedHrefPath(href)
  if (!normalized) return fallback
  return normalized.split('/').filter(Boolean).pop() ?? fallback
}

function routeHrefsMatch(a: string | undefined, b: string | undefined) {
  const normalizedA = normalizedHrefPath(a)
  const normalizedB = normalizedHrefPath(b)
  return Boolean(normalizedA && normalizedB && normalizedA === normalizedB)
}

function snapshotNextRepairMatchesConcept(snapshot: LearningRouteSnapshot | null, conceptHref: string) {
  const nextRepair = nextRepairConcept(snapshot)
  return Boolean(nextRepair?.href && routeHrefsMatch(nextRepair.href, conceptHref))
}

function uniqueSnapshotStrings(values: Array<string | undefined>, maxItems: number, limit: number) {
  const seen = new Set<string>()
  const result: string[] = []

  values.forEach((value) => {
    const next = snapshotString(value, limit, '').trim()
    if (!next || seen.has(next)) return
    seen.add(next)
    result.push(next)
  })

  return result.slice(0, maxItems)
}

function mergeRouteConceptTrail(
  previousConcepts: LearningRouteSnapshot['routeConcepts'] = [],
  nextConcepts: LearningRouteSnapshot['routeConcepts'] = []
) {
  const seen = new Set<string>()
  const result: NonNullable<LearningRouteSnapshot['routeConcepts']> = []

  ;[...previousConcepts, ...nextConcepts].forEach((concept) => {
    const key = normalizedHrefPath(concept.href) ?? concept.label
    if (seen.has(key)) return
    seen.add(key)
    result.push(concept)
  })

  const sliced = result.slice(0, 12)
  const hasConcept = (concept: NonNullable<LearningRouteSnapshot['routeConcepts']>[number]) => {
    const key = normalizedHrefPath(concept.href) ?? concept.label
    return sliced.some((candidate) => (normalizedHrefPath(candidate.href) ?? candidate.label) === key)
  }
  const omittedNextRepair = result.find((concept) => concept.role === 'next repair' && !hasConcept(concept))
  if (!omittedNextRepair || sliced.length < 12) return sliced

  return [...sliced.slice(0, 11), omittedNextRepair]
}

function preserveActivatedRouteTrail(
  snapshot: LearningRouteSnapshot,
  previousSnapshot: LearningRouteSnapshot | null,
  conceptHref: string
): LearningRouteSnapshot {
  if (previousSnapshot?.mappingId === snapshot.mappingId) {
    const previousHasRicherTrail =
      previousSnapshot.routeLabels.length > snapshot.routeLabels.length ||
      (previousSnapshot.routeConcepts?.length ?? 0) > (snapshot.routeConcepts?.length ?? 0) ||
      (previousSnapshot.sourceObjects ?? []).some(isRouteHistoryObject)

    if (previousHasRicherTrail) {
      return {
        ...snapshot,
        routeLabels: uniqueSnapshotStrings(
          [...previousSnapshot.routeLabels, ...snapshot.routeLabels],
          12,
          100
        ),
        routeConceptIds: uniqueSnapshotStrings(
          [...previousSnapshot.routeConceptIds, ...snapshot.routeConceptIds],
          12,
          80
        ),
        routeConcepts: mergeRouteConceptTrail(previousSnapshot.routeConcepts, snapshot.routeConcepts),
      }
    }
  }

  if (!previousSnapshot || !snapshotNextRepairMatchesConcept(previousSnapshot, conceptHref)) return snapshot

  return {
    ...snapshot,
    routeLabels: uniqueSnapshotStrings(
      [...previousSnapshot.routeLabels, snapshot.nextRepair],
      12,
      100
    ),
    routeConceptIds: uniqueSnapshotStrings(
      [...previousSnapshot.routeConceptIds, ...snapshot.routeConceptIds],
      12,
      80
    ),
    routeConcepts: mergeRouteConceptTrail(previousSnapshot.routeConcepts, snapshot.routeConcepts),
  }
}

function routeHandoffSourceDetail(previousSnapshot: LearningRouteSnapshot) {
  const observation = previousSnapshot.lastObservation
  if (observation?.source === 'prediction-checkpoint') {
    return snapshotString(`${observation.label}: ${observation.value}`, 160)
  }

  return snapshotString(
    `Opened ${previousSnapshot.nextRepair ?? 'the next repair'} from this comparison bridge.`,
    160
  )
}

function resolvedRouteHistoryObjects(
  previousSnapshot: LearningRouteSnapshot | null,
  currentConceptId: string,
  currentConceptHref: string
): LearningRouteSourceObject[] {
  if (!previousSnapshot) return []

  const existingHistory = (previousSnapshot.sourceObjects ?? []).filter(isRouteHistoryObject)
  const shouldAddPreviousObject = previousSnapshot.mappingId !== `concept:${currentConceptId}`
  const previousObject = shouldAddPreviousObject ? previousSnapshot.currentObject : null
  const resolution = getLocalObjectActionResolution(previousObject?.objectKey)
  const openedNextRepair = snapshotNextRepairMatchesConcept(previousSnapshot, currentConceptHref)
  const resolvedObject =
    previousObject?.objectKey && resolution
      ? {
          ...previousObject,
          title: snapshotString(resolution.objectTitle || previousObject.title, 180),
          role: snapshotString(resolution.resolvedAction, 140),
          status: 'resolved route history',
          sourceDetail: snapshotString(resolution.resolutionNote, 160),
          confidence: previousObject.confidence ?? ('high' as const),
        }
      : null
  const handoffObject =
    !resolvedObject && previousObject?.href && openedNextRepair
      ? {
          ...previousObject,
          role: snapshotString(
            `Previous active repair before ${previousSnapshot.nextRepair ?? 'this next repair'}`,
            140
          ),
          status: 'route handoff history',
          sourceDetail: routeHandoffSourceDetail(previousSnapshot),
          confidence: previousObject.confidence ?? ('medium' as const),
        }
      : null

  const carriedObject = resolvedObject ?? handoffObject
  const merged = carriedObject ? [carriedObject, ...existingHistory] : existingHistory
  const seen = new Set<string>()
  return merged.filter((object) => {
    const key = object.objectKey ?? object.href ?? object.title
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 9)
}

function preserveResolvedRouteHistory(
  snapshot: LearningRouteSnapshot,
  previousSnapshot: LearningRouteSnapshot | null,
  currentConceptId: string,
  currentConceptHref: string
): LearningRouteSnapshot {
  const history = resolvedRouteHistoryObjects(previousSnapshot, currentConceptId, currentConceptHref)
  if (!history.length) return snapshot

  const historyKeys = new Set(history.map((object) => object.objectKey ?? object.href ?? object.title))
  const sourceObjects = [
    ...history,
    ...(snapshot.sourceObjects ?? []).filter((object) => !historyKeys.has(object.objectKey ?? object.href ?? object.title)),
  ].slice(0, 12)

  return {
    ...snapshot,
    sourceObjects,
  }
}

function routeHistoryObjectForConcept(snapshot: LearningRouteSnapshot | null, conceptHref: string) {
  const conceptPath = normalizedHrefPath(conceptHref)
  if (!snapshot || !conceptPath) return null

  return (
    snapshot.sourceObjects?.find(
      (object) => isRouteHistoryObject(object) && normalizedHrefPath(object.href) === conceptPath
    ) ?? null
  )
}

function isInspectingSavedRouteHistory(
  snapshot: LearningRouteSnapshot | null,
  conceptId: string,
  conceptHref: string
) {
  return Boolean(
    snapshot?.mappingId !== `concept:${conceptId}` &&
      !snapshotNextRepairMatchesConcept(snapshot, conceptHref) &&
      routeHistoryObjectForConcept(snapshot, conceptHref)
  )
}

function routeHistoryObjects(snapshot: LearningRouteSnapshot | null) {
  return snapshot?.sourceObjects?.filter(isRouteHistoryObject) ?? []
}

function routeHistoryObjectKey(object: LearningRouteSourceObject) {
  return object.href ?? object.objectKey ?? object.title
}

function routeHistoryObjectsAfterPrimary(
  objects: LearningRouteSourceObject[],
  primary: LearningRouteSourceObject | null
) {
  const primaryKey = primary ? routeHistoryObjectKey(primary) : null
  const seen = new Set<string>()

  return objects.filter((object) => {
    const key = routeHistoryObjectKey(object)
    if (key === primaryKey || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function routeHistorySummary(objects: LearningRouteSourceObject[]) {
  return objects.map((object) => object.title).join('; ')
}

function routeHistoryLinkLabel(object: LearningRouteSourceObject, index: number) {
  return index === 0 ? 'Inspect earlier history' : `Inspect deeper history: ${snapshotString(object.title, 56)}`
}

function nextRepairConcept(snapshot: LearningRouteSnapshot | null) {
  if (!snapshot?.nextRepair) return null
  const normalizedNextRepair = snapshot.nextRepair.toLowerCase()
  const exact = snapshot.routeConcepts?.find((concept) => concept.label === snapshot.nextRepair && concept.href)
  if (exact) return exact

  const fuzzyCandidates = snapshot.routeConcepts
    ?.map((concept) => {
    const normalizedLabel = concept.label.toLowerCase()
      if (!concept.href) return null
      if (normalizedNextRepair.startsWith(normalizedLabel)) return { concept, score: 80 }
      if (normalizedLabel.startsWith(normalizedNextRepair)) return { concept, score: 70 }
      if (normalizedNextRepair.includes(normalizedLabel)) return { concept, score: 50 }
      if (normalizedLabel.includes(normalizedNextRepair)) return { concept, score: 40 }
      return null
    })
    .filter(Boolean) as Array<{ concept: NonNullable<LearningRouteSnapshot['routeConcepts']>[number]; score: number }> | undefined

  const fuzzy = fuzzyCandidates?.sort((a, b) => b.score - a.score || b.concept.label.length - a.concept.label.length)[0]

  return fuzzy ? { ...fuzzy.concept, label: snapshot.nextRepair } : null
}

function routeHistoryComparisonDetail(
  historyObject: LearningRouteSourceObject,
  activeTitle: string,
  nextRepair?: string
) {
  if (/flashattention/i.test(historyObject.title) && /serving/i.test(activeTitle)) {
    if (nextRepair) {
      return `Memory math is fixed; next compare decode-time choices in ${nextRepair}.`
    }
    return 'Resolved memory math tells you what was fixed; now compare which serving bottleneck remains in prefill, decode, batching, and KV cache.'
  }

  if (/moe serving|token dispatch|expert scheduling/i.test(historyObject.title) && /speculative/i.test(activeTitle)) {
    if (nextRepair) {
      return `MoE serving bottleneck is preserved as prior history; now test draft-target verification before ${nextRepair}.`
    }
    return 'MoE serving bottleneck is preserved as prior history; now test whether draft-target verification can repair decode latency.'
  }

  if (/serving/i.test(historyObject.title) && /decoding|sampling/i.test(activeTitle)) {
    if (nextRepair) {
      return `Serving bottlenecks are preserved as the prior repair; now test decode-time controls before ${nextRepair}.`
    }
    return 'Serving bottlenecks are preserved as the prior repair; now test which decode-time control changes next-token behavior.'
  }

  if (/decoding|sampling/i.test(historyObject.title) && /speculative/i.test(activeTitle)) {
    if (nextRepair) {
      return `Decode-time behavior is preserved as prior history; now test whether draft-target match creates real speedup before ${nextRepair}.`
    }
    return 'Decode-time behavior is preserved as prior history; now test whether draft-target match creates real speculative speedup.'
  }

  if (/speculative/i.test(historyObject.title) && /long context/i.test(activeTitle)) {
    if (nextRepair) {
      return `Speculative speedup is preserved as prior history; now test which long-context constraint dominates before ${nextRepair}.`
    }
    return 'Speculative speedup is preserved as prior history; now test whether attention work, position phase, or KV memory dominates the longer prompt.'
  }

  if (/long context/i.test(historyObject.title) && /ssm|state.*sequence|mamba|hybrid/i.test(activeTitle)) {
    if (nextRepair) {
      return `Long-context KV memory is preserved as prior history; now compare fixed-state recurrence before ${nextRepair}.`
    }
    return 'Long-context KV memory is preserved as prior history; now compare fixed-state recurrence against a growing KV cache.'
  }

  if (/ssm|state.*sequence|mamba|hybrid/i.test(historyObject.title) && /swiglu|gated mlp/i.test(activeTitle)) {
    if (nextRepair) {
      return `Selective recurrent memory is preserved as prior history; now test token-local gated writes before ${nextRepair}.`
    }
    return 'Selective recurrent memory is preserved as prior history; now compare sequence memory with token-local gated MLP writes.'
  }

  if (/swiglu|gated mlp/i.test(historyObject.title) && /mixture of experts|expert routing|moe/i.test(activeTitle)) {
    if (nextRepair) {
      return `Dense token-local gating is preserved as prior history; now test sparse expert routing before ${nextRepair}.`
    }
    return 'Dense token-local gating is preserved as prior history; now compare one gated MLP write with sparse expert routing.'
  }

  if (/mixture of experts|expert routing|moe/i.test(historyObject.title) && /moe serving|expert parallelism|token dispatch/i.test(activeTitle)) {
    if (nextRepair) {
      return `Capacity overflow is preserved as prior history; now test token dispatch and expert scheduling before ${nextRepair}.`
    }
    return 'Capacity overflow is preserved as prior history; now compare sparse expert routing with token dispatch and expert scheduling.'
  }

  if (nextRepair) {
    const historyKind = historyObject.status === 'route handoff history' ? 'prior' : 'resolved'
    return `Use the ${historyKind} ${historyObject.type.replaceAll('-', ' ')} to compare what changed, then repair ${nextRepair}.`
  }

  const historyKind = historyObject.status === 'route handoff history' ? 'prior' : 'resolved'
  return `Use the ${historyKind} ${historyObject.type.replaceAll('-', ' ')} to compare what changed and what still needs repair in ${activeTitle}.`
}

function objectFlowItemFromSnapshot(
  snapshot: LearningRouteSnapshot | null,
  conceptId: string,
  objectFlowItems: DiscussionAnchorListItem[]
) {
  if (snapshot?.source !== 'concept-notebook' || snapshot.mappingId !== `concept:${conceptId}`) return null

  const snapshotAnchorId = snapshot.currentObject?.discussionAnchorId
  const snapshotObjectKey = snapshot.currentObject?.objectKey
  return (
    objectFlowItems.find((item) => snapshotAnchorId && item.anchor.id === snapshotAnchorId) ??
    objectFlowItems.find((item) => snapshotObjectKey && item.anchor.objectKey === snapshotObjectKey) ??
    null
  )
}

function objectFlowItemFromLocationHash(objectFlowItems: DiscussionAnchorListItem[]) {
  if (typeof window === 'undefined') return null
  const fragment = decodeURIComponent(window.location.hash.replace(/^#/, '')).trim()
  if (!fragment) return null

  return objectFlowItems.find((item) => objectFlowHrefFragment(item) === fragment) ?? null
}

function conceptRouteObject(
  concept: ConceptMetaPublic,
  domainTitle: string,
  conceptHref: string
): LearningRouteSourceObject {
  return {
    type: 'concept',
    id: concept.id,
    title: snapshotString(concept.title, 180),
    href: conceptHref,
    role: snapshotString(concept.short_description, 140, `${domainTitle} concept notebook`),
    status: 'current concept',
    sourceIds: concept.sources?.map((source) => source.id).filter(Boolean).slice(0, 6),
  }
}

function conceptNotebookSnapshot({
  concept,
  domainTitle,
  conceptHref,
  sectionOverview,
  prerequisites,
  leadsTo,
  related,
  nextLearning,
  selectedItem,
  selectedObject,
  discussionItems,
}: {
  concept: ConceptMetaPublic
  domainTitle: string
  conceptHref: string
  sectionOverview: SectionOverview[]
  prerequisites: ResolvedLink[]
  leadsTo: ResolvedLink[]
  related: ResolvedLink[]
  nextLearning: ResolvedLink | null
  selectedItem: DiscussionAnchorListItem
  selectedObject: LearningRouteSourceObject
  discussionItems: DiscussionAnchorListItem[]
}): LearningRouteSnapshot {
  const now = new Date().toISOString()
  const routeConceptCandidates = [
    ...prerequisites.slice(0, 3).map((item) => snapshotRouteConcept(item, 'prerequisite')),
    {
      label: snapshotString(concept.title, 100),
      href: conceptHref,
      role: 'current concept',
    },
    nextLearning ? snapshotRouteConcept(nextLearning, 'next repair') : null,
    ...leadsTo.slice(0, 3).map((item) => snapshotRouteConcept(item, 'next concept')),
    ...related.slice(0, 2).map((item) => snapshotRouteConcept(item, 'related concept')),
  ].filter((item): item is NonNullable<typeof item> => Boolean(item))
  const routeConcepts = mergeRouteConceptTrail([], routeConceptCandidates).slice(0, 12)
  const sourceObjects = [
    conceptRouteObject(concept, domainTitle, conceptHref),
    ...discussionItems.map(routeSourceObjectFromDiscussionItem),
  ].slice(0, 12)
  const currentObject = {
    ...selectedObject,
    role: snapshotString(selectedItem.thread.seedPrompt, 140),
    status: 'selected in concept room',
  }
  const currentObjectLabel = `${currentObject.type}: ${currentObject.title}`

  return {
    version: 'cf-route-snapshot-v1',
    source: 'concept-notebook',
    paperClueLabel: snapshotString(concept.title, 220),
    paperTitle: snapshotString(`Concept notebook: ${concept.title}`, 220),
    inputKind: 'concept notebook',
    mappingId: snapshotString(`concept:${concept.id}`, 80),
    mappingTitle: snapshotString(`${domainTitle} concept notebook`, 140),
    routeLabels: [
      ...prerequisites.slice(0, 3).map((item) => snapshotString(item.title ?? item.id, 100)),
      snapshotString(concept.title, 100),
      ...(nextLearning ? [snapshotString(nextLearning.title ?? nextLearning.id, 100)] : []),
    ].slice(0, 12),
    routeConceptIds: [
      ...prerequisites.map((item) => item.id),
      concept.id,
      ...leadsTo.map((item) => item.id),
      ...related.map((item) => item.id),
    ].map((id) => snapshotString(id, 80)).slice(0, 12),
    routeConcepts,
    nextRepair: nextLearning ? snapshotString(nextLearning.title ?? nextLearning.id, 120) : undefined,
    currentQuestion: snapshotString(selectedItem.thread.seedPrompt, 220),
    labGoal: snapshotString('Use the selected object to ask a grounded research question before moving on.', 220),
    sourceObjects,
    currentObject,
    routeProgress: {
      version: 'cf-route-progress-v1',
      stageReadiness: sectionOverview.map((section) => ({
        stageId: section.id,
        label: section.label,
        status: section.ready ? 'ready' : 'needs-repair',
        evidence: section.ready ? 'Section available in the concept notebook.' : 'Section still needs content or a demo.',
        updatedAt: now,
      })),
      resolvedObjectIds: currentObject.discussionAnchorId ? [currentObject.discussionAnchorId] : [],
      nextRepair: nextLearning ? snapshotString(nextLearning.title ?? nextLearning.id, 120) : undefined,
      updatedAt: now,
    },
    lastObservation: {
      label: 'Concept object focus',
      value: snapshotString(currentObjectLabel, 160),
      detail: snapshotString(`${concept.title} reading-room object selected for grounded AI handoff.`, 360),
      nextQuestion: snapshotString(selectedItem.thread.seedPrompt, 220),
      source: 'learning-route',
      updatedAt: now,
    },
    groundingStatus: concept.sources?.length ? 'metadata-resolved' : 'local-preview',
    createdAt: now,
  }
}

function ConceptSnapshot({
  conceptId,
  title,
  prerequisites,
  leadsTo,
  related,
  sections,
  image,
}: {
  conceptId: string
  title: string
  prerequisites: number
  leadsTo: number
  related: number
  sections: SectionOverview[]
  image?: ConceptImage | null
}) {
  const snapshotStyle = image
    ? ({ '--concept-cover': `url("${image.src}")` } as CSSProperties)
    : undefined
  const isEfficientAttention = conceptId === 'efficient-attention'
  const objectLabel = isEfficientAttention ? 'KV-cache memory equation' : `${title} core object`
  const objectPrompt = isEfficientAttention
    ? 'Before reading more, predict which symbol shrinks the cache when query heads share K/V heads.'
    : 'Start with one object, make a prediction, then carry the invariant into the next section.'
  const formulaLines = isEfficientAttention
    ? ['M_KV = B * L * T * 2 * H_kv * d * s', 'H_kv = H_q / g']
    : ['Question -> Object -> Prediction', 'Evidence -> Invariant -> Next Move']
  const lensCards = [
    { label: 'Learner', body: 'repair prerequisite' },
    { label: 'Researcher', body: 'check source boundary' },
    { label: 'Builder', body: 'run code witness' },
    { label: 'Instructor', body: 'name invariant' },
  ]
  const objectRooms = [
    { label: 'AI tutor', value: 'object-attached' },
    { label: 'Review room', value: 'evidence first' },
    { label: 'Memory', value: 'carry invariant' },
  ]

  return (
    <div className={`snapshot ${image ? 'has-image' : ''}`} style={snapshotStyle}>
      {image ? (
        <figure className="cover-image">
          <img src={image.src} alt={image.alt} />
        </figure>
      ) : null}

      <div className="snapshot-header">
        <p className="eyebrow">Living Notebook Lab</p>
        <h2>{objectLabel}</h2>
        <p>{objectPrompt}</p>
      </div>

      <div className="route-loop" aria-label="Learning loop">
        {['Question', 'Object', 'Predict', 'Evidence', 'Invariant', 'Next'].map((step, index) => (
          <span key={step} className={index === 2 ? 'active' : undefined}>
            <b>{String(index + 1).padStart(2, '0')}</b>
            {step}
          </span>
        ))}
      </div>

      <div className="live-workspace">
        <section className="object-stage" aria-label="Current learning object">
          <span>Selected object</span>
          <strong>{objectLabel}</strong>
          <div className="formula-board">
            {formulaLines.map((line) => (
              <code key={line}>{line}</code>
            ))}
          </div>
          <div className="measurement-row">
            <span>
              <b>{isEfficientAttention ? 'g = 4' : 'object'}</b>
              active variable
            </span>
            <span>
              <b>{isEfficientAttention ? '4.0x' : 'ready'}</b>
              measured change
            </span>
            <span>
              <b>{isEfficientAttention ? 'H_kv' : 'invariant'}</b>
              carry forward
            </span>
          </div>
        </section>

        <aside className="signal-rail" aria-label="AI, review, and memory lanes">
          {objectRooms.map((room) => (
            <article key={room.label}>
              <span>{room.label}</span>
              <strong>{room.value}</strong>
            </article>
          ))}
        </aside>
      </div>

      <div className="lens-grid" aria-label="Role lenses">
        {lensCards.map((lens) => (
          <article key={lens.label}>
            <span>{lens.label}</span>
            <strong>{lens.body}</strong>
          </article>
        ))}
      </div>

      <div className="section-dock" aria-label="Concept section route">
        {sections.map((section) => (
          <div key={section.id} className={`step-card ${section.ready ? 'ready' : 'pending'}`}>
            <span className="step-label">{section.step}</span>
            <strong>{section.label}</strong>
            <p>{section.ready ? 'Ready' : 'Needs repair'}</p>
          </div>
        ))}
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <span className="stat-value">{prerequisites}</span>
          <span className="stat-label">prerequisites</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{leadsTo}</span>
          <span className="stat-label">next concepts</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{related}</span>
          <span className="stat-label">related links</span>
        </div>
      </div>

      <style jsx>{`
        .snapshot {
          position: relative;
          isolation: isolate;
          height: 100%;
          min-width: 0;
          padding: 1rem;
          display: grid;
          align-content: start;
          gap: 0.72rem;
          overflow: hidden;
          background:
            linear-gradient(rgba(31, 111, 120, 0.065) 1px, transparent 1px),
            linear-gradient(90deg, rgba(31, 111, 120, 0.065) 1px, transparent 1px),
            radial-gradient(circle at top right, rgba(127, 202, 196, 0.2), transparent 28%),
            radial-gradient(circle at bottom left, rgba(215, 167, 65, 0.14), transparent 32%),
            linear-gradient(180deg, rgba(255, 251, 245, 0.95), rgba(242, 235, 222, 0.95));
          background-size: 26px 26px, 26px 26px, auto, auto, auto;
        }

        .snapshot.has-image::before {
          content: '';
          position: absolute;
          z-index: -2;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(255, 251, 245, 0.36), rgba(255, 251, 245, 0.98) 56%, rgba(242, 235, 222, 0.98)),
            var(--concept-cover);
          background-size: cover;
          background-position: center;
          filter: saturate(0.95) contrast(0.95);
          transform: scale(1.06);
        }

        .snapshot.has-image::after {
          content: '';
          position: absolute;
          z-index: -1;
          inset: 0;
          background:
            linear-gradient(rgba(31, 75, 153, 0.052) 1px, transparent 1px),
            linear-gradient(90deg, rgba(31, 75, 153, 0.052) 1px, transparent 1px);
          background-size: 30px 30px;
          mask-image: linear-gradient(180deg, transparent, black 28%, black 100%);
          pointer-events: none;
        }

        .cover-image {
          position: relative;
          margin: 0;
          aspect-ratio: 5 / 2;
          max-height: 150px;
          overflow: hidden;
          border-radius: 16px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.86);
          box-shadow:
            0 18px 46px rgba(12, 22, 34, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.5);
        }

        .cover-image img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .snapshot-header h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.35rem, 2.4vw, 2rem);
          line-height: 1.02;
          letter-spacing: 0;
          color: #18212b;
          overflow-wrap: anywhere;
        }

        .eyebrow {
          margin: 0 0 0.4rem;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #1f6f78;
        }

        .snapshot-header p {
          margin: 0.45rem 0 0;
          max-width: 48rem;
          color: #4f5d69;
          line-height: 1.45;
          font-size: 0.92rem;
        }

        .route-loop {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 0.4rem;
        }

        .route-loop span {
          display: grid;
          gap: 0.22rem;
          min-height: 52px;
          padding: 0.48rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.09);
          color: #30404f;
          background: rgba(255, 251, 245, 0.72);
          font-size: 0.73rem;
          font-weight: 800;
        }

        .route-loop b,
        .step-label,
        .object-stage span,
        .signal-rail span,
        .lens-grid span {
          font-family: var(--font-mono);
          font-size: 0.64rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .route-loop span.active {
          border-color: rgba(215, 167, 65, 0.58);
          background: rgba(215, 167, 65, 0.18);
          color: #18212b;
        }

        .live-workspace {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(120px, 0.36fr);
          gap: 0.65rem;
          min-width: 0;
        }

        .object-stage,
        .signal-rail article,
        .lens-grid article,
        .step-card,
        .stat-card {
          border-radius: 10px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.84);
          box-shadow: 0 12px 26px rgba(12, 22, 34, 0.07);
        }

        .object-stage {
          display: grid;
          gap: 0.6rem;
          min-width: 0;
          padding: 0.82rem;
          color: #fff8eb;
          background:
            linear-gradient(rgba(125, 211, 252, 0.075) 1px, transparent 1px),
            linear-gradient(90deg, rgba(125, 211, 252, 0.075) 1px, transparent 1px),
            linear-gradient(135deg, rgba(20, 33, 47, 0.96), rgba(17, 43, 52, 0.96));
          background-size: 24px 24px, 24px 24px, auto;
        }

        .object-stage span {
          color: #7fcac4;
        }

        .object-stage strong {
          color: #fff8eb;
          font-family: var(--font-display);
          font-size: clamp(1.2rem, 2.4vw, 1.75rem);
          line-height: 1.02;
        }

        .formula-board {
          display: grid;
          gap: 0.35rem;
          border-radius: 9px;
          padding: 0.55rem;
          background: rgba(255, 248, 235, 0.1);
        }

        .formula-board code {
          display: block;
          color: #fff8eb;
          overflow-wrap: anywhere;
          font-size: 0.9rem;
        }

        .measurement-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.4rem;
        }

        .measurement-row span {
          border-radius: 8px;
          padding: 0.48rem;
          color: rgba(255, 248, 235, 0.74);
          background: rgba(255, 248, 235, 0.08);
          font-size: 0.72rem;
          line-height: 1.25;
        }

        .measurement-row b {
          display: block;
          color: #7fcac4;
          font-size: 1rem;
        }

        .signal-rail {
          display: grid;
          gap: 0.45rem;
          min-width: 0;
        }

        .signal-rail article {
          display: grid;
          gap: 0.24rem;
          min-height: 64px;
          padding: 0.58rem;
        }

        .signal-rail span,
        .lens-grid span {
          color: #1f6f78;
        }

        .signal-rail strong,
        .lens-grid strong {
          color: #18212b;
          font-size: 0.84rem;
          line-height: 1.18;
        }

        .lens-grid,
        .section-dock {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.5rem;
        }

        .lens-grid article {
          display: grid;
          gap: 0.28rem;
          min-height: 78px;
          padding: 0.62rem;
        }

        .step-card {
          padding: 0.68rem;
        }

        .step-card.pending {
          opacity: 0.7;
        }

        .step-label {
          display: block;
          margin-bottom: 0.3rem;
          color: #5a6874;
        }

        strong {
          display: block;
          color: #18212b;
          font-size: 1rem;
          overflow-wrap: anywhere;
        }

        p {
          margin: 0.28rem 0 0;
          color: #4f5d69;
          line-height: 1.3;
          font-size: 0.78rem;
          overflow-wrap: anywhere;
        }

        .stat-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.5rem;
        }

        .stat-card {
          padding: 0.62rem;
          text-align: center;
        }

        .stat-value {
          display: block;
          font-family: var(--font-display);
          font-size: 1.35rem;
          line-height: 1;
          color: #17202a;
        }

        .stat-label {
          display: block;
          margin-top: 0.35rem;
          font-family: var(--font-mono);
          font-size: 0.66rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #5a6773;
        }

        @media (max-width: 720px) {
          .snapshot {
            padding: 0.82rem;
          }

          .cover-image {
            max-height: 112px;
          }

          .route-loop,
          .live-workspace,
          .measurement-row,
          .lens-grid,
          .section-dock,
          .stat-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

function ConceptSourcePanel({ sources }: { sources?: ConceptSource[] }) {
  const safeSources = (sources ?? []).filter((source) => source.id && source.title).slice(0, 6)
  if (!safeSources.length) return null

  return (
    <section id="source-grounding" className="source-grounding-panel" aria-labelledby="source-grounding-title">
      <div className="source-grounding-heading">
        <p>Source Grounding</p>
        <h2 id="source-grounding-title">Canonical references for the mechanism on this page.</h2>
      </div>

      <div className="source-grounding-list">
        {safeSources.map((source, index) => (
          <article key={source.id} id={sourceDomIdForConceptSource(source, index)}>
            <span>
              {source.kind ?? 'reference'}
              {source.year ? ` · ${source.year}` : ''}
            </span>
            <strong>{source.title}</strong>
            {source.authors ? <em>{source.authors}</em> : null}
            {source.note ? <p id={sourceSpanDomIdForConceptSource(source, index)}>{source.note}</p> : null}
            {source.url ? (
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                Open source
              </a>
            ) : null}
          </article>
        ))}
      </div>

      <style jsx>{`
        .source-grounding-panel {
          display: grid;
          gap: 0.85rem;
          min-width: 0;
          padding: 1.05rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(180deg, rgba(247, 252, 250, 0.86), rgba(255, 251, 245, 0.86)),
            rgba(255, 251, 245, 0.9);
        }

        .source-grounding-heading {
          display: grid;
          gap: 0.35rem;
          max-width: 54rem;
        }

        .source-grounding-heading p,
        .source-grounding-list span {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #1f6f78;
        }

        .source-grounding-heading h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.25rem, 2vw, 1.65rem);
          line-height: 1.08;
          color: #17202a;
          letter-spacing: 0;
          overflow-wrap: anywhere;
        }

        .source-grounding-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.75rem;
          min-width: 0;
        }

        .source-grounding-list article {
          display: grid;
          gap: 0.38rem;
          min-width: 0;
          padding: 0.85rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.88);
        }

        .source-grounding-list strong {
          color: #17202a;
          line-height: 1.32;
          overflow-wrap: anywhere;
        }

        .source-grounding-list em,
        .source-grounding-list p {
          margin: 0;
          color: #52606b;
          font-style: normal;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .source-grounding-list a {
          width: fit-content;
          color: #1f6f78;
          font-weight: 700;
          text-decoration: none;
        }

        .source-grounding-list a:hover {
          text-decoration: underline;
        }

        .source-grounding-list p:target {
          outline: 2px solid rgba(31, 111, 120, 0.28);
          outline-offset: 3px;
          background: rgba(247, 252, 250, 0.88);
        }
      `}</style>
    </section>
  )
}

function isSafeClaimCheckLocalFragmentRef(objectRef: string) {
  return (
    objectRef.startsWith('#') &&
    objectRef.length > 1 &&
    objectRef.length <= 120 &&
    !/[\u0000-\u001F\u007F\\\s]/.test(objectRef)
  )
}

function claimCheckObjectRefLabel(objectRef: string) {
  return objectRef.replace(/^#/, '')
}

type ClaimReviewWitnessTarget = {
  href: string
  label: string
  detail: string
  kind: ConceptObjectSpan['kind'] | 'demo'
  latex?: string
}

function renderEquationSnippetHtml(latex: string) {
  try {
    return sanitizeRenderedHtml(
      katex.renderToString(latex.trim(), {
        displayMode: true,
        throwOnError: false,
        strict: 'ignore',
        trust: false,
      })
    )
  } catch {
    return null
  }
}

function ClaimReviewWitnessDetail({ target }: { target: ClaimReviewWitnessTarget }) {
  if (target.kind === 'equation') {
    const html = renderEquationSnippetHtml(target.latex ?? target.detail)
    if (html) {
      return (
        <div
          className="claim-review-equation-snippet"
          aria-label={`Rendered equation witness: ${target.label}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )
    }
  }

  return <strong>{target.detail}</strong>
}

export function ConceptClaimReviewPanel({
  concept,
  sources,
  claimChecks,
  objectSpans,
  hasVisualization,
}: {
  concept: ConceptMetaPublic
  sources?: ConceptSource[]
  claimChecks?: ConceptClaimCheck[]
  objectSpans: ConceptObjectSpan[]
  hasVisualization: boolean
}) {
  const safeSources = (sources ?? []).filter((source) => source.id && source.title).slice(0, 6)
  const structuredClaimChecks = (claimChecks ?? []).filter((check) => check.id && check.claim)
  const sourceById = new Map(safeSources.map((source) => [source.id, source] as const))
  const sourceNoteTargets = safeSources
    .map((source, index) => ({ source, index }))
    .filter(({ source }) => source.note?.trim())
    .slice(0, 4)
  const witnessTargets: ClaimReviewWitnessTarget[] = [
    ...objectSpans.slice(0, 3).map((span) => ({
      href: `#${span.domId}`,
      label: conceptObjectSpanLabel(span),
      detail: span.snippet,
      kind: span.kind,
      latex: span.latex,
    })),
    ...(hasVisualization
      ? [
          {
            href: '#interactive-demo',
            label: 'Demo state',
            detail: 'Live mechanism probe',
            kind: 'demo' as const,
          },
        ]
      : []),
  ].slice(0, 4)
  const sourceIds = safeSources.map((source) => source.id).filter(Boolean).slice(0, 6)
  const substantiveReviewCount = structuredClaimChecks.filter((check) =>
    isSubstantiveEvidenceReview(check.evidence_review)
  ).length
  const statusLabel = substantiveReviewCount
    ? `${substantiveReviewCount} substantive review${substantiveReviewCount === 1 ? '' : 's'} recorded`
    : 'Substantive claim review pending'
  const statusDetail = substantiveReviewCount
    ? 'Claims without a substantive review badge still need exact source-support review.'
    : 'Source IDs and witness objects are attached for review; they are not proof by themselves.'

  return (
    <section id="claim-review" className="claim-review-panel" aria-labelledby="claim-review-title">
      <div className="claim-review-heading">
        <p>Claim Review</p>
        <h2 id="claim-review-title">{concept.short_description || concept.title}</h2>
      </div>

      <div className="claim-review-summary">
        <article>
          <span>Status</span>
          <strong>{statusLabel}</strong>
          <p>{statusDetail}</p>
        </article>
        <article>
          <span>Sources</span>
          <strong>{sourceIds.length ? `${sourceIds.length} reference${sourceIds.length === 1 ? '' : 's'}` : 'No references'}</strong>
          <p>{sourceIds.length ? sourceIds.join(', ') : 'Add source metadata before claiming support.'}</p>
        </article>
        <article>
          <span>Witnesses</span>
          <strong>{witnessTargets.length ? `${witnessTargets.length} local object${witnessTargets.length === 1 ? '' : 's'}` : 'No local witness'}</strong>
          <p>Use equation, code, and demo objects to check whether the source support is operational.</p>
        </article>
      </div>

      {structuredClaimChecks.length ? (
        <div className="claim-checks" aria-label="Structured claim checks">
          {structuredClaimChecks.map((check, index) => {
            const review = normalizeClaimEvidenceReview(check.evidence_review)
            const checkSources = (check.source_ids ?? [])
              .map((sourceId) => sourceById.get(sourceId)?.title ?? sourceId)
              .filter(Boolean)
            const objectRefs = (check.object_refs ?? []).map((objectRef) => objectRef.trim()).filter(Boolean)

            return (
              <article
                key={check.id}
                id={claimCheckDomIdForConceptClaimCheck(check, index) ?? undefined}
                className={`claim-check ${check.status}`}
              >
                <span className="claim-check-review-state">{claimEvidenceReviewLabel(review)}</span>
                <strong>{check.claim}</strong>
                <em className="claim-check-status">Claim metadata: {check.status.replaceAll('-', ' ')}</em>
                {check.support ? <p>{check.support}</p> : null}
                {checkSources.length ? <em>Sources: {checkSources.join(', ')}</em> : null}
                {check.caveat ? <small>{check.caveat}</small> : null}
                <small>{claimEvidenceReviewWarning(review)}</small>
                {review.state === 'substantive-reviewed' && (review.summary || review.reviewed_at || review.reviewer) ? (
                  <div className="claim-check-review-summary" aria-label="Substantive review metadata">
                    {review.summary ? <p>{review.summary}</p> : null}
                    {review.reviewed_at || review.reviewer ? (
                      <small>
                        {review.reviewer ? `Reviewer: ${review.reviewer}` : 'Reviewer not recorded'}
                        {review.reviewed_at ? `; reviewed ${review.reviewed_at}` : ''}
                      </small>
                    ) : null}
                  </div>
                ) : null}
                {objectRefs.length ? (
                  <div className="claim-check-links">
                    {objectRefs.map((objectRef) =>
                      isSafeClaimCheckLocalFragmentRef(objectRef) ? (
                        <a key={objectRef} href={objectRef}>
                          {claimCheckObjectRefLabel(objectRef)}
                        </a>
                      ) : (
                        <code key={objectRef}>{claimCheckObjectRefLabel(objectRef)}</code>
                      )
                    )}
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      ) : null}

      <div className="claim-review-lists">
        <div className="claim-review-list">
          <h3>Source support candidates</h3>
          {sourceNoteTargets.length ? (
            sourceNoteTargets.map(({ source, index }) => (
              <a key={source.id} href={`#${sourceSpanDomIdForConceptSource(source, index)}`}>
                <span>
                  {source.kind ?? 'reference'}
                  {source.year ? ` ${source.year}` : ''}
                </span>
                <strong>{source.title}</strong>
                <p>{source.note}</p>
              </a>
            ))
          ) : (
            <p className="empty-note">No structured source note is attached yet.</p>
          )}
        </div>

        <div className="claim-review-list">
          <h3>Mechanism witnesses</h3>
          {witnessTargets.length ? (
            witnessTargets.map((target) => (
              <a key={`${target.href}-${target.label}`} href={target.href}>
                <span>{target.label}</span>
                <ClaimReviewWitnessDetail target={target} />
              </a>
            ))
          ) : (
            <p className="empty-note">No extracted equation, code, or demo witness is available yet.</p>
          )}
        </div>
      </div>

      <style jsx>{`
        .claim-review-panel {
          display: grid;
          gap: 0.85rem;
          min-width: 0;
          padding: 1.05rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(180deg, rgba(255, 251, 245, 0.92), rgba(247, 252, 250, 0.9)),
            rgba(255, 251, 245, 0.92);
        }

        .claim-review-heading {
          display: grid;
          gap: 0.35rem;
          max-width: 58rem;
        }

        .claim-review-heading p,
        .claim-review-summary span,
        .claim-review-list span,
        .claim-check span {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #1f6f78;
        }

        .claim-review-heading h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.25rem, 2vw, 1.65rem);
          line-height: 1.1;
          color: #17202a;
          letter-spacing: 0;
          overflow-wrap: anywhere;
        }

        .claim-review-summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.7rem;
        }

        .claim-review-summary article,
        .claim-review-list a {
          display: grid;
          gap: 0.35rem;
          min-width: 0;
          padding: 0.78rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.88);
          color: inherit;
          text-decoration: none;
        }

        .claim-review-summary strong,
        .claim-review-list strong,
        .claim-check strong {
          color: #17202a;
          line-height: 1.32;
          overflow-wrap: anywhere;
        }

        .claim-review-summary p,
        .claim-review-list p,
        .claim-check p,
        .empty-note {
          margin: 0;
          color: #52606b;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .claim-checks {
          display: grid;
          gap: 0.65rem;
          min-width: 0;
        }

        .claim-check {
          display: grid;
          gap: 0.38rem;
          min-width: 0;
          padding: 0.85rem;
          border-radius: 8px;
          border: 1px solid rgba(31, 111, 120, 0.16);
          background: rgba(247, 252, 250, 0.92);
        }

        .claim-check.needs-review {
          border-color: rgba(194, 74, 45, 0.18);
          background: rgba(255, 251, 245, 0.92);
        }

        .claim-check.weakened {
          border-color: rgba(139, 94, 52, 0.2);
          background: rgba(253, 247, 238, 0.92);
        }

        .claim-check em,
        .claim-check small {
          color: #52606b;
          font-style: normal;
          line-height: 1.48;
          overflow-wrap: anywhere;
        }

        .claim-check-links {
          display: flex;
          flex-wrap: wrap;
          gap: 0.42rem;
        }

        .claim-check-review-summary {
          display: grid;
          gap: 0.24rem;
          padding: 0.58rem;
          border-radius: 8px;
          border: 1px solid rgba(31, 111, 120, 0.14);
          background: rgba(255, 255, 255, 0.52);
        }

        .claim-check-links a,
        .claim-check-links code {
          padding: 0.22rem 0.42rem;
          border-radius: 6px;
          background: rgba(31, 111, 120, 0.1);
          color: #1f6f78;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          text-decoration: none;
          overflow-wrap: anywhere;
        }

        .claim-check-links code {
          color: #52606b;
          background: rgba(27, 36, 48, 0.06);
        }

        .claim-check-links a:hover {
          background: rgba(31, 111, 120, 0.16);
        }

        .claim-review-lists {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
          min-width: 0;
        }

        .claim-review-list {
          display: grid;
          align-content: start;
          gap: 0.55rem;
          min-width: 0;
        }

        .claim-review-list h3 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 1.05rem;
          letter-spacing: 0;
          color: #17202a;
        }

        .claim-review-list a:hover {
          border-color: rgba(31, 111, 120, 0.24);
          background: rgba(247, 252, 250, 0.95);
        }

        .claim-review-equation-snippet {
          display: block;
          max-width: 100%;
          overflow-x: auto;
          color: #17202a;
          -webkit-overflow-scrolling: touch;
        }

        .claim-review-equation-snippet :global(.katex-display) {
          margin: 0;
          text-align: left;
        }

        .claim-review-equation-snippet :global(.katex) {
          font-size: 0.95rem;
          line-height: 1.35;
        }

        @media (max-width: 820px) {
          .claim-review-summary,
          .claim-review-lists {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}

export default function ConceptNotebookPage({
  domainTitle,
  concept,
  sections,
  sectionPrompts,
  objectSpans = [],
  prerequisites,
  leadsTo,
  related,
  prevInDomain,
  nextInDomain,
  conceptImage,
  Viz,
}: Props) {
  const sectionOverview: SectionOverview[] = [
    {
      id: 'intuition',
      label: 'Intuition',
      step: '01',
      summary: 'Start with the picture, metaphor, or geometric mechanism.',
      ready: Boolean(sections.intuitionHtml.trim()),
    },
    {
      id: 'math',
      label: 'Math',
      step: '02',
      summary: 'Make the objects explicit and connect them with notation.',
      ready: Boolean(sections.mathHtml.trim()),
    },
    {
      id: 'code',
      label: 'Code',
      step: '03',
      summary: 'Mirror the equations with runnable implementation details.',
      ready: Boolean(sections.codeHtml.trim()),
    },
    {
      id: 'interactive-demo',
      label: 'Interactive Demo',
      step: '04',
      summary: 'Manipulate the mechanism and watch the idea respond.',
      ready: Boolean(Viz),
    },
  ]

  const meta = [
    `status: ${concept.status}`,
    `importance: ${concept.importance}`,
    `difficulty ${concept.difficulty}/5`,
    `math: ${concept.math_level || '—'}`,
    `read: ${concept.estimated_read_time || 0}m`,
    Viz ? 'live demo' : 'demo planned',
  ]

  const domainHref = `/domains/${concept.domain}/`
  const conceptHref = `/domains/${concept.domain}/${concept.slug}/`
  const nextLearning = leadsTo.find((item) => item.href) ?? (
    nextInDomain ? { id: conceptIdFromHref(nextInDomain.href), title: nextInDomain.title, href: nextInDomain.href } : null
  )
  const demoPrompt = Viz
    ? 'Manipulate one control and predict the visible change.'
    : 'Use the demo notes to predict the mechanism before moving on.'
  const beforeLabel = prerequisites[0]?.title ?? prerequisites[0]?.id ?? 'No hard prerequisite'
  const nextLabel = nextLearning?.title ?? nextLearning?.id ?? 'Choose a related idea'
  const prerequisiteLabels = prerequisites.map((item) => item.title ?? item.id)
  const nextConceptLabel = nextLearning?.title ?? nextLearning?.id
  const sectionReadyProgress = `${sectionOverview.filter((section) => section.ready).length}/${sectionOverview.length} sections ready`
  const mobileRouteState = [
    { label: 'Before', value: beforeLabel },
    { label: 'Now', value: sectionReadyProgress },
    { label: 'Try', value: demoPrompt },
    { label: 'Next', value: nextLabel },
  ]
  const continuityNodes = [
    {
      label: 'Carry in',
      title: beforeLabel,
      body: prerequisites.length
        ? `Bring the mental model from ${beforeLabel}; this page will reuse it instead of restarting from zero.`
        : 'This page can stand on its own, so the first job is to build the mental picture carefully.',
    },
    {
      label: 'Work here',
      title: concept.title,
      body: concept.short_description || 'Hold one invariant idea while moving through intuition, notation, code, and the demo.',
    },
    {
      label: 'Carry out',
      title: nextLabel,
      body: nextLearning
        ? `The next edge should feel earned: use the demo prediction here before following ${nextLabel}.`
        : 'Use the related links only after the central mechanism on this page feels stable.',
    },
  ]
  const discussionItems = useMemo(
    () => buildConceptDiscussionItems({ ...concept, objectSpans }, domainTitle, Boolean(Viz)),
    [concept, objectSpans, domainTitle, Viz]
  )
  const mathObjectSpans = objectSpans.filter((span) => span.kind === 'equation')
  const codeObjectSpans = objectSpans.filter((span) => span.kind === 'code-witness')
  const objectFlowItems = useMemo(() => objectFlowItemsForConcept(concept.id, discussionItems), [concept.id, discussionItems])
  const defaultObjectFlowItem = useMemo(
    () => defaultObjectFlowItemForConcept(concept.id, objectFlowItems),
    [concept.id, objectFlowItems]
  )
  const witnessTriads = useMemo(
    () =>
      buildWitnessTriadsForConcept({
        conceptId: concept.id,
        objectSpans,
        discussionItems,
        codeHtml: sections.codeHtml,
        hasVisualization: Boolean(Viz),
      }),
    [concept.id, discussionItems, objectSpans, sections.codeHtml, Viz]
  )
  const [selectedObjectAnchorId, setSelectedObjectAnchorId] = useState<string>(defaultObjectFlowItem?.anchor.id ?? '')
  const [objectFlowProgress, setObjectFlowProgress] = useState<string | null>(null)
  const [savedObjectAnchorId, setSavedObjectAnchorId] = useState<string>('')
  const [routeSnapshot, setRouteSnapshot] = useState<LearningRouteSnapshot | null>(null)
  const [selectedObjectActionDraft, setSelectedObjectActionDraft] = useState<LocalObjectActionDraft | null>(null)
  const [selectedObjectActionResolution, setSelectedObjectActionResolution] = useState<LocalObjectActionResolution | null>(null)
  const [activeStudioModeRole, setActiveStudioModeRole] = useState('Learner')
  const lastRememberedObjectAnchorIdRef = useRef<string>('')

  useEffect(() => {
    if (!objectFlowItems.length) {
      setSelectedObjectAnchorId('')
      setObjectFlowProgress(null)
      setSavedObjectAnchorId('')
      setRouteSnapshot(getSavedLearningRouteSnapshot())
      lastRememberedObjectAnchorIdRef.current = ''
      return
    }

    const syncFromSnapshot = () => {
      const snapshot = getSavedLearningRouteSnapshot()
      setRouteSnapshot(snapshot)
      const snapshotItem = objectFlowItemFromSnapshot(snapshot, concept.id, discussionItems)
      const hashItem = objectFlowItemFromLocationHash(discussionItems)
      const nextItem = snapshotItem ?? hashItem
      const snapshotBelongsHere = Boolean(snapshotItem)
      const nextAnchorId = nextItem?.anchor.id
      const hasNextAnchor = Boolean(nextAnchorId)

      setSelectedObjectAnchorId((previous) => {
        if (hasNextAnchor) return nextAnchorId as string
        if (previous && discussionItems.some((item) => item.anchor.id === previous)) return previous
        return defaultObjectFlowItem?.anchor.id ?? objectFlowItems[0].anchor.id
      })
      setObjectFlowProgress(snapshotBelongsHere ? objectFlowProgressSummary(snapshot) : null)
      setSavedObjectAnchorId(snapshotItem ? snapshotItem.anchor.id : '')

      if (snapshotItem) {
        lastRememberedObjectAnchorIdRef.current = snapshotItem.anchor.id
      }
    }

    syncFromSnapshot()

    window.addEventListener('storage', syncFromSnapshot)
    window.addEventListener('hashchange', syncFromSnapshot)
    window.addEventListener(learningRouteSnapshotEventName, syncFromSnapshot)
    return () => {
      window.removeEventListener('storage', syncFromSnapshot)
      window.removeEventListener('hashchange', syncFromSnapshot)
      window.removeEventListener(learningRouteSnapshotEventName, syncFromSnapshot)
    }
  }, [concept.id, discussionItems, objectFlowItems, defaultObjectFlowItem])

  const rememberConceptFocus = (selectedItem: DiscussionAnchorListItem, selectedObject: LearningRouteSourceObject) => {
    const previousSnapshot = getSavedLearningRouteSnapshot()
    if (isInspectingSavedRouteHistory(previousSnapshot, concept.id, conceptHref)) return false

    const snapshot = conceptNotebookSnapshot({
      concept,
      domainTitle,
      conceptHref,
      sectionOverview,
      prerequisites,
      leadsTo,
      related,
      nextLearning,
      selectedItem,
      selectedObject,
      discussionItems,
    })

    const activatedSnapshot = preserveActivatedRouteTrail(snapshot, previousSnapshot, conceptHref)

    return saveLearningRouteSnapshot(
      preserveResolvedRouteHistory(activatedSnapshot, previousSnapshot, concept.id, conceptHref)
    )
  }

  const rememberObjectFlowSelection = (selectedItem: DiscussionAnchorListItem) => {
    setSelectedObjectAnchorId(selectedItem.anchor.id)
    if (lastRememberedObjectAnchorIdRef.current === selectedItem.anchor.id) return

    const selectedObject = routeSourceObjectFromDiscussionItem(selectedItem)
    if (rememberConceptFocus(selectedItem, selectedObject)) {
      lastRememberedObjectAnchorIdRef.current = selectedItem.anchor.id
      setSavedObjectAnchorId(selectedItem.anchor.id)
    }
  }

  const rememberDemoPrediction = (reveal: DemoPredictionCheckpointReveal) => {
    const demoItem = discussionItems.find((item) => item.anchor.objectType === 'visualization')
    if (!demoItem) return

    const previousSnapshot = getSavedLearningRouteSnapshot()
    const currentFocusItem = objectFlowItems.find((item) => item.anchor.id === selectedObjectAnchorId)
    const selectedItem =
      currentFocusItem &&
      currentFocusItem.anchor.objectType !== 'concept' &&
      isExactObjectFlowItem(currentFocusItem)
        ? currentFocusItem
        : demoItem

    const selectedObject = routeSourceObjectFromDiscussionItem(selectedItem)
    const demoObject = routeSourceObjectFromDiscussionItem(demoItem)
    const now = new Date().toISOString()
    if (isInspectingSavedRouteHistory(previousSnapshot, concept.id, conceptHref)) return

    const snapshot = conceptNotebookSnapshot({
      concept,
      domainTitle,
      conceptHref,
      sectionOverview,
      prerequisites,
      leadsTo,
      related,
      nextLearning,
      selectedItem,
      selectedObject,
      discussionItems,
    })
    const demoStatePrompt = compactDemoStateForObservation(reveal.demoState)
    const observationDetail = demoStatePrompt ? `${demoStatePrompt}\n\nPrediction check: ${reveal.check}` : reveal.check
    const observationValue = reveal.demoState
      ? `${reveal.label}: ${reveal.demoState.summary}`
      : `Prediction lens: ${reveal.label}`
    const nextSnapshot: LearningRouteSnapshot = {
      ...snapshot,
      currentQuestion: snapshotString(selectedItem.thread.seedPrompt, 220),
      currentObject: {
        ...selectedObject,
        role: snapshotString(observationValue, 140),
        status: 'prediction checkpoint revealed',
        sourceDetail: reveal.demoState ? snapshotString(reveal.demoState.label, 160) : selectedObject.sourceDetail,
      },
      routeProgress: {
        ...snapshot.routeProgress!,
        checkpoints: [
          {
            id: 'demo-prediction',
            label: 'Demo prediction',
            status: 'observed',
            detail: snapshotString(observationValue, 180),
            updatedAt: now,
          },
        ],
        resolvedObjectIds: (() => {
          const ids: string[] = []
          if (selectedObject.discussionAnchorId) ids.push(selectedObject.discussionAnchorId)
          if (demoObject.discussionAnchorId && !ids.includes(demoObject.discussionAnchorId)) ids.push(demoObject.discussionAnchorId)
          return ids
        })(),
        updatedAt: now,
      },
      lastObservation: {
        label: 'Demo prediction',
        value: snapshotString(observationValue, 160),
        detail: snapshotString(observationDetail, 360),
        nextQuestion: snapshotString(demoItem.thread.seedPrompt, 220),
        source: 'prediction-checkpoint',
        updatedAt: now,
      },
    }
    const activatedSnapshot = preserveActivatedRouteTrail(nextSnapshot, previousSnapshot, conceptHref)

    if (
      saveLearningRouteSnapshot(
        preserveResolvedRouteHistory(activatedSnapshot, previousSnapshot, concept.id, conceptHref)
      )
    ) {
      setSelectedObjectAnchorId(selectedItem.anchor.id)
      setSavedObjectAnchorId(selectedItem.anchor.id)
      lastRememberedObjectAnchorIdRef.current = selectedItem.anchor.id
    }
  }

  const rememberVisualInquiry = (reveal: ConceptVisualInquiryReveal) => {
    const selectedItem = discussionItems.find((item) => item.anchor.objectType === 'concept') ?? discussionItems[0]
    if (!selectedItem) return

    const previousSnapshot = getSavedLearningRouteSnapshot()
    if (isInspectingSavedRouteHistory(previousSnapshot, concept.id, conceptHref)) return

    const selectedObject = routeSourceObjectFromDiscussionItem(selectedItem)
    const now = new Date().toISOString()
    const snapshot = conceptNotebookSnapshot({
      concept,
      domainTitle,
      conceptHref,
      sectionOverview,
      prerequisites,
      leadsTo,
      related,
      nextLearning,
      selectedItem,
      selectedObject,
      discussionItems,
    })
    const observationValue = `Visual inquiry: ${reveal.lensLabel} / ${reveal.predictionLabel}`
    const observationDetail = `${reveal.check} Inspection depth ${reveal.depth}/4.`
    const nextSnapshot: LearningRouteSnapshot = {
      ...snapshot,
      currentQuestion: snapshotString(selectedItem.thread.seedPrompt, 220),
      currentObject: {
        ...selectedObject,
        role: snapshotString(observationValue, 140),
        status: 'visual inquiry revealed',
        sourceDetail: 'Concept visual inquiry',
      },
      routeProgress: {
        ...snapshot.routeProgress!,
        checkpoints: [
          {
            id: 'visual-inquiry',
            label: 'Visual inquiry',
            status: 'observed',
            detail: snapshotString(observationValue, 180),
            updatedAt: now,
          },
        ],
        resolvedObjectIds: selectedObject.discussionAnchorId ? [selectedObject.discussionAnchorId] : [],
        updatedAt: now,
      },
      lastObservation: {
        label: 'Visual inquiry',
        value: snapshotString(observationValue, 160),
        detail: snapshotString(observationDetail, 360),
        nextQuestion: snapshotString(selectedItem.thread.seedPrompt, 220),
        source: 'learning-route',
        updatedAt: now,
      },
    }
    const activatedSnapshot = preserveActivatedRouteTrail(nextSnapshot, previousSnapshot, conceptHref)

    if (
      saveLearningRouteSnapshot(
        preserveResolvedRouteHistory(activatedSnapshot, previousSnapshot, concept.id, conceptHref)
      )
    ) {
      setSelectedObjectAnchorId(selectedItem.anchor.id)
      setSavedObjectAnchorId(selectedItem.anchor.id)
      lastRememberedObjectAnchorIdRef.current = selectedItem.anchor.id
    }
  }

  const selectedObjectFlowItem =
    discussionItems.find((item) => item.anchor.id === selectedObjectAnchorId) ?? objectFlowItems[0]
  const selectedObjectFragment = objectFlowHrefFragment(selectedObjectFlowItem)
  const selectedObjectKeyOrAnchor =
    selectedObjectFlowItem?.anchor.objectKey ?? (selectedObjectFragment ? `#${selectedObjectFragment}` : selectedObjectFlowItem?.anchor.id)
  const selectedObjectActionKey = selectedObjectFlowItem?.anchor.objectKey ?? null
  const selectedObjectClaimCheck = (concept.claim_checks ?? [])
    .map((check, index) => ({ check, index }))
    .find(({ check, index }) => claimCheckMatchesObjectFlowItem(check, index, selectedObjectFlowItem))?.check
  const selectedObjectSourceCount = selectedObjectFlowItem?.anchor.sourceIds?.length ?? 0
  const selectedObjectSourceIds = selectedObjectFlowItem?.anchor.sourceIds?.map((sourceId) => sourceId.trim()).filter(Boolean) ?? []
  const selectedObjectContext =
    (selectedObjectFlowItem ? objectFlowContextLabel(selectedObjectFlowItem, 120) : undefined) ??
    (selectedObjectSourceCount ? `${selectedObjectSourceCount} source IDs attached` : 'Object-attached learning state')
  const selectedObjectRoomSourceBoundary =
    [
      selectedObjectClaimCheck ? selectedObjectClaimBadge(selectedObjectClaimCheck) : null,
      selectedObjectSourceIds.length ? `sources: ${selectedObjectSourceIds.slice(0, 3).join(', ')}` : null,
    ]
      .filter((entry): entry is string => Boolean(entry))
      .join(' - ') || 'Source boundary pending'
  const selectedObjectSnapshotBadge =
    selectedObjectFlowItem && savedObjectAnchorId === selectedObjectFlowItem.anchor.id
      ? 'Local snapshot saved'
      : 'Local snapshot ready'
  const selectedObjectCodeItem = objectFlowItems.find((item) => item.anchor.objectType === 'code-witness')
  const selectedObjectPredictionItem = objectFlowItems.find((item) => item.anchor.objectType === 'visualization')
  const selectedObjectCodeHref =
    selectedObjectCodeItem?.anchor.href ?? '#code'
  const selectedObjectPredictionHref =
    selectedObjectPredictionItem?.anchor.href ?? '#interactive-demo'
  const selectedObjectCodeLabel = snapshotString(selectedObjectCodeItem?.anchor.title ?? `${concept.title} code witness`, 90)
  const selectedObjectCodeDetail = snapshotString(
    codeWitnessDetail(selectedObjectCodeItem, codeObjectSpans, sections.codeHtml),
    150
  )
  const selectedObjectPredictionLabel = snapshotString(selectedObjectPredictionItem?.anchor.title ?? `${concept.title} prediction`, 90)
  const selectedObjectPredictionDetail = snapshotString(demoPrompt, 150)
  const selectedObjectWitnesses = [
    {
      label: 'Math',
      title: mathObjectSpans.length ? `${mathObjectSpans.length} equation object${mathObjectSpans.length === 1 ? '' : 's'}` : 'Read the symbolic route',
      detail: mathObjectSpans[0]?.snippet ?? 'Turn the story into the exact invariant.',
      href: mathObjectSpans[0]?.domId ? `#${mathObjectSpans[0].domId}` : '#math',
    },
    {
      label: 'Code',
      title: selectedObjectCodeLabel,
      detail: selectedObjectCodeDetail,
      href: selectedObjectCodeHref,
    },
    {
      label: 'Demo',
      title: selectedObjectPredictionLabel,
      detail: selectedObjectPredictionDetail,
      href: selectedObjectPredictionHref,
    },
  ]
  const selectedObjectDrawerQuestion = snapshotString(
    selectedObjectFlowItem?.thread.seedPrompt ?? 'Attach a grounded question to the selected object before asking for help.',
    180
  )
  const selectedObjectStudioTitle = snapshotString(selectedObjectFlowItem?.anchor.title ?? concept.title, 92, concept.title)
  const selectedObjectStudioKind = selectedObjectFlowItem
    ? objectFlowTypeLabel(selectedObjectFlowItem.anchor.objectType)
    : 'Concept object'
  const learningStudioModes = [
    {
      role: 'Learner',
      cue: 'Retrieve first; repair the missing prerequisite.',
      question: 'Can I say the mechanism back in one sentence before I reveal anything?',
      action: 'Start with the prediction checkpoint, then compare the reveal to the mental model.',
      href: selectedObjectPredictionHref,
      badge: 'intuition first',
      accent: '#2f7a78',
    },
    {
      role: 'Researcher',
      cue: 'Separate the claim, evidence, and uncertainty.',
      question: 'Which exact source, equation, or caveat would change my confidence?',
      action: 'Open the research drawer and ground the question to this selected object.',
      href: '#research-reading-room-workspace',
      badge: 'source first',
      accent: '#bf6b43',
    },
    {
      role: 'Experimenter',
      cue: 'Vary one mechanism; compare against the prediction.',
      question: 'What single knob should move if this explanation is right?',
      action: 'Jump to the demo, keep one variable fixed, and record what changes.',
      href: selectedObjectPredictionHref,
      badge: 'lab first',
      accent: '#6b6fbf',
    },
    {
      role: 'Professor',
      cue: 'Turn the insight into a teachable chain.',
      question: 'What prerequisite, invariant, and next concept would I teach in order?',
      action: 'Use the math bridge and next-move dock to make the explanation transferable.',
      href: '#math',
      badge: 'teach first',
      accent: '#4d8a57',
    },
  ]
  const activeStudioMode =
    learningStudioModes.find((mode) => mode.role === activeStudioModeRole) ?? learningStudioModes[0]
  const learningStudioMoves = [
    {
      step: '01',
      label: 'Predict',
      body: 'Commit before reveal.',
      href: selectedObjectPredictionHref,
    },
    {
      step: '02',
      label: 'Explain',
      body: 'Name the invariant.',
      href: '#math',
    },
    {
      step: '03',
      label: 'Ground',
      body: selectedObjectSourceCount ? `${selectedObjectSourceCount} source link${selectedObjectSourceCount === 1 ? '' : 's'} nearby.` : 'Find the local witness.',
      href: '#source-grounding',
    },
    {
      step: '04',
      label: 'Experiment',
      body: 'Change one knob.',
      href: selectedObjectPredictionHref,
    },
    {
      step: '05',
      label: 'Carry',
      body: 'Save the next question.',
      href: '#research-reading-room-workspace',
    },
  ]
  const selectedObjectSavedAction =
    selectedObjectActionDraft?.objectKey && selectedObjectActionDraft.objectKey === selectedObjectActionKey
      ? selectedObjectActionDraft
      : null
  const selectedObjectResolvedAction =
    !selectedObjectSavedAction &&
    selectedObjectActionResolution?.objectKey &&
    selectedObjectActionResolution.objectKey === selectedObjectActionKey
      ? selectedObjectActionResolution
      : null
  const inspectedRouteHistoryObject =
    routeSnapshot?.mappingId !== `concept:${concept.id}` && !snapshotNextRepairMatchesConcept(routeSnapshot, conceptHref)
      ? routeHistoryObjectForConcept(routeSnapshot, conceptHref)
      : null
  const activeRepairReturnHref = inspectedRouteHistoryObject ? routeSnapshot?.currentObject?.href ?? null : null
  const activeRouteHistoryObjects =
    routeSnapshot?.mappingId === `concept:${concept.id}` ? routeHistoryObjects(routeSnapshot) : []
  const activeRouteHistoryObject = activeRouteHistoryObjects[0] ?? null
  const activeRouteEarlierHistoryObjects = routeHistoryObjectsAfterPrimary(
    activeRouteHistoryObjects,
    activeRouteHistoryObject
  )
  const activeRouteNextRepair = routeSnapshot?.mappingId === `concept:${concept.id}` ? nextRepairConcept(routeSnapshot) : null
  const activeRouteHistoryBridge = activeRouteHistoryObject
    ? {
        label: activeRouteHistoryObject.status === 'route handoff history' ? 'Activation bridge' : 'Comparison bridge',
        title: snapshotString(`${activeRouteHistoryObject.title} -> ${concept.title}`, 180),
        detail: snapshotString(
          routeHistoryComparisonDetail(activeRouteHistoryObject, concept.title, activeRouteNextRepair?.label ?? routeSnapshot?.nextRepair),
          190
        ),
        href: activeRouteHistoryObject.href,
        historyLinkLabel:
          activeRouteHistoryObject.status === 'route handoff history' ? 'Inspect prior repair' : 'Inspect history',
        earlierHistoryLabel: activeRouteEarlierHistoryObjects.length
          ? routeHistorySummary(activeRouteEarlierHistoryObjects)
          : null,
        earlierHistoryLinks: activeRouteEarlierHistoryObjects
          .filter((object) => object.href)
          .map((object, index) => ({
            href: object.href as string,
            label: routeHistoryLinkLabel(object, index),
          })),
        nextRepairLabel: activeRouteNextRepair?.label ?? routeSnapshot?.nextRepair ?? null,
        nextRepairHref: activeRouteNextRepair?.href ?? null,
      }
    : null
  const objectSpanReturnAction =
    activeRepairReturnHref && selectedObjectFragment
      ? {
          href: activeRepairReturnHref,
          label: 'Return to active repair',
          detail: snapshotString(`Active route remains ${routeSnapshot?.currentObject?.title ?? 'the saved repair'}.`, 140),
        }
      : undefined
  const mathObjectReturnAction = mathObjectSpans.some((span) => span.domId === selectedObjectFragment)
    ? objectSpanReturnAction
    : undefined
  const codeObjectReturnAction = codeObjectSpans.some((span) => span.domId === selectedObjectFragment)
    ? objectSpanReturnAction
    : undefined

  useEffect(() => {
    const refreshDraft = () => {
      setSelectedObjectActionDraft(getLocalObjectActionDraft(selectedObjectActionKey))
      setSelectedObjectActionResolution(getLocalObjectActionResolution(selectedObjectActionKey))
    }

    refreshDraft()
    window.addEventListener('storage', refreshDraft)
    window.addEventListener(localObjectActionJournalEventName, refreshDraft)
    return () => {
      window.removeEventListener('storage', refreshDraft)
      window.removeEventListener(localObjectActionJournalEventName, refreshDraft)
    }
  }, [selectedObjectActionKey])

  const rememberSelectedObjectFlowItem = () => {
    if (selectedObjectFlowItem) rememberObjectFlowSelection(selectedObjectFlowItem)
  }

  const rememberWitnessTriadObservation = (observation: WitnessTriadObservation) => {
    const selectedItem =
      (observation.objectAnchorId
        ? discussionItems.find((item) => item.anchor.id === observation.objectAnchorId)
        : undefined) ??
      selectedObjectFlowItem ??
      discussionItems[0]
    if (!selectedItem) return

    const previousSnapshot = getSavedLearningRouteSnapshot()
    if (isInspectingSavedRouteHistory(previousSnapshot, concept.id, conceptHref)) return

    const selectedObject = routeSourceObjectFromDiscussionItem(selectedItem)
    const now = new Date().toISOString()
    const beforeGb = 85.9
    const afterGb = 171.8
    const snapshot = conceptNotebookSnapshot({
      concept,
      domainTitle,
      conceptHref,
      sectionOverview,
      prerequisites,
      leadsTo,
      related,
      nextLearning,
      selectedItem,
      selectedObject,
      discussionItems,
    })
    const observationValue = 'T doubled; KV memory doubled'
    const nextSnapshot: LearningRouteSnapshot = {
      ...snapshot,
      currentQuestion: snapshotString(observation.invariant, 220),
      currentObject: {
        ...selectedObject,
        role: snapshotString(observation.prediction, 140),
        status: 'witness triad observed',
        sourceDetail: snapshotString(observation.observed, 160),
      },
      routeProgress: {
        ...snapshot.routeProgress!,
        checkpoints: [
          ...(snapshot.routeProgress?.checkpoints ?? []).filter((checkpoint) => checkpoint.id !== observation.triadId),
          {
            id: observation.triadId,
            label: 'KV witness triad',
            status: 'saved',
            detail: snapshotString(observationValue, 180),
            updatedAt: now,
          },
        ],
        resolvedObjectIds: selectedObject.discussionAnchorId ? [selectedObject.discussionAnchorId] : [],
        updatedAt: now,
      },
      lastObservation: {
        label: 'KV memory witness',
        value: snapshotString(observationValue, 160),
        detail: snapshotString(`${observation.observed} Prediction: ${observation.prediction}.`, 360),
        nextQuestion: snapshotString(observation.nextRepair, 220),
        source: 'kv-memory-lab',
        updatedAt: now,
        kind: 'formula-comparison',
        changed: {
          symbol: 'T',
          from: 32768,
          to: 65536,
        },
        heldFixed: observation.heldFixed.map((symbol) => ({
          symbol,
          value: 'fixed',
        })),
        result: {
          before: beforeGb,
          after: afterGb,
          ratio: 2,
          unit: 'GB-decimal',
        },
        caveat: 'Decimal GB from the local code witness; production serving adds overhead.',
        labState: {
          context: 65536,
          layers: 80,
          queryHeads: 64,
          kvHeads: 8,
          dHead: 128,
          batch: 8,
          bytes: 2,
        },
      },
    }
    const activatedSnapshot = preserveActivatedRouteTrail(nextSnapshot, previousSnapshot, conceptHref)

    if (
      saveLearningRouteSnapshot(
        preserveResolvedRouteHistory(activatedSnapshot, previousSnapshot, concept.id, conceptHref)
      )
    ) {
      setSelectedObjectAnchorId(selectedItem.anchor.id)
      setSavedObjectAnchorId(selectedItem.anchor.id)
      lastRememberedObjectAnchorIdRef.current = selectedItem.anchor.id
    }
  }

  const rememberEfficientAttentionWorkbenchObservation = (observation: EfficientAttentionWorkbenchObservation) => {
    const selectedItem = efficientAttentionKvCacheRoomItem(discussionItems) ?? selectedObjectFlowItem ?? discussionItems[0]
    if (!selectedItem) return false

    const previousSnapshot = getSavedLearningRouteSnapshot()
    if (isInspectingSavedRouteHistory(previousSnapshot, concept.id, conceptHref)) return false

    const selectedObject = routeSourceObjectFromDiscussionItem(selectedItem)
    const now = new Date().toISOString()
    const snapshot = conceptNotebookSnapshot({
      concept,
      domainTitle,
      conceptHref,
      sectionOverview,
      prerequisites,
      leadsTo,
      related,
      nextLearning,
      selectedItem,
      selectedObject,
      discussionItems,
    })
    const observationValue = `${observation.predictionLabel}: ${observation.memoryLabel}, ${observation.reduction.toFixed(1)}x reduction vs MHA`
    const nextSnapshot: LearningRouteSnapshot = {
      ...snapshot,
      currentQuestion: snapshotString(observation.roleQuestion, 220),
      currentObject: {
        ...selectedObject,
        role: snapshotString(`${observation.roleLabel} lens: ${observation.predictionLabel}`, 140),
        status: 'workbench observation carried',
        sourceDetail: snapshotString(
          `g=${observation.groupSize}, H_kv=${observation.kvHeads}, ${observation.memoryLabel}`,
          160
        ),
      },
      routeProgress: {
        ...snapshot.routeProgress!,
        checkpoints: [
          ...(snapshot.routeProgress?.checkpoints ?? []).filter(
            (checkpoint) => checkpoint.id !== 'efficient-attention-workbench'
          ),
          {
            id: 'efficient-attention-workbench',
            label: 'Efficient Attention workbench',
            status: 'saved',
            detail: snapshotString(observationValue, 180),
            updatedAt: now,
          },
        ],
        resolvedObjectIds: selectedObject.discussionAnchorId ? [selectedObject.discussionAnchorId] : [],
        updatedAt: now,
      },
      lastObservation: {
        label: 'Efficient attention workbench',
        value: snapshotString(observationValue, 160),
        detail: snapshotString(
          `labId=${efficientAttentionWorkbenchLabId}; labVersion=${efficientAttentionWorkbenchLabVersion}; predictionId=${observation.predictionId}; ${observation.evidence} ${observation.invariant}`,
          360
        ),
        nextQuestion: snapshotString(observation.nextMove, 220),
        source: 'kv-memory-lab',
        updatedAt: now,
        kind: 'formula-comparison',
        changed: {
          symbol: 'H_kv',
          from: observation.queryHeads,
          to: observation.kvHeads,
        },
        heldFixed: [
          { symbol: 'B', value: observation.batch },
          { symbol: 'L', value: observation.layers },
          { symbol: 'T', value: observation.sequenceLength },
          { symbol: 'H_q', value: observation.queryHeads },
          { symbol: 'd', value: observation.headDim },
          { symbol: 's', value: observation.valueBytes },
        ],
        result: {
          before: observation.mhaMemoryGb,
          after: observation.memoryGb,
          ratio: observation.reduction,
          unit: 'GB-decimal',
        },
        caveat: 'Memory witness only; model quality still needs a separate experiment.',
        labState: {
          context: observation.sequenceLength,
          layers: observation.layers,
          queryHeads: observation.queryHeads,
          kvHeads: observation.kvHeads,
          dHead: observation.headDim,
          batch: observation.batch,
          bytes: observation.valueBytes,
        },
      },
    }
    const activatedSnapshot = preserveActivatedRouteTrail(nextSnapshot, previousSnapshot, conceptHref)
    const saved = saveLearningRouteSnapshot(
      preserveResolvedRouteHistory(activatedSnapshot, previousSnapshot, concept.id, conceptHref)
    )

    if (saved) {
      setSelectedObjectAnchorId(selectedItem.anchor.id)
      setSavedObjectAnchorId(selectedItem.anchor.id)
      lastRememberedObjectAnchorIdRef.current = selectedItem.anchor.id
    }

    return saved
  }

  const selectedObjectOptions: SelectedObjectOption[] = objectFlowItems.map((item) => ({
    id: item.anchor.id,
    label: snapshotString(item.anchor.title, 72, 'Concept object'),
    typeLabel: objectFlowTypeLabel(item.anchor.objectType),
    contextLabel: objectFlowContextLabel(item),
    href: item.anchor.href,
  }))
  const selectedObjectBadges: SelectedObjectBadge[] = []
  if (selectedObjectSourceCount) {
    selectedObjectBadges.push({
      label: `${selectedObjectSourceCount} source${selectedObjectSourceCount === 1 ? '' : 's'} attached`,
      tone: 'source',
    })
  }
  if (selectedObjectClaimCheck) {
    selectedObjectBadges.push({
      label: selectedObjectClaimBadge(selectedObjectClaimCheck),
      tone: 'claim',
    })
  }
  selectedObjectBadges.push({
    label: selectedObjectSnapshotBadge,
    tone: 'saved',
  })
  const selectedObjectBarActions: SelectedObjectAction[] = [
    {
      id: 'predict',
      label: 'Predict',
      detail: 'before reveal',
      href: selectedObjectPredictionHref,
      primary: true,
      onClick: rememberSelectedObjectFlowItem,
    },
    {
      id: 'code',
      label: 'Code',
      detail: 'witness nearby',
      href: selectedObjectCodeHref,
      onClick: rememberSelectedObjectFlowItem,
    },
    {
      id: 'ask',
      label: 'Ask',
      detail: 'grounded prompt',
      href: '#research-reading-room-workspace',
      onClick: rememberSelectedObjectFlowItem,
    },
  ]
  if (activeRepairReturnHref) {
    selectedObjectBarActions.push({
      id: 'return',
      label: 'Return',
      detail: 'active repair',
      href: activeRepairReturnHref,
    })
  }
  const selectedObjectBarSavedAction: SelectedObjectSavedAction | null = selectedObjectSavedAction
    ? {
        label: 'Saved action',
        title: snapshotString(selectedObjectSavedAction.nextAction, 150),
        detail: snapshotString(selectedObjectSavedAction.note, 170),
      }
    : selectedObjectResolvedAction
      ? {
          label: 'Resolved action',
          title: snapshotString(selectedObjectResolvedAction.resolvedAction, 150),
          detail: snapshotString(selectedObjectResolvedAction.resolutionNote, 170),
          resolved: true,
        }
      : null
  const selectedObjectHistoryBridge: SelectedObjectHistoryBridge | null = activeRouteHistoryBridge
    ? {
        label: activeRouteHistoryBridge.label,
        title: activeRouteHistoryBridge.title,
        detail: activeRouteHistoryBridge.detail,
        links: [
          ...(activeRouteHistoryBridge.href
            ? [{ href: activeRouteHistoryBridge.href, label: activeRouteHistoryBridge.historyLinkLabel }]
            : []),
          ...activeRouteHistoryBridge.earlierHistoryLinks,
        ],
        nextRepairLabel: activeRouteHistoryBridge.nextRepairLabel,
        nextRepairHref: activeRouteHistoryBridge.nextRepairHref,
      }
    : null
  const selectedObjectBarWitnesses: SelectedObjectWitness[] = selectedObjectWitnesses.map((witness) => ({
    ...witness,
    title: snapshotString(witness.title, 72),
    detail: snapshotString(witness.detail, 96),
    onClick: rememberSelectedObjectFlowItem,
  }))

  const makeSectionActions = (section: SectionOverview) => (
    <SectionAIActionStrip
      conceptTitle={concept.title}
      conceptDescription={concept.short_description}
      domainTitle={domainTitle}
      sectionTitle={section.label}
      sectionStep={section.step}
      sectionSummary={section.summary}
      sectionSnippet={sectionPrompts?.[section.id === 'interactive-demo' ? 'demo' : section.id]}
      prerequisites={prerequisiteLabels}
      nextConcept={nextConceptLabel}
      tone={section.id === 'interactive-demo' ? 'demo' : section.id}
    />
  )
  const objectFlowPanel = objectFlowItems.length && selectedObjectFlowItem ? (
    <div id="selected-object-context">
      <SelectedObjectBar
        progressLabel={objectFlowProgress ?? sectionReadyProgress}
        options={selectedObjectOptions}
        selectedId={selectedObjectFlowItem.anchor.id}
        selected={{
          typeLabel: objectFlowTypeLabel(selectedObjectFlowItem.anchor.objectType),
          title: snapshotString(selectedObjectFlowItem.anchor.title, 96, 'Selected learning object'),
          context: snapshotString(selectedObjectContext, 120),
          question: selectedObjectDrawerQuestion,
          keyLabel: selectedObjectKeyOrAnchor ? snapshotString(selectedObjectKeyOrAnchor, 110) : null,
        }}
        badges={selectedObjectBadges}
        actions={selectedObjectBarActions}
        savedAction={selectedObjectBarSavedAction}
        historyBridge={selectedObjectHistoryBridge}
        witnesses={selectedObjectBarWitnesses}
        onSelect={(id) => {
          const item = objectFlowItems.find((candidate) => candidate.anchor.id === id)
          if (item) rememberObjectFlowSelection(item)
        }}
      />
    </div>
  ) : null

  return (
    <div className="concept-notebook-page">
      <NotebookLayout
        eyebrow={domainTitle}
        title={concept.title}
        lede={concept.short_description || 'A concept page in the Continuous Function notebook format.'}
        breadcrumb={[
          { label: 'Home', href: '/' },
          { label: 'Domains', href: '/domains/' },
          { label: domainTitle, href: domainHref },
          { label: concept.title },
        ]}
        meta={meta}
        actions={[
          { href: domainHref, label: `Back to ${domainTitle}` },
          ...(nextLearning?.href ? [{ href: nextLearning.href, label: `Next: ${nextLabel}`, variant: 'secondary' as const }] : []),
        ]}
        ambientImage={conceptImage?.src}
        heroVisual={(
          <ConceptSnapshot
            conceptId={concept.id}
            title={concept.title}
            prerequisites={prerequisites.length}
            leadsTo={leadsTo.length}
            related={related.length}
            sections={sectionOverview}
            image={conceptImage}
          />
        )}
        rail={(
          <ConceptNotebookRail
            domainTitle={domainTitle}
            domainHref={domainHref}
            tags={concept.tags ?? []}
            sections={sectionOverview.map(({ id, label, ready }) => ({ id, label, ready }))}
            prerequisites={prerequisites}
            leadsTo={leadsTo}
            related={related}
            demoPrompt={demoPrompt}
            nextLearning={nextLearning}
            prevInDomain={prevInDomain}
            nextInDomain={nextInDomain}
            conceptId={concept.id}
            conceptTitle={concept.title}
            conceptDescription={concept.short_description}
          />
        )}
      >
        <div className="section-grid">
          <section className="mobile-learning-map" aria-label="Mobile learning map">
            <div>
              <p>Learning map</p>
              <strong>{concept.title}</strong>
            </div>
            <div className="mobile-learning-map-grid">
              {mobileRouteState.map((state) => (
                <span key={state.label}>
                  <em>{state.label}</em>
                  <b>{state.value}</b>
                </span>
              ))}
            </div>
          </section>

          <section id="learning-studio-loop" className="learning-studio-panel" aria-label="Learning and research studio loop">
            <div className="learning-studio-current">
              <div className="learning-studio-current-topline">
                <span>{selectedObjectStudioKind}</span>
                <b>{activeStudioMode.role} lens</b>
              </div>
              <h2>{selectedObjectStudioTitle}</h2>
              <p>{selectedObjectDrawerQuestion}</p>
              <div className="learning-studio-lens-card" style={{ '--mode-accent': activeStudioMode.accent } as CSSProperties}>
                <span>Mode question</span>
                <strong>{activeStudioMode.question}</strong>
                <p>{activeStudioMode.action}</p>
                <a href={activeStudioMode.href} onClick={rememberSelectedObjectFlowItem}>
                  Take this move
                </a>
              </div>
              <div className="learning-studio-actions" aria-label="Selected object learning actions">
                <a href={selectedObjectPredictionHref} onClick={rememberSelectedObjectFlowItem}>Predict</a>
                <a href={selectedObjectCodeHref} onClick={rememberSelectedObjectFlowItem}>Code</a>
                <a href="#research-reading-room-workspace" onClick={rememberSelectedObjectFlowItem}>Ask</a>
              </div>
            </div>
            <div className="learning-studio-modes">
              <div className="learning-studio-heading">
                <p>Study modes</p>
                <strong>Read the concept from four angles.</strong>
              </div>
              <div className="learning-studio-mode-grid">
                {learningStudioModes.map((mode) => (
                  <button
                    key={mode.role}
                    type="button"
                    className={`learning-studio-mode ${activeStudioMode.role === mode.role ? 'is-active' : ''}`}
                    style={{ '--mode-accent': mode.accent } as CSSProperties}
                    aria-pressed={activeStudioMode.role === mode.role}
                    onClick={() => setActiveStudioModeRole(mode.role)}
                  >
                    <span aria-hidden="true" />
                    <strong>{mode.role}</strong>
                    <p>{mode.cue}</p>
                    <em>{mode.badge}</em>
                  </button>
                ))}
              </div>
            </div>
            <div className="learning-studio-loop" aria-label="Learning science action loop">
              {learningStudioMoves.map((move) => (
                <a key={move.step} href={move.href} className="learning-studio-move" onClick={rememberSelectedObjectFlowItem}>
                  <span>{move.step}</span>
                  <strong>{move.label}</strong>
                  <em>{move.body}</em>
                </a>
              ))}
            </div>
          </section>

          {objectFlowPanel}

          {concept.id === 'efficient-attention' ? (
            <EfficientAttentionLivingLabPanel
              savedRouteSnapshot={routeSnapshot}
              onSaveObservation={rememberEfficientAttentionWorkbenchObservation}
            />
          ) : null}

          {concept.id === 'efficient-attention' && selectedObjectFlowItem ? (
            <ObjectRoomPanel
              conceptId={concept.id}
              conceptTitle={concept.title}
              selectedItem={selectedObjectFlowItem}
              objectTypeLabel={objectFlowTypeLabel(selectedObjectFlowItem.anchor.objectType)}
              objectContext={snapshotString(selectedObjectContext, 140)}
              objectKeyLabel={selectedObjectKeyOrAnchor ? snapshotString(selectedObjectKeyOrAnchor, 140) : null}
              sourceBoundary={selectedObjectRoomSourceBoundary}
              predictionHref={selectedObjectPredictionHref}
              codeHref={selectedObjectCodeHref}
              roomHref="#research-reading-room-workspace"
              onRememberObject={rememberSelectedObjectFlowItem}
            />
          ) : null}

          {witnessTriads.length ? (
            <WitnessTriad
              triads={witnessTriads}
              selectedObjectAnchorId={selectedObjectFlowItem?.anchor.id}
              onSelectObject={(anchorId) => {
                const item = discussionItems.find((candidate) => candidate.anchor.id === anchorId)
                if (item) rememberObjectFlowSelection(item)
              }}
              onSaveObservation={rememberWitnessTriadObservation}
            />
          ) : null}

          <div className="object-route-state">
            <LearningRouteContinuityBanner
              surface="concept-notebook"
              compact
              activeConcept={{
                id: concept.id,
                title: concept.title,
                href: conceptHref,
              }}
            />
          </div>

          <section className="continuity-panel" aria-label="Conceptual transition">
            <div className="continuity-header">
              <p>Conceptual Bridge</p>
              <h2>What should feel connected as you move through this page.</h2>
            </div>
            <div className="continuity-grid">
              {continuityNodes.map((node) => (
                <article key={node.label} className="continuity-card">
                  <span>{node.label}</span>
                  <strong>{node.title}</strong>
                  <p>{node.body}</p>
                </article>
              ))}
            </div>
            <div className="continuity-try">
              <span>Test the link</span>
              <strong>{demoPrompt}</strong>
              {nextLearning?.href ? <Link href={nextLearning.href}>{`Then continue to ${nextLabel}`}</Link> : null}
            </div>
          </section>

          <div className="section-strip" aria-label="Section overview">
            {sectionOverview.map((section) => (
              <a key={section.id} href={`#${section.id}`} className={`section-strip-card ${section.ready ? 'ready' : 'pending'}`}>
                <span className="section-strip-step">{section.step}</span>
                <strong>{section.label}</strong>
                <span className="section-strip-summary">{section.summary}</span>
              </a>
            ))}
          </div>

          <ConceptSection
            id="intuition"
            step="01"
            title="Intuition"
            summary="Build the mental picture first so the rest of the page has something to attach to."
            tone="intuition"
            html={sections.intuitionHtml}
            aiActions={makeSectionActions(sectionOverview[0])}
          />

          <ConceptSection
            id="math"
            step="02"
            title="Math"
            summary="Translate the story into symbols, assumptions, and a derivation you can inspect."
            tone="math"
            html={sections.mathHtml}
            objectSpans={mathObjectSpans}
            objectReturnAction={mathObjectReturnAction}
            aiActions={makeSectionActions(sectionOverview[1])}
          />

          <ConceptSection
            id="code"
            step="03"
            title="Code"
            summary="Keep the implementation aligned with the notation so the algorithm is legible."
            tone="code"
            html={sections.codeHtml}
            objectSpans={codeObjectSpans}
            objectReturnAction={codeObjectReturnAction}
            emptyState="No runnable code example is attached to this concept yet."
            aiActions={makeSectionActions(sectionOverview[2])}
          />

          <ConceptSection
            id="interactive-demo"
            step="04"
            title="Interactive Demo"
            summary="Use direct manipulation to connect the explanation to a moving system."
            tone="demo"
            html={sections.demoHtml}
            emptyState="No interactive demo is attached yet. Add a co-located viz.tsx to light this section up."
            aiActions={makeSectionActions(sectionOverview[3])}
          >
            {Viz ? (
              <VizShell
                eyebrow="Live Concept Demo"
                title={`Explore ${concept.title}`}
                subtitle="The stage is code-native and interactive. Use it to test the explanation against the mechanism."
                challengePlacement="before-stage"
                metrics={[
                  `difficulty ${concept.difficulty}/5`,
                  concept.math_level || 'math level pending',
                  concept.has_code_example ? 'code-aligned' : 'concept-first',
                ]}
                challenge={
                  <DemoPredictionCheckpoint
                    conceptId={concept.id}
                    conceptTitle={concept.title}
                    demoPrompt={demoPrompt}
                    nextConcept={nextConceptLabel}
                    onReveal={rememberDemoPrediction}
                  />
                }
              >
                <Viz />
              </VizShell>
            ) : (
              <div className="demo-placeholder">
                <p>No live visualization is registered for this concept yet.</p>
                <p>
                  The page still supports explanatory demo notes above; when a <code>viz.tsx</code> exists, it will
                  render here without changing the route.
                </p>
              </div>
            )}
          </ConceptSection>

          <section className="deepening-intro" aria-label="Research and visual deepening">
            <div>
              <p>After The First Pass</p>
              <h2>Turn the concept into an inspected object.</h2>
            </div>
            <p>
              Once the invariant is visible in the intuition, math, code, and demo, use these panels to inspect
              the mechanism visually, check source support, practice the idea, and attach a grounded research question.
            </p>
          </section>

          <ConceptMechanismStoryboard
            conceptTitle={concept.title}
            conceptDescription={concept.short_description}
            sections={sectionOverview}
            nextConcept={nextConceptLabel}
            image={conceptImage}
            hasVisualization={Boolean(Viz)}
          />

          <ConceptVisualInquiryPanel
            conceptTitle={concept.title}
            conceptDescription={concept.short_description}
            sections={sectionOverview}
            nextConcept={nextConceptLabel}
            image={conceptImage}
            hasVisualization={Boolean(Viz)}
            onReveal={rememberVisualInquiry}
          />

          <ConceptSourcePanel sources={concept.sources} />

          <ConceptClaimReviewPanel
            concept={concept}
            sources={concept.sources}
            claimChecks={concept.claim_checks}
            objectSpans={objectSpans}
            hasVisualization={Boolean(Viz)}
          />

          <PracticeShell
            conceptTitle={concept.title}
            conceptDescription={concept.short_description}
            domainTitle={domainTitle}
            prerequisites={prerequisiteLabels}
            nextConcept={nextConceptLabel}
            demoPrompt={demoPrompt}
          />

          <div id="research-reading-room-workspace" className="research-room-drawer-shell">
            <div className="research-room-drawer-topline">
              <span>Object research drawer</span>
              <a href="#selected-object-context">Close</a>
            </div>
            {selectedObjectFlowItem ? (
              <>
                <div className="research-drawer-context-strip" aria-label="Selected object drawer context">
                  <div>
                    <span>{objectFlowTypeLabel(selectedObjectFlowItem.anchor.objectType)}</span>
                    <strong>{snapshotString(selectedObjectFlowItem.anchor.title, 96, 'Selected learning object')}</strong>
                    <em>{snapshotString(selectedObjectContext, 120)}</em>
                  </div>
                  <nav aria-label="Drawer learning links">
                    <a href={selectedObjectCodeHref} onClick={rememberSelectedObjectFlowItem}>Code witness</a>
                    <a href={selectedObjectPredictionHref} onClick={rememberSelectedObjectFlowItem}>Prediction checkpoint</a>
                  </nav>
                </div>
                <div className="research-drawer-proximity-grid" aria-label="Drawer prediction and code context">
                  <a href={selectedObjectCodeHref} onClick={rememberSelectedObjectFlowItem}>
                    <span>Code witness comparison</span>
                    <strong>{selectedObjectCodeLabel}</strong>
                    <em>{selectedObjectCodeDetail}</em>
                  </a>
                  <a href={selectedObjectPredictionHref} onClick={rememberSelectedObjectFlowItem}>
                    <span>Prediction before reveal</span>
                    <strong>{selectedObjectPredictionLabel}</strong>
                    <em>{selectedObjectPredictionDetail}</em>
                  </a>
                  <div>
                    <span>Grounded room question</span>
                    <strong>{selectedObjectDrawerQuestion}</strong>
                    <em>{selectedObjectSnapshotBadge}</em>
                  </div>
                </div>
              </>
            ) : null}
            <ResearchReadingRoom
              eyebrow="Research Room"
              title="Attach the question to an exact object"
              intro="Pick the concept, equation, source, code witness, claim, misconception, or demo state before asking for help. The handoff stays grounded to that object."
              items={discussionItems}
              variant="compact"
              draftMode="progressive"
              showAnchorIds
              preferredAnchorId={selectedObjectFlowItem?.anchor.id}
              onFocusObject={(item) => rememberObjectFlowSelection(item)}
            />
          </div>

          {(prevInDomain || nextInDomain) ? (
            <nav className="pager" aria-label="Nearby domain navigation">
              {prevInDomain ? (
                <Link href={prevInDomain.href} className="pager-link">
                  <span className="pager-kicker">Previous concept</span>
                  <span className="pager-title">{prevInDomain.title}</span>
                </Link>
              ) : (
                <span />
              )}

              {nextInDomain ? (
                <Link href={nextInDomain.href} className="pager-link align-right">
                  <span className="pager-kicker">Nearby concept</span>
                  <span className="pager-title">{nextInDomain.title}</span>
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>

        <style jsx>{`
          .section-grid {
            display: flex;
            flex-direction: column;
            min-width: 0;
            gap: 1.25rem;
          }

          :global(.app-root.editorial-surface .app-main-inner > .concept-notebook-page) {
            overflow: visible !important;
          }

          :global(html:has(.concept-notebook-page)),
          :global(body:has(.concept-notebook-page)) {
            overflow-x: clip;
          }

          :global(.concept-notebook-page .notebook-page) {
            overflow: visible !important;
          }

          :global(.concept-notebook-page .learning-studio-panel h2::before),
          :global(.concept-notebook-page .continuity-panel h2::before),
          :global(.concept-notebook-page .deepening-intro h2::before) {
            content: none;
            display: none;
          }

          :global(.concept-notebook-page #intuition),
          :global(.concept-notebook-page #math),
          :global(.concept-notebook-page #code),
          :global(.concept-notebook-page #interactive-demo),
          :global(.concept-notebook-page #selected-object-context),
          :global(.concept-notebook-page #object-room-prototype),
          :global(.concept-notebook-page #research-reading-room-workspace),
          :global(.concept-notebook-page [id^='math-object-']),
          :global(.concept-notebook-page [id^='code-witness-']),
          :global(.concept-notebook-page [id^='claim-check-']),
          :global(.concept-notebook-page [id^='source-']) {
            scroll-margin-top: 20.5rem;
          }

          .continuity-panel {
            display: grid;
            gap: 0.8rem;
            min-width: 0;
            padding: 1.05rem;
            border-radius: 22px;
            border: 1px solid rgba(27, 36, 48, 0.08);
            background:
              radial-gradient(circle at top left, rgba(31, 111, 120, 0.09), transparent 32%),
              rgba(255, 251, 245, 0.78);
          }

          .continuity-header {
            display: grid;
            gap: 0.35rem;
            max-width: 54rem;
          }

          .continuity-header p,
          .continuity-card span,
          .continuity-try span {
            margin: 0;
            font-family: var(--font-mono);
            font-size: 0.68rem;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #1f6f78;
          }

          .continuity-header h2 {
            margin: 0;
            font-family: var(--font-display);
            font-size: clamp(1.35rem, 2.4vw, 1.9rem);
            line-height: 1.05;
            color: #17202a;
            letter-spacing: 0;
          }

          .continuity-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.8rem;
          }

          .continuity-card {
            display: grid;
            gap: 0.4rem;
            min-width: 0;
            padding: 0.95rem;
            border-radius: 8px;
            border: 1px solid rgba(27, 36, 48, 0.08);
            background: rgba(255, 251, 245, 0.86);
          }

          .continuity-card span {
            color: #5b6874;
          }

          .continuity-card strong,
          .continuity-try strong,
          .continuity-try :global(a) {
            color: #17202a;
            text-decoration: none;
            line-height: 1.35;
            overflow-wrap: anywhere;
          }

          .continuity-card p {
            margin: 0;
            color: #52606b;
            line-height: 1.55;
          }

          .continuity-try {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto;
            gap: 0.8rem;
            align-items: center;
            padding: 0.82rem 0.95rem;
            border-radius: 16px;
            border: 1px solid rgba(31, 111, 120, 0.16);
            background: rgba(239, 247, 245, 0.78);
          }

          .continuity-try :global(a) {
            color: #1f4b99;
            font-weight: 700;
          }

          .continuity-try :global(a:hover) {
            color: #17202a;
            text-shadow: none;
          }

          .section-strip {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 0.8rem;
            min-width: 0;
          }

          .mobile-learning-map {
            display: none;
          }

          .object-route-state {
            min-width: 0;
          }

          .object-route-state:empty {
            display: none;
          }

          .learning-studio-panel {
            display: grid;
            grid-template-columns: minmax(17rem, 0.74fr) minmax(0, 1fr);
            gap: 0.82rem;
            min-width: 0;
            padding: 0.9rem;
            border-radius: 22px;
            border: 1px solid rgba(27, 36, 48, 0.09);
            background:
              linear-gradient(135deg, rgba(255, 251, 245, 0.92), rgba(239, 247, 245, 0.86)),
              rgba(255, 251, 245, 0.88);
            box-shadow: 0 16px 42px rgba(8, 16, 26, 0.07);
          }

          .learning-studio-current {
            display: grid;
            align-content: start;
            gap: 0.55rem;
            min-width: 0;
            padding: 1rem;
            border-radius: 16px;
            background: #15282f;
            color: #fffaf0;
          }

          .learning-studio-current-topline {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.6rem;
            min-width: 0;
          }

          .learning-studio-current span,
          .learning-studio-lens-card span,
          .learning-studio-heading p,
          .learning-studio-move span {
            margin: 0;
            font-family: var(--font-mono);
            font-size: 0.66rem;
            text-transform: uppercase;
            letter-spacing: 0.12em;
          }

          .learning-studio-current span {
            color: #f4c06f;
          }

          .learning-studio-current-topline b {
            display: inline-flex;
            align-items: center;
            min-height: 1.7rem;
            max-width: 50%;
            padding: 0.28rem 0.52rem;
            border-radius: 999px;
            border: 1px solid rgba(244, 192, 111, 0.34);
            color: #f9e0aa;
            background: rgba(244, 192, 111, 0.12);
            font-size: 0.72rem;
            line-height: 1.1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .learning-studio-current h2 {
            margin: 0;
            color: #fffaf0;
            font-family: var(--font-display);
            font-size: clamp(1.18rem, 2.1vw, 1.72rem);
            line-height: 1.05;
            letter-spacing: 0;
            overflow-wrap: anywhere;
          }

          .learning-studio-current p {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 3;
            margin: 0;
            overflow: hidden;
            color: rgba(239, 247, 245, 0.88);
            line-height: 1.46;
            overflow-wrap: anywhere;
          }

          .learning-studio-lens-card {
            display: grid;
            gap: 0.42rem;
            min-width: 0;
            padding: 0.72rem;
            border-radius: 12px;
            border: 1px solid rgba(255, 250, 240, 0.13);
            border-left: 4px solid var(--mode-accent, #2f7a78);
            background: rgba(255, 250, 240, 0.08);
          }

          .learning-studio-lens-card strong {
            color: #fffaf0;
            font-size: 0.94rem;
            line-height: 1.24;
            overflow-wrap: anywhere;
          }

          .learning-studio-lens-card p {
            display: block;
            -webkit-line-clamp: unset;
            margin: 0;
            overflow: visible;
            color: rgba(239, 247, 245, 0.78);
            font-size: 0.78rem;
            line-height: 1.42;
          }

          .learning-studio-lens-card a {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: fit-content;
            min-height: 2.75rem;
            max-width: 100%;
            padding: 0.4rem 0.62rem;
            border-radius: 999px;
            border: 1px solid rgba(255, 250, 240, 0.16);
            background: rgba(255, 250, 240, 0.92);
            color: #15282f;
            font-weight: 820;
            font-size: 0.78rem;
            line-height: 1.15;
            text-align: center;
            text-decoration: none;
            overflow-wrap: anywhere;
          }

          .learning-studio-actions {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.46rem;
            min-width: 0;
          }

          .learning-studio-actions a,
          .learning-studio-move {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 0;
            text-decoration: none;
            transition: border-color 0.18s ease, transform 0.18s ease, background 0.18s ease;
          }

          .learning-studio-actions a {
            min-height: 2.75rem;
            padding: 0.42rem 0.52rem;
            border-radius: 8px;
            background: #f4c06f;
            color: #15282f;
            font-weight: 850;
            font-size: 0.82rem;
            line-height: 1.1;
            text-align: center;
          }

          .learning-studio-actions a:nth-child(2) {
            background: #2f7a78;
            color: #fffaf0;
          }

          .learning-studio-actions a:nth-child(3) {
            background: #fffaf0;
            color: #15282f;
          }

          .learning-studio-actions a:hover,
          .learning-studio-move:hover {
            transform: translateY(-1px);
            text-shadow: none;
          }

          .learning-studio-modes {
            display: grid;
            align-content: start;
            gap: 0.68rem;
            min-width: 0;
          }

          .learning-studio-heading {
            display: flex;
            align-items: end;
            justify-content: space-between;
            gap: 0.8rem;
            min-width: 0;
          }

          .learning-studio-heading p {
            color: #bf6b43;
          }

          .learning-studio-heading strong {
            color: #17202a;
            font-size: 1.04rem;
            line-height: 1.18;
            text-align: right;
            overflow-wrap: anywhere;
          }

          .learning-studio-mode-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.62rem;
            min-width: 0;
          }

          .learning-studio-mode {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr);
            gap: 0.12rem 0.58rem;
            min-width: 0;
            min-height: 5.4rem;
            padding: 0.72rem;
            border-radius: 8px;
            border: 1px solid rgba(27, 36, 48, 0.1);
            background: rgba(255, 251, 245, 0.82);
            color: inherit;
            font: inherit;
            text-align: left;
            cursor: pointer;
            appearance: none;
          }

          .learning-studio-mode.is-active {
            border-color: color-mix(in srgb, var(--mode-accent, #1f6f78) 58%, rgba(27, 36, 48, 0.12));
            background:
              linear-gradient(135deg, rgba(255, 251, 245, 0.94), rgba(239, 247, 245, 0.92));
            box-shadow:
              inset 0 0 0 1px color-mix(in srgb, var(--mode-accent, #1f6f78) 30%, transparent),
              0 12px 22px rgba(8, 16, 26, 0.07);
          }

          .learning-studio-mode span {
            grid-row: span 2;
            width: 1.25rem;
            height: 1.25rem;
            margin-top: 0.12rem;
            border-radius: 999px;
            background: var(--mode-accent, #1f6f78);
          }

          .learning-studio-mode.is-active span {
            box-shadow:
              0 0 0 4px rgba(255, 251, 245, 0.95),
              0 0 0 6px color-mix(in srgb, var(--mode-accent, #1f6f78) 34%, transparent);
          }

          .learning-studio-mode strong {
            color: #17202a;
            line-height: 1.12;
            overflow-wrap: anywhere;
          }

          .learning-studio-mode p {
            margin: 0;
            color: #536271;
            font-size: 0.8rem;
            line-height: 1.34;
            overflow-wrap: anywhere;
          }

          .learning-studio-mode em {
            grid-column: 2;
            color: #6b7280;
            font-family: var(--font-mono);
            font-size: 0.62rem;
            font-style: normal;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            line-height: 1.2;
            overflow-wrap: anywhere;
          }

          .learning-studio-loop {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 0.62rem;
            min-width: 0;
          }

          .learning-studio-move {
            display: grid;
            justify-items: start;
            align-content: start;
            gap: 0.18rem;
            min-height: 5.85rem;
            padding: 0.72rem;
            border-radius: 8px;
            border: 1px solid rgba(27, 36, 48, 0.12);
            background: rgba(255, 251, 245, 0.86);
            color: #17202a;
          }

          .learning-studio-move:nth-child(even) {
            background: rgba(237, 245, 247, 0.86);
          }

          .learning-studio-move span {
            color: #c24a2d;
            font-size: 0.6rem;
          }

          .learning-studio-move strong {
            color: #17202a;
            line-height: 1.1;
            overflow-wrap: anywhere;
          }

          .learning-studio-move em {
            color: #52606b;
            font-size: 0.76rem;
            font-style: normal;
            line-height: 1.3;
            overflow-wrap: anywhere;
          }

          .object-flow-bar {
            position: sticky;
            top: 5.5rem;
            z-index: 8;
            display: grid;
            gap: 0.72rem;
            min-width: 0;
            max-height: 18rem;
            overflow-y: auto;
            overscroll-behavior: contain;
            scrollbar-gutter: stable;
            padding: 0.9rem;
            border-radius: 14px;
            border: 1px solid rgba(27, 36, 48, 0.12);
            background:
              linear-gradient(180deg, rgba(247, 242, 233, 0.94), rgba(247, 242, 233, 0.84)),
              rgba(255, 251, 245, 0.86);
            box-shadow: 0 14px 30px rgba(8, 16, 26, 0.08);
          }

          .object-flow-bar::-webkit-scrollbar {
            width: 0.5rem;
          }

          .object-flow-bar::-webkit-scrollbar-thumb {
            border-radius: 999px;
            background: rgba(31, 111, 120, 0.22);
          }

          .object-flow-header {
            display: flex;
            flex-wrap: wrap;
            gap: 0.65rem;
            align-items: center;
            justify-content: space-between;
            min-width: 0;
          }

          .object-flow-header p {
            margin: 0;
            font-family: var(--font-mono);
            font-size: 0.68rem;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #1f6f78;
          }

          .object-flow-meta {
            display: inline-flex;
            align-items: center;
            gap: 0.72rem;
            min-width: 0;
          }

          .object-flow-meta span {
            font-family: var(--font-mono);
            font-size: 0.7rem;
            color: #536271;
            white-space: nowrap;
          }

          .object-flow-meta a {
            color: #1f4b99;
            font-weight: 700;
            text-decoration: none;
            font-size: 0.82rem;
          }

          .object-flow-meta a:hover {
            color: #17202a;
            text-shadow: none;
          }

          .object-flow-ask-link {
            display: inline-flex;
            align-items: center;
          }

          .object-flow-chip-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 0.58rem;
            min-width: 0;
          }

          .object-flow-chip {
            display: grid;
            align-content: start;
            gap: 0.2rem;
            min-width: 0;
            min-height: 6.05rem;
            padding: 0.56rem 0.62rem;
            border-radius: 10px;
            border: 1px solid rgba(27, 36, 48, 0.1);
            background: rgba(255, 251, 245, 0.88);
            text-decoration: none;
            transition: border-color 0.18s ease, transform 0.18s ease;
          }

          .object-flow-chip:hover {
            border-color: rgba(31, 75, 153, 0.32);
            transform: translateY(-1px);
            text-shadow: none;
          }

          .object-flow-chip.active {
            border-color: rgba(31, 75, 153, 0.4);
            background: rgba(239, 247, 245, 0.84);
          }

          .object-flow-chip span {
            margin: 0;
            font-family: var(--font-mono);
            font-size: 0.66rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #5a6773;
          }

          .object-flow-chip strong {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
            font-size: 0.86rem;
            line-height: 1.35;
            color: #17202a;
            overflow-wrap: anywhere;
          }

          .object-flow-chip em {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
            font-style: normal;
            font-size: 0.73rem;
            line-height: 1.4;
            color: #52606b;
            overflow-wrap: anywhere;
          }

          .object-flow-selected-detail {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(13.5rem, 0.78fr);
            grid-template-areas:
              "main state"
              "bridge bridge"
              "saved saved"
              "actions actions";
            gap: 0.62rem;
            min-width: 0;
            padding: 0.72rem;
            border-radius: 10px;
            border: 1px solid rgba(31, 111, 120, 0.16);
            background: rgba(239, 247, 245, 0.78);
          }

          .object-flow-selected-main {
            grid-area: main;
            display: grid;
            gap: 0.2rem;
            min-width: 0;
          }

          .object-flow-selected-state {
            grid-area: state;
            display: grid;
            align-content: start;
            gap: 0.42rem;
            min-width: 0;
          }

          .object-flow-selected-type {
            font-family: var(--font-mono);
            font-size: 0.62rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #1f6f78;
          }

          .object-flow-selected-main > strong {
            color: #17202a;
            line-height: 1.28;
            overflow-wrap: anywhere;
          }

          .object-flow-selected-main > em {
            color: #52606b;
            font-size: 0.76rem;
            font-style: normal;
            line-height: 1.42;
            overflow-wrap: anywhere;
          }

          .object-flow-selected-detail code {
            display: block;
            min-width: 0;
            width: 100%;
            padding: 0.48rem 0.55rem;
            overflow-x: auto;
            border-radius: 8px;
            border: 1px solid rgba(27, 36, 48, 0.08);
            background: rgba(255, 251, 245, 0.82);
            color: #394653;
            font-size: 0.68rem;
            white-space: nowrap;
          }

          .object-flow-selected-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 0.38rem;
            min-width: 0;
          }

          .object-flow-selected-badges span {
            display: inline-flex;
            align-items: center;
            min-height: 1.65rem;
            padding: 0.24rem 0.42rem;
            border-radius: 999px;
            border: 1px solid rgba(27, 36, 48, 0.08);
            background: rgba(255, 251, 245, 0.86);
            color: #394653;
            font-size: 0.58rem;
            letter-spacing: 0.08em;
          }

          .object-flow-saved-action {
            grid-area: saved;
            display: grid;
            gap: 0.2rem;
            min-width: 0;
            padding: 0.58rem 0.64rem;
            border-radius: 9px;
            border: 1px solid rgba(194, 74, 45, 0.18);
            background:
              linear-gradient(180deg, rgba(255, 251, 245, 0.9), rgba(255, 244, 238, 0.78)),
              rgba(231, 248, 244, 0.34);
          }

          .object-flow-saved-action span {
            color: #c24a2d;
            font-family: var(--font-mono);
            font-size: 0.58rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
          }

          .object-flow-saved-action strong,
          .object-flow-saved-action em {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            overflow: hidden;
            overflow-wrap: anywhere;
          }

          .object-flow-saved-action strong {
            -webkit-line-clamp: 2;
            color: #17202a;
            line-height: 1.28;
          }

          .object-flow-saved-action em {
            -webkit-line-clamp: 2;
            color: #52606b;
            font-size: 0.74rem;
            font-style: normal;
            line-height: 1.34;
          }

          .object-flow-saved-action.resolved {
            border-color: rgba(31, 111, 120, 0.22);
            background:
              linear-gradient(180deg, rgba(247, 252, 250, 0.9), rgba(231, 248, 244, 0.78)),
              rgba(255, 251, 245, 0.34);
          }

          .object-flow-saved-action.resolved span {
            color: #1f6f78;
          }

          .object-flow-history-bridge {
            grid-area: bridge;
            display: grid;
            gap: 0.24rem;
            min-width: 0;
            padding: 0.62rem 0.68rem;
            border-radius: 9px;
            border: 1px solid rgba(31, 111, 120, 0.2);
            background:
              linear-gradient(90deg, rgba(31, 111, 120, 0.12), rgba(194, 74, 45, 0.1)),
              rgba(255, 251, 245, 0.88);
          }

          .object-flow-history-bridge span {
            color: #1f6f78;
            font-family: var(--font-mono);
            font-size: 0.58rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
          }

          .object-flow-history-bridge strong,
          .object-flow-history-bridge em,
          .object-flow-history-bridge small {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            overflow: hidden;
            overflow-wrap: anywhere;
          }

          .object-flow-history-bridge strong {
            -webkit-line-clamp: 2;
            color: #17202a;
            line-height: 1.28;
          }

          .object-flow-history-bridge em {
            -webkit-line-clamp: 4;
            color: #52606b;
            font-size: 0.74rem;
            font-style: normal;
            line-height: 1.34;
          }

          .object-flow-history-bridge small {
            -webkit-line-clamp: 2;
            color: #1f6f78;
            font-family: var(--font-mono);
            font-size: 0.66rem;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          .object-flow-history-links {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(7.8rem, 1fr));
            gap: 0.42rem;
            min-width: 0;
          }

          .object-flow-history-bridge a {
            display: inline-flex;
            justify-content: center;
            width: 100%;
            min-width: 0;
            min-height: 1.95rem;
            padding: 0.3rem 0.42rem;
            border-radius: 6px;
            background: rgba(255, 251, 245, 0.82);
            color: #1f4b99;
            font-weight: 700;
            font-size: 0.72rem;
            line-height: 1.12;
            text-align: center;
            text-decoration: none;
          }

          .object-flow-history-bridge a:hover {
            text-decoration: underline;
          }

          .object-flow-selected-actions {
            grid-area: actions;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.42rem;
            min-width: 0;
          }

          .object-flow-selected-actions a {
            display: grid;
            gap: 0.08rem;
            min-width: 0;
            min-height: 2.45rem;
            padding: 0.42rem 0.52rem;
            border-radius: 8px;
            border: 1px solid rgba(31, 75, 153, 0.13);
            background: rgba(255, 251, 245, 0.78);
            color: #1f4b99;
            text-decoration: none;
          }

          .object-flow-selected-actions a:hover {
            border-color: rgba(31, 75, 153, 0.34);
            color: #17202a;
            text-shadow: none;
          }

          .object-flow-selected-actions strong {
            color: inherit;
            font-size: 0.74rem;
            line-height: 1.1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .object-flow-selected-actions span {
            color: #52606b;
            font-size: 0.62rem;
            line-height: 1.18;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          :global(.concept-notebook-page .object-flow-bar) {
            position: sticky;
            top: 5.5rem;
            z-index: 8;
            display: grid;
            gap: 0.72rem;
            min-width: 0;
            max-height: 18rem;
            overflow-y: auto;
            overscroll-behavior: contain;
            scrollbar-gutter: stable;
            padding: 0.9rem;
            border-radius: 14px;
            border: 1px solid rgba(27, 36, 48, 0.12);
            background:
              linear-gradient(180deg, rgba(247, 242, 233, 0.94), rgba(247, 242, 233, 0.84)),
              rgba(255, 251, 245, 0.86);
            box-shadow: 0 14px 30px rgba(8, 16, 26, 0.08);
          }

          :global(.concept-notebook-page .object-flow-bar::-webkit-scrollbar) {
            width: 0.5rem;
          }

          :global(.concept-notebook-page .object-flow-bar::-webkit-scrollbar-thumb) {
            border-radius: 999px;
            background: rgba(31, 111, 120, 0.22);
          }

          :global(.concept-notebook-page .object-flow-header) {
            display: flex;
            flex-wrap: wrap;
            gap: 0.65rem;
            align-items: center;
            justify-content: space-between;
            min-width: 0;
          }

          :global(.concept-notebook-page .object-flow-header p) {
            margin: 0;
            font-family: var(--font-mono);
            font-size: 0.68rem;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #1f6f78;
          }

          :global(.concept-notebook-page .object-flow-meta) {
            display: inline-flex;
            align-items: center;
            gap: 0.72rem;
            min-width: 0;
          }

          :global(.concept-notebook-page .object-flow-meta span) {
            font-family: var(--font-mono);
            font-size: 0.7rem;
            color: #536271;
            white-space: nowrap;
          }

          :global(.concept-notebook-page .object-flow-meta a) {
            color: #1f4b99;
            font-weight: 700;
            text-decoration: none;
            font-size: 0.82rem;
          }

          :global(.concept-notebook-page .object-flow-meta a:hover) {
            color: #17202a;
            text-shadow: none;
          }

          :global(.concept-notebook-page .object-flow-ask-link) {
            display: inline-flex;
            align-items: center;
          }

          :global(.concept-notebook-page .object-flow-chip-row) {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 0.58rem;
            min-width: 0;
          }

          :global(.concept-notebook-page .object-flow-chip) {
            display: grid;
            align-content: start;
            gap: 0.2rem;
            min-width: 0;
            min-height: 6.05rem;
            padding: 0.56rem 0.62rem;
            border-radius: 10px;
            border: 1px solid rgba(27, 36, 48, 0.1);
            background: rgba(255, 251, 245, 0.88);
            text-decoration: none;
            transition: border-color 0.18s ease, transform 0.18s ease;
          }

          :global(.concept-notebook-page .object-flow-chip:hover) {
            border-color: rgba(31, 75, 153, 0.32);
            transform: translateY(-1px);
            text-shadow: none;
          }

          :global(.concept-notebook-page .object-flow-chip.active) {
            border-color: rgba(31, 75, 153, 0.4);
            background: rgba(239, 247, 245, 0.84);
          }

          :global(.concept-notebook-page .object-flow-chip span) {
            margin: 0;
            font-family: var(--font-mono);
            font-size: 0.66rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #5a6773;
          }

          :global(.concept-notebook-page .object-flow-chip strong) {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
            font-size: 0.86rem;
            line-height: 1.35;
            color: #17202a;
            overflow-wrap: anywhere;
          }

          :global(.concept-notebook-page .object-flow-chip em) {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
            font-style: normal;
            font-size: 0.73rem;
            line-height: 1.4;
            color: #52606b;
            overflow-wrap: anywhere;
          }

          :global(.concept-notebook-page .object-flow-selected-detail) {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(13.5rem, 0.78fr);
            grid-template-areas:
              "main state"
              "bridge bridge"
              "saved saved"
              "actions actions";
            gap: 0.62rem;
            min-width: 0;
            padding: 0.72rem;
            border-radius: 10px;
            border: 1px solid rgba(31, 111, 120, 0.16);
            background: rgba(239, 247, 245, 0.78);
          }

          :global(.concept-notebook-page .object-flow-selected-main) {
            grid-area: main;
            display: grid;
            gap: 0.2rem;
            min-width: 0;
          }

          :global(.concept-notebook-page .object-flow-selected-state) {
            grid-area: state;
            display: grid;
            align-content: start;
            gap: 0.42rem;
            min-width: 0;
          }

          :global(.concept-notebook-page .object-flow-selected-type) {
            font-family: var(--font-mono);
            font-size: 0.62rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #1f6f78;
          }

          :global(.concept-notebook-page .object-flow-selected-main > strong) {
            color: #17202a;
            line-height: 1.28;
            overflow-wrap: anywhere;
          }

          :global(.concept-notebook-page .object-flow-selected-main > em) {
            color: #52606b;
            font-size: 0.76rem;
            font-style: normal;
            line-height: 1.42;
            overflow-wrap: anywhere;
          }

          :global(.concept-notebook-page .object-flow-selected-detail code) {
            display: block;
            min-width: 0;
            width: 100%;
            padding: 0.48rem 0.55rem;
            overflow-x: auto;
            border-radius: 8px;
            border: 1px solid rgba(27, 36, 48, 0.08);
            background: rgba(255, 251, 245, 0.82);
            color: #394653;
            font-size: 0.68rem;
            white-space: nowrap;
          }

          :global(.concept-notebook-page .object-flow-selected-badges) {
            display: flex;
            flex-wrap: wrap;
            gap: 0.38rem;
            min-width: 0;
          }

          :global(.concept-notebook-page .object-flow-selected-badges span) {
            display: inline-flex;
            align-items: center;
            min-height: 1.65rem;
            padding: 0.24rem 0.42rem;
            border-radius: 999px;
            border: 1px solid rgba(27, 36, 48, 0.08);
            background: rgba(255, 251, 245, 0.86);
            color: #394653;
            font-size: 0.58rem;
            letter-spacing: 0.08em;
          }

          :global(.concept-notebook-page .object-flow-saved-action) {
            grid-area: saved;
            display: grid;
            gap: 0.2rem;
            min-width: 0;
            padding: 0.58rem 0.64rem;
            border-radius: 9px;
            border: 1px solid rgba(194, 74, 45, 0.18);
            background:
              linear-gradient(180deg, rgba(255, 251, 245, 0.9), rgba(255, 244, 238, 0.78)),
              rgba(231, 248, 244, 0.34);
          }

          :global(.concept-notebook-page .object-flow-saved-action span) {
            color: #c24a2d;
            font-family: var(--font-mono);
            font-size: 0.58rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
          }

          :global(.concept-notebook-page .object-flow-saved-action strong),
          :global(.concept-notebook-page .object-flow-saved-action em) {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            overflow: hidden;
            overflow-wrap: anywhere;
          }

          :global(.concept-notebook-page .object-flow-saved-action strong) {
            -webkit-line-clamp: 2;
            color: #17202a;
            line-height: 1.28;
          }

          :global(.concept-notebook-page .object-flow-saved-action em) {
            -webkit-line-clamp: 2;
            color: #52606b;
            font-size: 0.74rem;
            font-style: normal;
            line-height: 1.34;
          }

          :global(.concept-notebook-page .object-flow-saved-action.resolved) {
            border-color: rgba(31, 111, 120, 0.22);
            background:
              linear-gradient(180deg, rgba(247, 252, 250, 0.9), rgba(231, 248, 244, 0.78)),
              rgba(255, 251, 245, 0.34);
          }

          :global(.concept-notebook-page .object-flow-saved-action.resolved span) {
            color: #1f6f78;
          }

          :global(.concept-notebook-page .object-flow-history-bridge) {
            grid-area: bridge;
            display: grid;
            gap: 0.24rem;
            min-width: 0;
            padding: 0.62rem 0.68rem;
            border-radius: 9px;
            border: 1px solid rgba(31, 111, 120, 0.2);
            background:
              linear-gradient(90deg, rgba(31, 111, 120, 0.12), rgba(194, 74, 45, 0.1)),
              rgba(255, 251, 245, 0.88);
          }

          :global(.concept-notebook-page .object-flow-history-bridge span) {
            color: #1f6f78;
            font-family: var(--font-mono);
            font-size: 0.58rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
          }

          :global(.concept-notebook-page .object-flow-history-bridge strong),
          :global(.concept-notebook-page .object-flow-history-bridge em),
          :global(.concept-notebook-page .object-flow-history-bridge small) {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            overflow: hidden;
            overflow-wrap: anywhere;
          }

          :global(.concept-notebook-page .object-flow-history-bridge strong) {
            -webkit-line-clamp: 2;
            color: #17202a;
            line-height: 1.28;
          }

          :global(.concept-notebook-page .object-flow-history-bridge em) {
            -webkit-line-clamp: 4;
            color: #52606b;
            font-size: 0.74rem;
            font-style: normal;
            line-height: 1.34;
          }

          :global(.concept-notebook-page .object-flow-history-bridge small) {
            -webkit-line-clamp: 2;
            color: #1f6f78;
            font-family: var(--font-mono);
            font-size: 0.66rem;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          :global(.concept-notebook-page .object-flow-history-links) {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(7.8rem, 1fr));
            gap: 0.42rem;
            min-width: 0;
          }

          :global(.concept-notebook-page .object-flow-history-bridge a) {
            display: inline-flex;
            justify-content: center;
            width: 100%;
            min-width: 0;
            min-height: 1.95rem;
            padding: 0.3rem 0.42rem;
            border-radius: 6px;
            background: rgba(255, 251, 245, 0.82);
            color: #1f4b99;
            font-weight: 700;
            font-size: 0.72rem;
            line-height: 1.12;
            text-align: center;
            text-decoration: none;
          }

          :global(.concept-notebook-page .object-flow-history-bridge a:hover) {
            text-decoration: underline;
          }

          :global(.concept-notebook-page .object-flow-selected-actions) {
            grid-area: actions;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.42rem;
            min-width: 0;
            width: 100%;
            max-width: 100%;
            overflow: hidden;
            box-sizing: border-box;
          }

          :global(.concept-notebook-page .object-flow-selected-actions a) {
            display: grid;
            gap: 0.08rem;
            min-width: 0;
            max-width: 100%;
            overflow: hidden;
            box-sizing: border-box;
            min-height: 2.45rem;
            padding: 0.42rem 0.52rem;
            border-radius: 8px;
            border: 1px solid rgba(31, 75, 153, 0.13);
            background: rgba(255, 251, 245, 0.78);
            color: #1f4b99;
            text-decoration: none;
          }

          :global(.concept-notebook-page .object-flow-selected-actions a:hover) {
            border-color: rgba(31, 75, 153, 0.34);
            color: #17202a;
            text-shadow: none;
          }

          :global(.concept-notebook-page .object-flow-selected-actions strong) {
            color: inherit;
            font-size: 0.74rem;
            line-height: 1.1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          :global(.concept-notebook-page .object-flow-selected-actions span) {
            color: #52606b;
            font-size: 0.62rem;
            line-height: 1.18;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .research-room-drawer-shell {
            display: grid;
            gap: 0.65rem;
            min-width: 0;
            scroll-margin-top: 6rem;
          }

          .research-room-drawer-topline {
            display: none;
          }

          .research-drawer-context-strip {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 0.65rem;
            align-items: center;
            min-width: 0;
            padding: 0.72rem;
            border-radius: 14px;
            border: 1px solid rgba(31, 111, 120, 0.16);
            background: rgba(239, 247, 245, 0.78);
          }

          .research-drawer-context-strip > div {
            display: grid;
            gap: 0.2rem;
            min-width: 0;
          }

          .research-drawer-context-strip span {
            font-family: var(--font-mono);
            font-size: 0.62rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #1f6f78;
          }

          .research-drawer-context-strip strong {
            color: #17202a;
            line-height: 1.24;
            overflow-wrap: anywhere;
          }

          .research-drawer-context-strip em {
            color: #52606b;
            font-size: 0.76rem;
            font-style: normal;
            line-height: 1.35;
            overflow-wrap: anywhere;
          }

          .research-drawer-context-strip nav {
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-end;
            gap: 0.42rem;
            min-width: 0;
          }

          .research-drawer-context-strip a {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 0;
            max-width: 100%;
            min-height: 2.1rem;
            overflow: hidden;
            padding: 0.38rem 0.56rem;
            border-radius: 8px;
            border: 1px solid rgba(31, 75, 153, 0.14);
            background: rgba(255, 251, 245, 0.78);
            color: #1f4b99;
            font-size: 0.72rem;
            font-weight: 760;
            text-decoration: none;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .research-drawer-context-strip a:hover {
            border-color: rgba(31, 75, 153, 0.34);
            color: #17202a;
            text-shadow: none;
          }

          .research-drawer-proximity-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.58rem;
            min-width: 0;
          }

          .research-drawer-proximity-grid a,
          .research-drawer-proximity-grid div {
            display: grid;
            gap: 0.24rem;
            min-width: 0;
            padding: 0.68rem;
            border-radius: 12px;
            border: 1px solid rgba(27, 36, 48, 0.08);
            background: rgba(255, 251, 245, 0.84);
            color: #17202a;
            text-decoration: none;
          }

          .research-drawer-proximity-grid a:hover {
            border-color: rgba(31, 75, 153, 0.28);
            text-shadow: none;
          }

          .research-drawer-proximity-grid span {
            font-family: var(--font-mono);
            font-size: 0.6rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #c24a2d;
          }

          .research-drawer-proximity-grid strong {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
            color: #17202a;
            font-size: 0.86rem;
            line-height: 1.25;
          }

          .research-drawer-proximity-grid em {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
            color: #52606b;
            font-size: 0.72rem;
            font-style: normal;
            line-height: 1.35;
          }

          .deepening-intro {
            display: grid;
            grid-template-columns: minmax(0, 0.78fr) minmax(0, 1fr);
            gap: 1rem;
            align-items: center;
            min-width: 0;
            padding: 1.05rem;
            border-radius: 22px;
            border: 1px solid rgba(27, 36, 48, 0.08);
            background:
              linear-gradient(135deg, rgba(239, 247, 245, 0.88), rgba(255, 251, 245, 0.82)),
              rgba(255, 251, 245, 0.86);
          }

          .deepening-intro p {
            margin: 0;
            color: #52606b;
            line-height: 1.62;
            overflow-wrap: anywhere;
          }

          .deepening-intro > div p {
            margin: 0 0 0.4rem;
            font-family: var(--font-mono);
            font-size: 0.68rem;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #1f6f78;
          }

          .deepening-intro h2 {
            margin: 0;
            font-family: var(--font-display);
            font-size: clamp(1.35rem, 2.4vw, 1.9rem);
            line-height: 1.05;
            color: #17202a;
            letter-spacing: 0;
            overflow-wrap: anywhere;
          }

          .section-strip :global(.section-strip-card) {
            display: block;
            padding: 1rem;
            border-radius: 20px;
            border: 1px solid rgba(27, 36, 48, 0.08);
            background: rgba(255, 251, 245, 0.78);
            color: #1b2430;
            text-decoration: none;
            min-width: 0;
          }

          .section-strip :global(.section-strip-card:hover) {
            transform: translateY(-2px);
            text-shadow: none;
          }

          .section-strip :global(.section-strip-card.pending) {
            opacity: 0.72;
          }

          .section-strip-step {
            display: block;
            margin-bottom: 0.35rem;
            font-family: var(--font-mono);
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #5d6975;
          }

          .section-strip :global(.section-strip-card) strong {
            display: block;
            font-size: 1rem;
            color: #17202a;
            overflow-wrap: anywhere;
          }

          .section-strip-summary {
            display: block;
            margin-top: 0.45rem;
            color: #52606b;
            line-height: 1.5;
            font-size: 0.9rem;
            overflow-wrap: anywhere;
          }

          .demo-placeholder {
            padding: 1rem 1.1rem;
            border-radius: 18px;
            border: 1px dashed rgba(27, 36, 48, 0.16);
            background: rgba(255, 251, 245, 0.72);
            color: #52606b;
          }

          .demo-placeholder p {
            margin: 0;
            line-height: 1.7;
          }

          .demo-placeholder p + p {
            margin-top: 0.65rem;
          }

          .pager {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 1rem;
            min-width: 0;
          }

          .pager :global(.pager-link) {
            display: block;
            padding: 1rem;
            border-radius: 20px;
            border: 1px solid rgba(27, 36, 48, 0.08);
            background: rgba(255, 251, 245, 0.9);
            color: #17202a;
            text-decoration: none;
            min-width: 0;
          }

          .pager :global(.pager-link:hover) {
            border-color: rgba(31, 75, 153, 0.3);
            text-shadow: none;
          }

          .pager :global(.align-right) {
            text-align: right;
          }

          .pager-kicker {
            display: block;
            font-family: var(--font-mono);
            font-size: 0.68rem;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #5a6874;
          }

          .pager-title {
            display: block;
            margin-top: 0.4rem;
            color: #17202a;
            font-family: var(--font-display);
            font-size: 1.1rem;
            line-height: 1.12;
            overflow-wrap: anywhere;
          }

          @media (max-width: 900px) {
            .continuity-grid,
            .section-strip,
            .object-flow-chip-row,
            .deepening-intro {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .learning-studio-panel {
              grid-template-columns: 1fr;
            }

            .learning-studio-loop {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            .continuity-try {
              grid-template-columns: 1fr;
            }

            .object-flow-bar {
              max-height: min(48vh, 24rem);
              overflow-y: auto;
              overscroll-behavior: contain;
            }

            :global(.concept-notebook-page .object-flow-bar) {
              max-height: min(48vh, 24rem);
              overflow-y: auto;
              overscroll-behavior: contain;
            }

            .object-flow-selected-detail {
              grid-template-columns: 1fr;
              grid-template-areas:
                "main"
                "state"
                "bridge"
                "saved"
                "actions";
            }

            :global(.concept-notebook-page .object-flow-selected-detail) {
              display: grid;
              grid-template-columns: 1fr;
              grid-template-areas:
                "main"
                "state"
                "bridge"
                "saved"
                "actions";
            }

            :global(.concept-notebook-page .object-flow-selected-main) {
              grid-area: main;
              min-width: 0;
            }

            :global(.concept-notebook-page .object-flow-selected-state) {
              grid-area: state;
              min-width: 0;
            }

            .object-flow-selected-actions {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            :global(.concept-notebook-page .object-flow-selected-actions) {
              grid-area: actions;
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 0.42rem;
              min-width: 0;
              width: 100%;
              max-width: 100%;
              overflow: hidden;
              box-sizing: border-box;
            }

            :global(.concept-notebook-page .object-flow-selected-actions a) {
              display: grid;
              min-width: 0;
              max-width: 100%;
              overflow: hidden;
              box-sizing: border-box;
            }

            :global(.concept-notebook-page .object-flow-selected-actions strong),
            :global(.concept-notebook-page .object-flow-selected-actions span) {
              display: block;
              min-width: 0;
              max-width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .object-flow-meta {
              width: 100%;
              justify-content: space-between;
            }

            :global(.concept-notebook-page .object-flow-meta) {
              width: 100%;
              justify-content: space-between;
            }

            .research-drawer-context-strip {
              grid-template-columns: 1fr;
              align-items: stretch;
            }

            .research-drawer-context-strip nav {
              justify-content: stretch;
            }

            .research-drawer-context-strip a {
              flex: 1 1 11rem;
            }

            .research-drawer-proximity-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 0.42rem;
            }

            .research-drawer-proximity-grid div {
              grid-column: 1 / -1;
            }

            .research-drawer-proximity-grid a,
            .research-drawer-proximity-grid div {
              padding: 0.58rem;
            }

            .research-room-drawer-shell:target {
              position: fixed;
              left: 0.65rem;
              right: 0.65rem;
              bottom: 0.65rem;
              z-index: 60;
              max-height: min(78vh, 44rem);
              overflow-y: auto;
              overscroll-behavior: contain;
              padding: 0.55rem;
              border-radius: 22px;
              border: 1px solid rgba(27, 36, 48, 0.18);
              background:
                linear-gradient(180deg, rgba(247, 242, 233, 0.98), rgba(239, 247, 245, 0.98)),
                rgba(255, 251, 245, 0.98);
              box-shadow: 0 28px 70px rgba(8, 16, 26, 0.36);
            }

            .research-room-drawer-shell:target .research-room-drawer-topline {
              position: sticky;
              top: -0.55rem;
              z-index: 2;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 0.65rem;
              min-width: 0;
              padding: 0.54rem 0.62rem;
              border-radius: 16px;
              border: 1px solid rgba(27, 36, 48, 0.1);
              background: rgba(255, 251, 245, 0.96);
            }

            .research-room-drawer-topline span {
              font-family: var(--font-mono);
              font-size: 0.62rem;
              letter-spacing: 0.1em;
              text-transform: uppercase;
              color: #1f6f78;
            }

            .research-room-drawer-topline a {
              color: #1f4b99;
              font-size: 0.72rem;
              font-weight: 780;
              text-decoration: none;
            }

            .research-room-drawer-shell:target :global(.research-reading-room.compact) {
              padding: 0.72rem;
              border-radius: 16px;
              box-shadow: none;
            }

            .research-room-drawer-shell:target :global(.room-heading) {
              gap: 0.2rem;
            }

            .research-room-drawer-shell:target :global(.room-heading span) {
              display: none;
            }

            .research-room-drawer-shell:target :global(.room-state-strip) {
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 0.42rem;
            }

            .research-room-drawer-shell:target :global(.room-state-card) {
              padding: 0.52rem;
              border-radius: 12px;
            }

            .research-room-drawer-shell:target :global(.room-detail) {
              gap: 0.52rem;
              padding: 0.62rem;
              border-radius: 14px;
            }

            .research-room-drawer-shell:target :global(.object-meta) {
              order: -3;
            }

            .research-room-drawer-shell:target :global(.room-detail h4) {
              order: -2;
            }

            .research-room-drawer-shell:target :global(.carried-observation) {
              order: -1;
              padding: 0.58rem;
              border-radius: 12px;
            }

            .research-room-drawer-shell:target :global(.compact-draft) {
              padding: 0.58rem;
              border-radius: 12px;
            }

            .research-room-drawer-shell:target :global(.room-columns section),
            .research-room-drawer-shell:target :global(.prompt-block) {
              padding: 0.58rem;
              border-radius: 12px;
            }

            .research-room-drawer-shell:target :global(.room-layout) {
              display: flex;
              flex-direction: column;
            }

            .research-room-drawer-shell:target :global(.room-detail) {
              order: 1;
            }

            .research-room-drawer-shell:target :global(.object-rail) {
              order: 2;
              display: flex;
              gap: 0.5rem;
              overflow-x: auto;
              padding-bottom: 0.08rem;
              scroll-snap-type: x proximity;
            }

            .research-room-drawer-shell:target :global(.object-rail button) {
              flex: 0 0 min(17rem, 78vw);
              min-height: 5.2rem;
              scroll-snap-align: start;
            }
          }

          @media (max-width: 640px) {
            :global(.app-root.editorial-surface .app-main-inner > .concept-notebook-page) {
              padding: 0 !important;
              border: 0 !important;
              border-radius: 0 !important;
              background: transparent !important;
              box-shadow: none !important;
              overflow: hidden !important;
            }

            :global(.concept-notebook-page .notebook-page) {
              width: 100%;
              max-width: 100%;
              overflow: hidden !important;
            }

            :global(.concept-notebook-page .notebook-hero) {
              min-height: 0;
              gap: 0.55rem;
              margin-bottom: 0.55rem;
            }

            :global(.concept-notebook-page .hero-visual) {
              display: none;
            }

            :global(.concept-notebook-page .notebook-page .hero-copy) {
              padding: 0.5rem 0 0.05rem;
            }

            :global(.concept-notebook-page .notebook-page .breadcrumbs) {
              display: none;
            }

            :global(.concept-notebook-page .notebook-page .hero-copy .eyebrow) {
              margin-bottom: 0.32rem;
              font-size: 0.62rem;
            }

            :global(.concept-notebook-page .notebook-page .hero-copy h1) {
              max-width: 100%;
              font-size: clamp(1.24rem, 6vw, 1.5rem);
              line-height: 1.08;
              overflow-wrap: anywhere;
              text-wrap: wrap;
            }

            :global(.concept-notebook-page .notebook-page.long-title .hero-copy h1) {
              font-size: clamp(1.08rem, 5.35vw, 1.34rem);
            }

            :global(.concept-notebook-page .notebook-page .hero-copy .lede) {
              display: -webkit-box;
              -webkit-box-orient: vertical;
              -webkit-line-clamp: 2;
              margin-top: 0.35rem;
              overflow: hidden;
              font-size: 0.8rem;
              line-height: 1.35;
            }

            :global(.concept-notebook-page .notebook-page .hero-copy .meta-row) {
              display: none !important;
              grid-template-columns: none;
              flex-wrap: nowrap;
              overflow-x: auto;
              margin-top: 0.45rem;
              gap: 0.36rem;
              padding-bottom: 0.05rem;
            }

            :global(.concept-notebook-page .notebook-page .hero-copy .meta-chip) {
              flex: 0 0 auto;
              width: auto;
              min-height: 25px;
              padding: 0.28rem 0.38rem;
              font-size: 0.61rem;
              white-space: nowrap;
            }

            :global(.concept-notebook-page .notebook-page .hero-copy .action-row) {
              display: grid !important;
              grid-template-columns: 1fr;
              overflow-x: visible;
              margin-top: 0.45rem;
              gap: 0.4rem;
            }

            :global(.concept-notebook-page .notebook-page .hero-copy .action-row .cta) {
              width: 100%;
              max-width: 100%;
              min-height: 31px;
              padding: 0.36rem 0.56rem;
              overflow: visible;
              text-overflow: clip;
              white-space: normal;
              font-size: 0.68rem;
              line-height: 1.15;
              box-shadow: none;
            }

            :global(.concept-notebook-page .notebook-page .notebook-body) {
              gap: 0.65rem;
            }

            :global(.concept-notebook-page .notebook-page .body-main) {
              padding: 0.72rem;
            }

            .mobile-learning-map {
              order: -4;
              display: grid;
              gap: 0.45rem;
              padding: 0.58rem;
              border-radius: 14px;
              border: 1px solid rgba(31, 111, 120, 0.16);
              background: rgba(239, 247, 245, 0.82);
            }

            .mobile-learning-map > div:first-child {
              display: none;
            }

            .mobile-learning-map p {
              margin: 0 0 0.28rem;
              font-family: var(--font-mono);
              font-size: 0.62rem;
              letter-spacing: 0.12em;
              text-transform: uppercase;
              color: #1f6f78;
            }

            .mobile-learning-map strong {
              display: block;
              color: #17202a;
              line-height: 1.2;
              overflow-wrap: anywhere;
            }

            .mobile-learning-map-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 0.45rem;
              overflow-x: visible;
              padding-bottom: 0.04rem;
            }

            .mobile-learning-map-grid span {
              display: grid;
              gap: 0.18rem;
              min-width: 0;
              padding: 0.44rem;
              border-radius: 10px;
              border: 1px solid rgba(27, 36, 48, 0.08);
              background: rgba(255, 251, 245, 0.84);
            }

            .mobile-learning-map-grid em {
              color: #c24a2d;
              font-family: var(--font-mono);
              font-size: 0.58rem;
              font-style: normal;
              letter-spacing: 0.1em;
              text-transform: uppercase;
            }

            .mobile-learning-map-grid b {
              color: #1f2a36;
              font-size: 0.74rem;
              line-height: 1.25;
              overflow-wrap: anywhere;
            }

            .object-route-state {
              order: -2;
            }

            .learning-studio-panel {
              order: -1;
              gap: 0.55rem;
              padding: 0.58rem;
              border-radius: 14px;
              box-shadow: none;
            }

            .learning-studio-current {
              gap: 0.4rem;
              padding: 0.62rem;
              border-radius: 12px;
            }

            .learning-studio-current-topline b {
              min-height: 1.45rem;
              max-width: 48%;
              padding: 0.22rem 0.42rem;
              font-size: 0.6rem;
            }

            .learning-studio-current h2 {
              font-size: 1.02rem;
              line-height: 1.08;
            }

            .learning-studio-current p {
              -webkit-line-clamp: 3;
              font-size: 0.74rem;
              line-height: 1.32;
            }

            .learning-studio-current span,
            .learning-studio-lens-card span,
            .learning-studio-heading p,
            .learning-studio-move span {
              font-size: 0.54rem;
            }

            .learning-studio-lens-card {
              gap: 0.34rem;
              padding: 0.52rem;
              border-radius: 10px;
              border-left-width: 3px;
            }

            .learning-studio-lens-card strong {
              font-size: 0.78rem;
              line-height: 1.2;
            }

            .learning-studio-lens-card p {
              display: -webkit-box;
              -webkit-box-orient: vertical;
              -webkit-line-clamp: 2;
              overflow: hidden;
              font-size: 0.65rem;
              line-height: 1.28;
            }

            .learning-studio-lens-card a {
              width: 100%;
              min-height: 2.75rem;
              padding: 0.32rem 0.48rem;
              font-size: 0.66rem;
            }

            .learning-studio-actions {
              gap: 0.34rem;
            }

            .learning-studio-actions a {
              min-height: 2.75rem;
              padding: 0.3rem 0.4rem;
              font-size: 0.68rem;
            }

            .learning-studio-heading {
              align-items: start;
            }

            .learning-studio-heading strong {
              font-size: 0.82rem;
              text-align: right;
            }

            .learning-studio-mode-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 0.42rem;
              overflow: visible;
              padding-bottom: 0;
            }

            .learning-studio-mode {
              min-height: 4.65rem;
              padding: 0.52rem;
              grid-template-columns: 1fr;
              gap: 0.18rem;
            }

            .learning-studio-mode span {
              width: 1rem;
              height: 1rem;
              grid-row: auto;
            }

            .learning-studio-mode strong {
              font-size: 0.8rem;
              line-height: 1.05;
            }

            .learning-studio-mode p {
              font-size: 0.62rem;
              line-height: 1.24;
            }

            .learning-studio-mode em {
              grid-column: auto;
              font-size: 0.52rem;
              letter-spacing: 0.05em;
            }

            .learning-studio-loop {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 0.42rem;
              overflow: visible;
              padding-bottom: 0;
            }

            .learning-studio-move {
              min-height: 4.4rem;
              padding: 0.52rem;
            }

            .learning-studio-move em {
              display: -webkit-box;
              -webkit-box-orient: vertical;
              -webkit-line-clamp: 2;
              overflow: hidden;
              font-size: 0.64rem;
            }

            .object-route-state:empty {
              display: none;
            }

            :global(.concept-notebook-page .object-route-state .continuity-banner.compact) {
              gap: 0.5rem;
              padding: 0.62rem;
              border-radius: 14px;
            }

            :global(.concept-notebook-page .object-route-state .continuity-copy .eyebrow) {
              margin-bottom: 0.25rem;
              font-size: 0.6rem;
            }

            :global(.concept-notebook-page .object-route-state .continuity-copy h3) {
              font-size: 0.98rem;
              line-height: 1.12;
            }

            :global(.concept-notebook-page .object-route-state .continuity-copy p),
            :global(.concept-notebook-page .object-route-state .continuity-copy small) {
              display: none;
            }

            :global(.concept-notebook-page .object-route-state .continuity-facts) {
              gap: 0.38rem;
            }

            :global(.concept-notebook-page .object-route-state .continuity-facts article) {
              min-height: 0;
              padding: 0.5rem;
              border-radius: 10px;
              gap: 0.16rem;
            }

            :global(.concept-notebook-page .object-route-state .continuity-facts span) {
              font-size: 0.55rem;
            }

            :global(.concept-notebook-page .object-route-state .continuity-facts strong) {
              font-size: 0.78rem;
              line-height: 1.24;
            }

            :global(.concept-notebook-page .object-route-state .continuity-facts em) {
              display: -webkit-box;
              -webkit-box-orient: vertical;
              -webkit-line-clamp: 1;
              overflow: hidden;
              font-size: 0.68rem;
            }

            :global(.concept-notebook-page .object-route-state .continuity-actions) {
              display: flex;
              flex-wrap: nowrap;
              overflow-x: auto;
              gap: 0.4rem;
            }

            :global(.concept-notebook-page .object-route-state .continuity-actions a),
            :global(.concept-notebook-page .object-route-state .continuity-actions button) {
              flex: 0 0 auto;
              width: auto;
              min-height: 31px;
              padding: 0.34rem 0.5rem;
              font-size: 0.68rem;
            }

            .continuity-grid,
            .section-strip,
            .deepening-intro,
            .pager {
              grid-template-columns: 1fr;
            }

            .section-strip {
              order: 0;
            }

            .object-flow-bar {
              order: -3;
              top: 0.35rem;
              max-height: 14rem;
              overflow-y: auto;
              overscroll-behavior: contain;
              padding: 0.72rem;
              gap: 0.5rem;
            }

            :global(.concept-notebook-page .object-flow-bar) {
              order: -3;
              top: 0.35rem;
              max-height: 14rem;
              overflow-y: auto;
              overscroll-behavior: contain;
              padding: 0.72rem;
              gap: 0.5rem;
            }

            :global(.concept-notebook-page .object-flow-header) {
              display: flex;
              align-items: center;
              justify-content: space-between;
              flex-wrap: nowrap;
              gap: 0.35rem;
            }

            :global(.concept-notebook-page .object-flow-header p) {
              font-size: 0.58rem;
            }

            :global(.concept-notebook-page .object-flow-chip-row) {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 0.45rem;
              overflow-x: visible;
              padding-bottom: 0;
              scroll-snap-type: none;
            }

            .object-flow-chip-row {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 0.45rem;
              overflow-x: visible;
              padding-bottom: 0;
              scroll-snap-type: none;
            }

            :global(.concept-notebook-page .object-flow-chip) {
              flex: none;
              min-width: 0;
              min-height: 3.45rem;
              padding: 0.42rem 0.5rem;
              scroll-snap-align: none;
            }

            .object-flow-chip {
              flex: none;
              min-width: 0;
              min-height: 3.45rem;
              padding: 0.42rem 0.5rem;
              scroll-snap-align: none;
            }

            :global(.concept-notebook-page .object-flow-chip span) {
              font-size: 0.56rem;
            }

            :global(.concept-notebook-page .object-flow-chip strong),
            :global(.concept-notebook-page .object-flow-chip em) {
              display: -webkit-box;
              -webkit-box-orient: vertical;
              -webkit-line-clamp: 1;
              overflow: hidden;
            }

            :global(.concept-notebook-page .object-flow-chip strong) {
              font-size: 0.76rem;
              line-height: 1.22;
            }

            :global(.concept-notebook-page .object-flow-chip em) {
              font-size: 0.64rem;
              line-height: 1.22;
            }

            :global(.concept-notebook-page .object-flow-selected-detail) {
              grid-template-columns: 1fr;
              grid-template-areas:
                "main"
                "state"
                "bridge"
                "saved"
                "actions";
              padding: 0.56rem;
              gap: 0.42rem;
            }

            :global(.concept-notebook-page .object-flow-selected-main > strong) {
              font-size: 0.84rem;
            }

            :global(.concept-notebook-page .object-flow-selected-main > em) {
              display: -webkit-box;
              -webkit-box-orient: vertical;
              -webkit-line-clamp: 2;
              overflow: hidden;
              font-size: 0.7rem;
            }

            :global(.concept-notebook-page .object-flow-selected-badges) {
              flex-wrap: nowrap;
              overflow-x: auto;
            }

            :global(.concept-notebook-page .object-flow-selected-badges span) {
              flex: 0 0 auto;
              min-height: 1.42rem;
              padding: 0.18rem 0.36rem;
              font-size: 0.52rem;
            }

            :global(.concept-notebook-page .object-flow-selected-detail code) {
              padding: 0.36rem 0.44rem;
              font-size: 0.62rem;
            }

            :global(.concept-notebook-page .object-flow-selected-actions) {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 0.34rem;
              min-width: 0;
              width: 100%;
              max-width: 100%;
              overflow: hidden;
              box-sizing: border-box;
            }

            :global(.concept-notebook-page .object-flow-selected-actions a) {
              display: grid;
              min-width: 0;
              max-width: 100%;
              overflow: hidden;
              box-sizing: border-box;
              min-height: 2.2rem;
              padding: 0.34rem 0.42rem;
            }

            :global(.concept-notebook-page .object-flow-selected-actions strong) {
              font-size: 0.68rem;
            }

            :global(.concept-notebook-page .object-flow-selected-actions span) {
              font-size: 0.56rem;
            }

            :global(.concept-notebook-page #intuition),
            :global(.concept-notebook-page #math),
            :global(.concept-notebook-page #code),
            :global(.concept-notebook-page #interactive-demo),
            :global(.concept-notebook-page #research-reading-room-workspace),
            :global(.concept-notebook-page [id^='math-object-']),
            :global(.concept-notebook-page [id^='code-witness-']),
            :global(.concept-notebook-page [id^='claim-check-']),
            :global(.concept-notebook-page [id^='source-']) {
              scroll-margin-top: 11rem;
            }

            .object-flow-meta {
              width: auto;
              justify-content: space-between;
              flex-wrap: nowrap;
              gap: 0.42rem;
            }

            :global(.concept-notebook-page .object-flow-meta) {
              display: inline-flex;
              align-items: center;
              width: auto;
              justify-content: flex-end;
              flex-wrap: nowrap;
              gap: 0.42rem;
            }

            :global(.concept-notebook-page .object-flow-meta span) {
              font-size: 0.58rem;
            }

            .object-flow-ask-link {
              display: inline-flex;
              font-size: 0.7rem;
            }

            :global(.concept-notebook-page .object-flow-ask-link) {
              display: inline-flex;
              align-items: center;
              font-size: 0.7rem;
            }

            .object-flow-research-link {
              display: none;
            }

            :global(.concept-notebook-page .object-flow-research-link) {
              display: none;
            }

            :global(.concept-notebook-page .object-flow-selected-detail) {
              display: grid;
              grid-template-columns: 1fr;
              grid-template-areas:
                "main"
                "state"
                "bridge"
                "saved"
                "actions";
              padding: 0.48rem;
              gap: 0.32rem;
            }

            :global(.concept-notebook-page .object-flow-selected-main) {
              display: grid;
              gap: 0.12rem;
            }

            :global(.concept-notebook-page .object-flow-selected-type) {
              font-size: 0.52rem;
            }

            :global(.concept-notebook-page .object-flow-selected-main > strong) {
              display: -webkit-box;
              -webkit-box-orient: vertical;
              -webkit-line-clamp: 1;
              overflow: hidden;
              font-size: 0.78rem;
            }

            :global(.concept-notebook-page .object-flow-selected-main > em) {
              display: -webkit-box;
              -webkit-box-orient: vertical;
              -webkit-line-clamp: 1;
              overflow: hidden;
              font-size: 0.66rem;
            }

            :global(.concept-notebook-page .object-flow-selected-badges) {
              display: flex;
              flex-wrap: nowrap;
              gap: 0.32rem;
              overflow-x: auto;
            }

            :global(.concept-notebook-page .object-flow-selected-badges span) {
              flex: 0 0 auto;
              min-height: 1.35rem;
              padding: 0.16rem 0.34rem;
              font-size: 0.5rem;
            }

            :global(.concept-notebook-page .object-flow-selected-detail code) {
              display: block;
              padding: 0.3rem 0.4rem;
              overflow-x: auto;
              font-size: 0.58rem;
              white-space: nowrap;
            }

            :global(.concept-notebook-page .object-flow-selected-actions) {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 0.3rem;
              min-width: 0;
              width: 100%;
              max-width: 100%;
              overflow: hidden;
              box-sizing: border-box;
            }

            :global(.concept-notebook-page .object-flow-selected-actions a) {
              display: grid;
              min-width: 0;
              max-width: 100%;
              overflow: hidden;
              box-sizing: border-box;
              min-height: 2.05rem;
              padding: 0.3rem 0.36rem;
            }

            :global(.concept-notebook-page .object-flow-selected-actions strong) {
              font-size: 0.64rem;
            }

            :global(.concept-notebook-page .object-flow-selected-actions span) {
              font-size: 0.52rem;
            }

            .research-room-drawer-shell:target {
              left: 0.42rem;
              right: 0.42rem;
              bottom: 0.42rem;
              max-height: min(82vh, 43rem);
              padding: 0.42rem;
              border-radius: 18px;
            }

            .research-room-drawer-shell:target .research-room-drawer-topline {
              padding: 0.46rem 0.52rem;
              border-radius: 14px;
            }

            .research-drawer-context-strip {
              gap: 0.42rem;
              padding: 0.52rem;
              border-radius: 13px;
            }

            .research-drawer-context-strip nav {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .research-drawer-context-strip a {
              width: 100%;
              min-height: 2rem;
              padding: 0.34rem 0.44rem;
              font-size: 0.66rem;
            }

            .research-drawer-proximity-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 0.36rem;
            }

            .research-drawer-proximity-grid div {
              grid-column: 1 / -1;
            }

            .research-drawer-proximity-grid a,
            .research-drawer-proximity-grid div {
              gap: 0.18rem;
              padding: 0.5rem;
            }

            .research-drawer-proximity-grid span {
              font-size: 0.54rem;
            }

            .research-drawer-proximity-grid strong {
              -webkit-line-clamp: 1;
              font-size: 0.76rem;
            }

            .research-drawer-proximity-grid em {
              -webkit-line-clamp: 1;
              font-size: 0.64rem;
            }

            .research-room-drawer-shell:target :global(.research-reading-room.compact) {
              gap: 0.48rem;
              padding: 0.56rem;
            }

            .research-room-drawer-shell:target :global(.room-heading h3) {
              font-size: 1rem;
              line-height: 1.12;
            }

            .research-room-drawer-shell:target :global(.room-state-strip) {
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 0.34rem;
            }

            .research-room-drawer-shell:target :global(.room-state-card) {
              gap: 0.16rem;
              padding: 0.42rem;
            }

            .research-room-drawer-shell:target :global(.room-state-card span),
            .research-room-drawer-shell:target :global(.room-state-card p),
            .research-room-drawer-shell:target :global(.room-state-card em) {
              font-size: 0.64rem;
            }

            .research-room-drawer-shell:target :global(.room-state-card strong) {
              -webkit-line-clamp: 1;
              font-size: 0.72rem;
            }

            .research-room-drawer-shell:target :global(.room-detail) {
              gap: 0.42rem;
              padding: 0.5rem;
            }

            .research-room-drawer-shell:target :global(.question-block p),
            .research-room-drawer-shell:target :global(.carried-observation p),
            .research-room-drawer-shell:target :global(.local-action-draft p),
            .research-room-drawer-shell:target :global(.prompt-block p),
            .research-room-drawer-shell:target :global(li) {
              font-size: 0.76rem;
              line-height: 1.4;
            }

            .research-room-drawer-shell:target :global(.compact-draft summary strong) {
              font-size: 0.78rem;
            }

            .research-room-drawer-shell:target :global(.compact-draft summary em) {
              font-size: 0.68rem;
            }

            .pager :global(.align-right) {
              text-align: left;
            }
          }

          @media (min-width: 641px) and (max-width: 768px) {
            .object-flow-bar {
              top: 0.55rem;
            }

            :global(.concept-notebook-page .object-flow-bar) {
              top: 0.55rem;
            }

            :global(.concept-notebook-page #intuition),
            :global(.concept-notebook-page #math),
            :global(.concept-notebook-page #code),
            :global(.concept-notebook-page #interactive-demo),
            :global(.concept-notebook-page #research-reading-room-workspace),
            :global(.concept-notebook-page [id^='math-object-']),
            :global(.concept-notebook-page [id^='code-witness-']),
            :global(.concept-notebook-page [id^='claim-check-']),
            :global(.concept-notebook-page [id^='source-']) {
              scroll-margin-top: 23rem;
            }
          }
        `}</style>
      </NotebookLayout>
    </div>
  )
}
