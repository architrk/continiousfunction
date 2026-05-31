import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { normalizeLearningRoutePathId } from '@/lib/learningRouteConstants'
import {
  clearLearningRouteSnapshot,
  getSavedLearningRouteSnapshot,
  learningRouteSnapshotEventName,
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
import ObservationLedgerCard from './ObservationLedgerCard'

type LearningRouteContinuitySurface =
  | 'home'
  | 'paper-map'
  | 'graph'
  | 'search'
  | 'attention-serving'
  | 'concept-notebook'

type LearningRouteContinuityBannerProps = {
  surface: LearningRouteContinuitySurface
  snapshot?: LearningRouteSnapshot | null
  onClear?: () => void
  compact?: boolean
  activeConcept?: {
    id: string
    title: string
    href: string
  }
}

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value
  if (limit <= 3) return value.slice(0, limit)
  return `${value.slice(0, limit - 3).trimEnd()}...`
}

function sourceLabel(source: LearningRouteSnapshot['source']) {
  switch (source) {
    case 'paper-map':
      return 'paper mapper'
    case 'graph':
      return 'learning graph'
    case 'attention-serving':
      return 'attention-serving route'
    case 'concept-notebook':
      return 'concept notebook'
    default:
      return 'saved route'
  }
}

function objectTypeLabel(type: LearningRouteSourceObject['type']) {
  return type.replaceAll('-', ' ')
}

function firstRepairHref(snapshot: LearningRouteSnapshot) {
  const concepts = snapshot.routeConcepts ?? []
  return (
    concepts.find((concept) => concept.label === snapshot.nextRepair)?.href ??
    concepts.find((concept, index) => index > 0 && concept.href)?.href ??
    concepts[0]?.href ??
    null
  )
}

function nextRepairConcept(snapshot: LearningRouteSnapshot) {
  if (!snapshot.nextRepair) return null
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

function normalizeRouteHref(href: string | null | undefined) {
  if (!href) return null
  const path = href.split('#')[0]?.replace(/\/+$/, '') || '/'
  return path
}

function routeHrefsMatch(a: string | null | undefined, b: string | null | undefined) {
  const normalizedA = normalizeRouteHref(a)
  const normalizedB = normalizeRouteHref(b)
  return Boolean(normalizedA && normalizedB && normalizedA === normalizedB)
}

function snapshotConceptId(snapshot: LearningRouteSnapshot) {
  return snapshot.mappingId.startsWith('concept:') ? snapshot.mappingId.slice('concept:'.length) : null
}

function sectionHref(href: string, sectionId: string) {
  return `${href.split('#')[0]}#${sectionId}`
}

function routeHref(snapshot: LearningRouteSnapshot, surface: LearningRouteContinuitySurface) {
  if (snapshot.graphRoute) return `/graph/?from=${encodeURIComponent(surface)}#learning-route`

  const normalizedRouteId = normalizeLearningRoutePathId(snapshot.mappingId)
  if (!normalizedRouteId) return null

  return `/graph/?route=${encodeURIComponent(snapshot.mappingId)}&from=${encodeURIComponent(surface)}#learning-route`
}

function searchRouteHref(snapshot: LearningRouteSnapshot, surface: LearningRouteContinuitySurface) {
  const query =
    snapshot.nextRepair ??
    snapshot.currentObject?.title ??
    snapshot.primaryEquation?.label ??
    snapshot.routeLabels[0] ??
    snapshot.paperClueLabel ??
    snapshot.paperTitle

  return `/search?q=${encodeURIComponent(query)}&from=${encodeURIComponent(surface)}#route-search-lens`
}

function hasSavedLabObservation(snapshot: LearningRouteSnapshot) {
  if (snapshot.lastObservation) return true
  return (
    snapshot.routeProgress?.checkpoints?.some(
      (checkpoint) => checkpoint.id === 'kv-memory-prediction' && checkpoint.status === 'saved'
    ) ?? false
  )
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function routeProgressSummary(snapshot: LearningRouteSnapshot) {
  const stages = snapshot.routeProgress?.stageReadiness ?? []
  if (stages.length) {
    const ready = stages.filter((stage) => stage.status === 'ready').length
    const active = stages.find((stage) => stage.status === 'active')
    return {
      label: `${ready}/${stages.length} stages ready`,
      detail: active ? `Now: ${active.label}` : snapshot.routeProgress?.nextRepair ?? 'Route progress saved locally',
    }
  }

  const checkpoints = snapshot.routeProgress?.checkpoints ?? []
  if (checkpoints.length) {
    const saved = checkpoints.filter((checkpoint) => checkpoint.status === 'saved').length
    return {
      label: `${saved}/${checkpoints.length} checkpoints saved`,
      detail: 'Browser-local route state',
    }
  }

  const resolvedObjects = snapshot.routeProgress?.resolvedObjectIds?.length ?? 0
  if (resolvedObjects > 0) {
    return {
      label: pluralize(resolvedObjects, 'object resolved', 'objects resolved'),
      detail: 'Browser-local route state',
    }
  }

  return {
    label: 'Saved in this browser',
    detail: snapshot.nextRepair ? `Next repair: ${snapshot.nextRepair}` : 'No account needed',
  }
}

function primaryResumeAction(snapshot: LearningRouteSnapshot, surface: LearningRouteContinuitySurface) {
  if (snapshot.source === 'concept-notebook' && snapshot.currentObject?.href) {
    return {
      href: snapshot.currentObject.href,
      label: 'Resume concept object',
    }
  }

  const kvLabAction =
    snapshot.mappingId === 'kv-cache' && snapshot.labStatus === 'live'
      ? {
          href: `/paths/attention-serving/?focus=kv-cache&from=${encodeURIComponent(surface)}#serving-module`,
          label: 'Open KV memory lab',
        }
      : null
  if (kvLabAction && hasSavedLabObservation(snapshot)) return kvLabAction

  const graphRouteHref = surface === 'graph' ? null : routeHref(snapshot, surface)
  if (graphRouteHref) {
    return {
      href: graphRouteHref,
      label: surface === 'home' ? 'Continue route' : snapshot.graphRoute ? 'Continue computed route' : 'Continue graph route',
    }
  }

  const repairHref = firstRepairHref(snapshot)
  if (repairHref) {
    return {
      href: repairHref,
      label: snapshot.nextRepair ? `Open ${snapshot.nextRepair}` : 'Open first concept',
    }
  }

  if (kvLabAction) return kvLabAction

  return {
    href: '/paper-map/',
    label: 'Map another paper',
  }
}

function routeLine(snapshot: LearningRouteSnapshot) {
  const labels = snapshot.routeLabels.length ? snapshot.routeLabels : ['Mapped paper']
  const visible = labels.slice(0, 5).join(' -> ')
  return labels.length > 5 ? `${visible} -> +${labels.length - 5} more` : visible
}

function isRouteHistoryObject(object: LearningRouteSourceObject | undefined) {
  return (
    Boolean(object?.href) &&
    (object?.status === 'resolved route history' || object?.status === 'route handoff history')
  )
}

function routeHistoryObjects(snapshot: LearningRouteSnapshot) {
  return snapshot.sourceObjects?.filter(isRouteHistoryObject) ?? []
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
  return index === 0 ? 'Inspect earlier history' : `Inspect deeper history: ${truncate(object.title, 56)}`
}

function routeHistoryCardDetail(
  historyObject: LearningRouteSourceObject,
  earlierHistoryObjects: LearningRouteSourceObject[]
) {
  const baseDetail =
    historyObject.sourceDetail ??
    historyObject.role ??
    (historyObject.status === 'route handoff history' ? 'Previous active repair in this route' : 'Resolved earlier in this route')
  const earlierHistory = routeHistorySummary(earlierHistoryObjects)

  return earlierHistory ? `${baseDetail} Earlier: ${earlierHistory}.` : baseDetail
}

function routeHistoryBridgeDetail(
  historyObject: LearningRouteSourceObject,
  activeObject: LearningRouteSourceObject,
  nextRepair?: string
) {
  if (/flashattention/i.test(historyObject.title) && /serving/i.test(activeObject.title)) {
    if (nextRepair) {
      return `Memory math is fixed; next compare decode-time choices in ${nextRepair}.`
    }
    return 'Resolved memory math -> now compare prefill, decode, batching, and KV bottlenecks.'
  }

  if (/moe serving|token dispatch|expert scheduling/i.test(historyObject.title) && /speculative/i.test(activeObject.title)) {
    if (nextRepair) {
      return `MoE serving bottleneck is preserved as prior history; now test draft-target verification before ${nextRepair}.`
    }
    return 'MoE serving bottleneck is preserved as prior history; now test whether draft-target verification can repair decode latency.'
  }

  if (/serving/i.test(historyObject.title) && /decoding|sampling/i.test(activeObject.title)) {
    if (nextRepair) {
      return `Serving bottlenecks are preserved as the prior repair; now test decode-time controls before ${nextRepair}.`
    }
    return 'Serving bottlenecks are preserved as the prior repair; now test which decode-time control changes next-token behavior.'
  }

  if (/decoding|sampling/i.test(historyObject.title) && /speculative/i.test(activeObject.title)) {
    if (nextRepair) {
      return `Decode-time behavior is preserved as prior history; now test whether draft-target match creates real speedup before ${nextRepair}.`
    }
    return 'Decode-time behavior is preserved as prior history; now test whether draft-target match creates real speculative speedup.'
  }

  if (/speculative/i.test(historyObject.title) && /long context/i.test(activeObject.title)) {
    if (nextRepair) {
      return `Speculative speedup is preserved as prior history; now test which long-context constraint dominates before ${nextRepair}.`
    }
    return 'Speculative speedup is preserved as prior history; now test whether attention work, position phase, or KV memory dominates the longer prompt.'
  }

  if (/long context/i.test(historyObject.title) && /ssm|state.*sequence|mamba|hybrid/i.test(activeObject.title)) {
    if (nextRepair) {
      return `Long-context KV memory is preserved as prior history; now compare fixed-state recurrence before ${nextRepair}.`
    }
    return 'Long-context KV memory is preserved as prior history; now compare fixed-state recurrence against a growing KV cache.'
  }

  if (/ssm|state.*sequence|mamba|hybrid/i.test(historyObject.title) && /swiglu|gated mlp/i.test(activeObject.title)) {
    if (nextRepair) {
      return `Selective recurrent memory is preserved as prior history; now test token-local gated writes before ${nextRepair}.`
    }
    return 'Selective recurrent memory is preserved as prior history; now compare sequence memory with token-local gated MLP writes.'
  }

  if (/swiglu|gated mlp/i.test(historyObject.title) && /mixture of experts|expert routing|moe/i.test(activeObject.title)) {
    if (nextRepair) {
      return `Dense token-local gating is preserved as prior history; now test sparse expert routing before ${nextRepair}.`
    }
    return 'Dense token-local gating is preserved as prior history; now compare one gated MLP write with sparse expert routing.'
  }

  if (/mixture of experts|expert routing|moe/i.test(historyObject.title) && /moe serving|expert parallelism|token dispatch/i.test(activeObject.title)) {
    if (nextRepair) {
      return `Capacity overflow is preserved as prior history; now test token dispatch and expert scheduling before ${nextRepair}.`
    }
    return 'Capacity overflow is preserved as prior history; now compare sparse expert routing with token dispatch and expert scheduling.'
  }

  if (nextRepair) {
    const historyKind = historyObject.status === 'route handoff history' ? 'prior' : 'resolved'
    return `Use the ${historyKind} ${objectTypeLabel(historyObject.type)} to compare what changes, then repair ${nextRepair}.`
  }

  const historyKind = historyObject.status === 'route handoff history' ? 'prior' : 'resolved'
  return `Use the ${historyKind} ${objectTypeLabel(historyObject.type)} to compare what changes in ${activeObject.title}.`
}

function nextRepairHandoffDetail(
  currentObject: LearningRouteSourceObject | undefined,
  nextRepair: NonNullable<ReturnType<typeof nextRepairConcept>>
) {
  const currentTitle = currentObject?.title ?? ''
  const nextTitle = nextRepair.label

  if (/moe serving|token dispatch|expert scheduling/i.test(currentTitle) && /speculative/i.test(nextTitle)) {
    return `Use the MoE Serving bottleneck observation to predict how ${nextTitle} repairs decode latency with draft-target checks.`
  }

  if (/serving/i.test(currentTitle) && /decoding|sampling/i.test(nextTitle)) {
    return `Use the LLM Serving comparison to predict how ${nextTitle} changes next-token behavior.`
  }

  if (/long context/i.test(currentTitle) && /ssm|state.*sequence|mamba|hybrid/i.test(nextTitle)) {
    return `Use the Long Context KV-memory observation to predict how ${nextTitle} trades growing KV cache for fixed-state recurrence.`
  }

  if (/ssm|state.*sequence|mamba|hybrid/i.test(currentTitle) && /swiglu|gated mlp/i.test(nextTitle)) {
    return `Use the SSM selective-gate observation to predict how ${nextTitle} gates token-local MLP writes after sequence memory.`
  }

  if (/swiglu|gated mlp/i.test(currentTitle) && /mixture of experts|expert routing|moe/i.test(nextTitle)) {
    return `Use the SwiGLU gate/product observation to predict how ${nextTitle} routes token-local work into sparse experts.`
  }

  if (/speculative/i.test(currentTitle) && /long context/i.test(nextTitle)) {
    return `Use the Speculative Decoding observation to predict which long-context constraint ${nextTitle} should expose next.`
  }

  return currentObject
    ? `Use ${currentObject.title} to predict what changes in ${nextTitle}.`
    : `Open ${nextTitle} and choose the next object to test.`
}

export default function LearningRouteContinuityBanner({
  surface,
  snapshot: controlledSnapshot,
  onClear,
  compact = false,
  activeConcept,
}: LearningRouteContinuityBannerProps) {
  const isControlled = controlledSnapshot !== undefined
  const [storedSnapshot, setStoredSnapshot] = useState<LearningRouteSnapshot | null>(null)
  const [storedObjectActionDraft, setStoredObjectActionDraft] = useState<LocalObjectActionDraft | null>(null)
  const [storedObjectActionResolution, setStoredObjectActionResolution] = useState<LocalObjectActionResolution | null>(null)

  useEffect(() => {
    if (isControlled) return

    setStoredSnapshot(getSavedLearningRouteSnapshot())

    const refreshSnapshot = () => {
      setStoredSnapshot(getSavedLearningRouteSnapshot())
    }

    window.addEventListener('storage', refreshSnapshot)
    window.addEventListener(learningRouteSnapshotEventName, refreshSnapshot)
    return () => {
      window.removeEventListener('storage', refreshSnapshot)
      window.removeEventListener(learningRouteSnapshotEventName, refreshSnapshot)
    }
  }, [isControlled])

  const snapshot = isControlled ? controlledSnapshot ?? null : storedSnapshot
  const currentObjectKey = snapshot?.currentObject?.objectKey ?? null

  useEffect(() => {
    const refreshDraft = () => {
      setStoredObjectActionDraft(getLocalObjectActionDraft(currentObjectKey))
      setStoredObjectActionResolution(getLocalObjectActionResolution(currentObjectKey))
    }

    refreshDraft()
    window.addEventListener('storage', refreshDraft)
    window.addEventListener(localObjectActionJournalEventName, refreshDraft)
    return () => {
      window.removeEventListener('storage', refreshDraft)
      window.removeEventListener(localObjectActionJournalEventName, refreshDraft)
    }
  }, [currentObjectKey])

  const primaryAction = useMemo(
    () => (snapshot ? primaryResumeAction(snapshot, surface) : null),
    [snapshot, surface]
  )
  const routeSearchHref = snapshot && surface !== 'search' ? searchRouteHref(snapshot, surface) : null

  if (!snapshot || !primaryAction) return null

  const currentObject = snapshot.currentObject
  const savedObjectAction =
    storedObjectActionDraft?.objectKey && storedObjectActionDraft.objectKey === currentObject?.objectKey
      ? storedObjectActionDraft
      : null
  const resolvedObjectAction =
    !savedObjectAction &&
    storedObjectActionResolution?.objectKey &&
    storedObjectActionResolution.objectKey === currentObject?.objectKey
      ? storedObjectActionResolution
      : null
  const resolvedRepairHref = resolvedObjectAction ? firstRepairHref(snapshot) : null
  const isResolvedRepairHandoff = Boolean(
    resolvedObjectAction &&
      activeConcept &&
      snapshotConceptId(snapshot) !== activeConcept.id &&
      routeHrefsMatch(resolvedRepairHref, activeConcept.href)
  )
  const lastObservation = snapshot.lastObservation
  const progress = routeProgressSummary(snapshot)
  const routeHistoryObjectList = routeHistoryObjects(snapshot)
  const routeHistoryObject = routeHistoryObjectList[0] ?? null
  const earlierRouteHistoryObjects = routeHistoryObjectsAfterPrimary(routeHistoryObjectList, routeHistoryObject)
  const nextRepair = nextRepairConcept(snapshot)
  const inspectingRouteHistoryObject =
    activeConcept &&
    snapshotConceptId(snapshot) !== activeConcept.id &&
    !(nextRepair?.href && routeHrefsMatch(nextRepair.href, activeConcept.href))
      ? routeHistoryObjectList.find((object) => routeHrefsMatch(object.href, activeConcept.href)) ?? null
      : null
  const isInspectingRouteHistory = Boolean(
    activeConcept && inspectingRouteHistoryObject
  )
  const isNextRepairHandoff = Boolean(
    activeConcept &&
      nextRepair?.href &&
      routeHrefsMatch(nextRepair.href, activeConcept.href) &&
      snapshotConceptId(snapshot) !== activeConcept.id &&
      !isInspectingRouteHistory &&
      !isResolvedRepairHandoff
  )
  const activeRepairObject = isInspectingRouteHistory ? currentObject : null
  const routeHistoryBridge =
    routeHistoryObject && currentObject && !isInspectingRouteHistory && !isResolvedRepairHandoff && !isNextRepairHandoff
      ? {
          label: routeHistoryObject.status === 'route handoff history' ? 'Activation bridge' : 'Comparison bridge',
          title: `${routeHistoryObject.title} -> ${currentObject.title}`,
          detail: routeHistoryBridgeDetail(routeHistoryObject, currentObject, nextRepair?.label ?? snapshot.nextRepair),
          earlierHistoryLabel: earlierRouteHistoryObjects.length ? routeHistorySummary(earlierRouteHistoryObjects) : null,
          earlierHistoryLinks: earlierRouteHistoryObjects
            .filter((object) => object.href)
            .map((object, index) => ({
              href: object.href as string,
              label: routeHistoryLinkLabel(object, index),
            })),
          nextRepairLabel: nextRepair?.label ?? snapshot.nextRepair ?? null,
          nextRepairHref: nextRepair?.href ?? null,
        }
      : null
  const activeRepairLabel =
    isResolvedRepairHandoff && activeConcept && snapshot.nextRepair && activeConcept.title.includes(snapshot.nextRepair)
      ? snapshot.nextRepair
      : activeConcept?.title
  const question = truncate(
    isInspectingRouteHistory && activeConcept
      ? `Inspecting history: ${activeConcept.title}`
      : isNextRepairHandoff && nextRepair
        ? `Next repair: ${nextRepair.label}`
      : isResolvedRepairHandoff && activeRepairLabel
        ? `Next repair: ${activeRepairLabel}`
        : snapshot.currentQuestion ?? snapshot.paperTitle,
    compact ? 112 : 150
  )
  const paperLabel = truncate(
    isInspectingRouteHistory && activeRepairObject
      ? `Active repair remains ${activeRepairObject.title}`
      : isNextRepairHandoff && currentObject
        ? `Arrived from ${currentObject.title} comparison bridge`
      : isResolvedRepairHandoff && currentObject
      ? `Arrived after resolving ${currentObject.title}`
      : snapshot.paperClueLabel ?? snapshot.paperTitle,
    compact ? 120 : 170
  )
  const nextActionDetail =
    (isInspectingRouteHistory && activeRepairObject
      ? `Return to ${activeRepairObject.title}; this history view does not replace the saved route.`
      : null) ??
    (isNextRepairHandoff && nextRepair
      ? nextRepairHandoffDetail(currentObject, nextRepair)
      : null) ??
    (isResolvedRepairHandoff && currentObject && resolvedObjectAction
      ? `${currentObject.title}: ${resolvedObjectAction.resolutionNote}`
      : null) ??
    savedObjectAction?.note ??
    resolvedObjectAction?.resolutionNote ??
    lastObservation?.nextQuestion ??
    currentObject?.role ??
    snapshot.labGoal ??
    (snapshot.nextRepair ? `Repair ${snapshot.nextRepair} before extending the route.` : 'Continue the saved route.')
  const primaryActionLabel = savedObjectAction
    ? 'Open saved action'
    : isInspectingRouteHistory
      ? 'Return to active repair'
      : isNextRepairHandoff && nextRepair
        ? `Start ${nextRepair.label}`
      : isResolvedRepairHandoff && activeRepairLabel
      ? `Start ${activeRepairLabel}`
      : resolvedObjectAction
        ? 'Continue next repair'
        : primaryAction.label
  const primaryActionHref =
    isInspectingRouteHistory
      ? activeRepairObject?.href ?? resolvedRepairHref ?? primaryAction.href
      : isNextRepairHandoff && activeConcept
        ? sectionHref(activeConcept.href, 'intuition')
      : isResolvedRepairHandoff && activeConcept
        ? sectionHref(activeConcept.href, 'intuition')
        : resolvedRepairHref ?? primaryAction.href
  const inspectObjectHref =
    currentObject?.href && currentObject.href !== primaryActionHref ? currentObject.href : null
  const inspectObjectLabel = isResolvedRepairHandoff ? 'Inspect resolved object' : 'Inspect object'
  const bannerClassName = [
    'continuity-banner',
    compact ? 'compact' : '',
    isResolvedRepairHandoff || isNextRepairHandoff ? 'handoff-landing' : '',
    isInspectingRouteHistory ? 'history-inspection' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const clearRoute = () => {
    if (onClear) {
      onClear()
      return
    }

    clearLearningRouteSnapshot()
    setStoredSnapshot(null)
  }

  return (
    <section className={bannerClassName} aria-labelledby="continuity-title">
      <div className="continuity-copy">
        <p className="eyebrow">Saved Route</p>
        <h3 id="continuity-title">{question}</h3>
        <p>
          {sourceLabel(snapshot.source)} · {paperLabel}
        </p>
        <small>{routeLine(snapshot)}</small>
      </div>

      <div className="continuity-facts">
        {isInspectingRouteHistory && inspectingRouteHistoryObject ? (
          <article className="route-history-card">
            <span>Inspecting history</span>
            <strong>{inspectingRouteHistoryObject.title}</strong>
            <em>{inspectingRouteHistoryObject.sourceDetail ?? inspectingRouteHistoryObject.role ?? 'Earlier in this route'}</em>
          </article>
        ) : (isResolvedRepairHandoff || isNextRepairHandoff) && activeConcept ? (
          <article>
            <span>Active repair</span>
            <strong>{activeConcept.title}</strong>
            <em>New concept is active</em>
          </article>
        ) : currentObject ? (
          <article>
            <span>Current object</span>
            <strong>{currentObject.title}</strong>
            <em>
              {objectTypeLabel(currentObject.type)}
              {currentObject.status ? ` · ${currentObject.status}` : ''}
              {currentObject.sourceDetail ? ` · ${truncate(currentObject.sourceDetail, compact ? 70 : 110)}` : ''}
            </em>
          </article>
        ) : (
          <article>
            <span>Current object</span>
            <strong>{snapshot.primaryEquation?.label ?? snapshot.nextRepair ?? 'Route question'}</strong>
            <em>{snapshot.primaryEquation ? 'equation carried' : 'route focus pending'}</em>
          </article>
        )}

        {activeRepairObject ? (
          <article>
            <span>Active repair</span>
            <strong>{activeRepairObject.title}</strong>
            <em>Return path preserved</em>
          </article>
        ) : null}

        {compact ? (
          <article>
            <span>Local progress</span>
            <strong>{progress.label}</strong>
            <em>{progress.detail}</em>
          </article>
        ) : null}

        {lastObservation ? (
          <ObservationLedgerCard
            snapshot={snapshot}
            variant={compact ? 'compact' : 'detailed'}
            contextLabel={compact ? 'Route checkpoint' : 'Saved route checkpoint'}
            actions={[
              {
                href: inspectObjectHref ?? primaryActionHref,
                label: inspectObjectHref ? inspectObjectLabel : primaryActionLabel,
                primary: true,
              },
              ...(routeSearchHref ? [{ href: routeSearchHref, label: 'Search related' }] : []),
            ].slice(0, 2)}
          />
        ) : null}

        {routeHistoryObject && !isInspectingRouteHistory ? (
          <article className="route-history-card">
            <span>Route history</span>
            <strong>{routeHistoryObject.title}</strong>
            <em>{routeHistoryCardDetail(routeHistoryObject, earlierRouteHistoryObjects)}</em>
          </article>
        ) : null}

        {routeHistoryBridge ? (
          <article className="route-history-bridge-card">
            <span>{routeHistoryBridge.label}</span>
            <strong>{routeHistoryBridge.title}</strong>
            <em>{routeHistoryBridge.detail}</em>
            {routeHistoryBridge.earlierHistoryLabel ? <small>Earlier history: {routeHistoryBridge.earlierHistoryLabel}</small> : null}
            {routeHistoryBridge.nextRepairLabel ? <small>Next repair: {routeHistoryBridge.nextRepairLabel}</small> : null}
          </article>
        ) : null}

        <article
          className={
            savedObjectAction
              ? 'next-action-card saved-object-action'
              : isInspectingRouteHistory
                ? 'next-action-card route-history-action'
              : isResolvedRepairHandoff
                ? 'next-action-card route-history-action'
              : resolvedObjectAction
                ? 'next-action-card resolved-object-action'
                : 'next-action-card'
          }
        >
          <span>
            {savedObjectAction
              ? 'Saved object action'
              : isInspectingRouteHistory
                ? 'Return path'
              : isResolvedRepairHandoff
                ? 'Route history'
                : resolvedObjectAction
                  ? 'Resolved object action'
                  : 'Next action'}
          </span>
          <strong>
            {savedObjectAction
              ? truncate(savedObjectAction.nextAction, compact ? 118 : 170)
              : isInspectingRouteHistory
                ? 'Return to active repair'
              : resolvedObjectAction
                ? truncate(resolvedObjectAction.resolvedAction, compact ? 118 : 170)
                : primaryAction.label}
          </strong>
          <em>{truncate(nextActionDetail, 150)}</em>
        </article>
      </div>

      <div className="continuity-actions">
        <Link href={primaryActionHref}>{primaryActionLabel}</Link>
        {routeSearchHref ? <Link href={routeSearchHref}>Search route</Link> : null}
        {routeHistoryObject?.href && !isInspectingRouteHistory ? <Link href={routeHistoryObject.href}>Inspect history</Link> : null}
        {!isInspectingRouteHistory
          ? earlierRouteHistoryObjects
              .filter((object) => object.href)
              .map((object, index) => (
                <Link key={object.href} href={object.href as string}>
                  {routeHistoryLinkLabel(object, index)}
                </Link>
              ))
          : null}
        {routeHistoryBridge?.nextRepairHref ? (
          <Link href={routeHistoryBridge.nextRepairHref}>Open {routeHistoryBridge.nextRepairLabel}</Link>
        ) : null}
        {inspectObjectHref ? <Link href={inspectObjectHref}>{inspectObjectLabel}</Link> : null}
        <button type="button" onClick={clearRoute}>
          Clear route
        </button>
      </div>

      <style jsx>{`
        .continuity-banner {
          display: grid;
          gap: 0.85rem;
          min-width: 0;
          padding: 0.95rem;
          border-radius: 20px;
          border: 1px solid rgba(31, 111, 120, 0.16);
          background:
            linear-gradient(180deg, rgba(247, 252, 250, 0.94), rgba(255, 251, 245, 0.94)),
            linear-gradient(90deg, rgba(31, 111, 120, 0.1), rgba(194, 74, 45, 0.08));
        }

        .continuity-banner.compact {
          grid-template-columns: minmax(180px, 0.82fr) minmax(260px, 1.25fr) auto;
          align-items: stretch;
          gap: 0.55rem;
          padding: 0.64rem;
          border-radius: 16px;
        }

        .continuity-banner.handoff-landing {
          border-color: rgba(31, 111, 120, 0.26);
          background:
            linear-gradient(180deg, rgba(247, 252, 250, 0.96), rgba(255, 251, 245, 0.94)),
            linear-gradient(90deg, rgba(31, 111, 120, 0.16), rgba(243, 176, 71, 0.12));
        }

        .continuity-banner.compact .eyebrow {
          margin-bottom: 0.28rem;
          font-size: 0.62rem;
          letter-spacing: 0.1em;
        }

        .continuity-banner.compact h3 {
          font-size: clamp(1rem, 1.45vw, 1.22rem);
          line-height: 1.12;
        }

        .continuity-banner.compact .continuity-copy > p:not(.eyebrow) {
          margin-top: 0.32rem;
          font-size: 0.84rem;
          line-height: 1.36;
        }

        .continuity-banner.compact small {
          margin-top: 0.24rem;
          font-size: 0.76rem;
          line-height: 1.32;
        }

        .continuity-banner.compact .continuity-facts {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.42rem;
        }

        .continuity-banner.compact .continuity-facts article {
          min-height: auto;
          padding: 0.48rem;
          border-radius: 12px;
          gap: 0.22rem;
        }

        .continuity-banner.compact .continuity-facts span {
          font-size: 0.58rem;
          letter-spacing: 0.08em;
        }

        .continuity-banner.compact .continuity-facts strong,
        .continuity-banner.compact .continuity-facts em {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .continuity-banner.compact .continuity-facts strong {
          -webkit-line-clamp: 2;
          font-size: 0.86rem;
          line-height: 1.25;
        }

        .continuity-banner.compact .continuity-facts em {
          -webkit-line-clamp: 2;
          font-size: 0.74rem;
          line-height: 1.28;
        }

        .continuity-banner.compact .continuity-actions {
          display: grid;
          grid-template-columns: minmax(118px, 1fr);
          align-content: stretch;
          gap: 0.36rem;
        }

        .continuity-banner.compact .continuity-actions :global(a),
        .continuity-banner.compact .continuity-actions button {
          min-height: 32px;
          padding: 0.4rem 0.56rem;
          border-radius: 12px;
          font-size: 0.78rem;
          line-height: 1.1;
        }

        .continuity-copy {
          min-width: 0;
        }

        .eyebrow {
          margin: 0 0 0.5rem;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        h3,
        p,
        strong,
        em,
        small {
          overflow-wrap: break-word;
        }

        h3 {
          margin: 0;
          max-width: 56rem;
          color: #151d27;
          font-size: clamp(1.25rem, 2.1vw, 1.65rem);
          line-height: 1.08;
        }

        h3::before {
          content: none;
          display: none;
        }

        p {
          margin: 0.55rem 0 0;
          color: #455361;
          line-height: 1.55;
        }

        small {
          display: block;
          margin-top: 0.4rem;
          color: #65717d;
          line-height: 1.45;
        }

        .continuity-facts {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.55rem;
          min-width: 0;
        }

        .continuity-facts article {
          display: grid;
          gap: 0.32rem;
          min-width: 0;
          min-height: 102px;
          padding: 0.7rem;
          border-radius: 15px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.78);
        }

        .continuity-facts :global(.observation-ledger-card) {
          grid-column: 1 / -1;
          min-height: 102px;
          box-shadow: none;
        }

        .continuity-banner.compact .continuity-facts :global(.observation-ledger-card) {
          grid-column: 1 / -1;
          min-height: auto;
        }

        .continuity-facts span {
          font-family: var(--font-mono);
          font-size: 0.64rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #c24a2d;
        }

        .continuity-facts strong {
          color: #151d27;
          line-height: 1.35;
        }

        .continuity-facts em {
          color: #52606c;
          font-size: 0.82rem;
          font-style: normal;
          line-height: 1.42;
        }

        .next-action-card {
          border-color: rgba(31, 111, 120, 0.18);
          background: rgba(231, 248, 244, 0.72);
        }

        .next-action-card.saved-object-action {
          border-color: rgba(194, 74, 45, 0.22);
          background:
            linear-gradient(180deg, rgba(255, 251, 245, 0.9), rgba(255, 245, 236, 0.82)),
            rgba(231, 248, 244, 0.48);
        }

        .next-action-card.resolved-object-action {
          border-color: rgba(31, 111, 120, 0.24);
          background:
            linear-gradient(180deg, rgba(247, 252, 250, 0.94), rgba(231, 248, 244, 0.84)),
            rgba(255, 251, 245, 0.48);
        }

        .next-action-card.route-history-action {
          border-color: rgba(243, 176, 71, 0.34);
          background:
            linear-gradient(180deg, rgba(255, 251, 245, 0.94), rgba(255, 247, 226, 0.86)),
            rgba(231, 248, 244, 0.34);
        }

        .route-history-card {
          border-color: rgba(243, 176, 71, 0.34);
          background:
            linear-gradient(180deg, rgba(255, 251, 245, 0.94), rgba(255, 247, 226, 0.84)),
            rgba(231, 248, 244, 0.3);
        }

        .route-history-bridge-card small {
          margin-top: 0;
          color: #1f6f78;
          font-family: var(--font-mono);
          font-size: 0.66rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .continuity-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
        }

        .continuity-actions :global(a),
        .continuity-actions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0.56rem 0.78rem;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          font: inherit;
          font-weight: 730;
          text-decoration: none;
          cursor: pointer;
        }

        .continuity-actions :global(a:first-child) {
          background: #1b2430;
          color: #fbf4e8;
        }

        .continuity-actions :global(a:not(:first-child)),
        .continuity-actions button {
          background: rgba(255, 251, 245, 0.9);
          color: #1b2430;
        }

        .continuity-actions :global(a:hover),
        .continuity-actions button:hover {
          border-color: rgba(31, 111, 120, 0.28);
          background: #1f6f78;
          color: #fbf4e8;
          transform: translateY(-1px);
        }

        .continuity-actions :global(a:focus-visible),
        .continuity-actions button:focus-visible {
          outline: 2px solid rgba(31, 111, 120, 0.42);
          outline-offset: 2px;
        }

        @media (max-width: 920px) {
          .continuity-facts {
            grid-template-columns: 1fr;
          }

          .continuity-facts :global(.observation-ledger-card) {
            grid-column: 1 / -1;
          }

          .continuity-banner.compact {
            grid-template-columns: 1fr;
          }

          .continuity-banner.compact .continuity-facts {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .continuity-banner.compact .continuity-actions {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .continuity-actions,
          .continuity-actions :global(a),
          .continuity-actions button {
            width: 100%;
          }

          .continuity-banner.compact {
            padding: 0.58rem;
            gap: 0.46rem;
          }

          .continuity-banner.compact .continuity-copy > p:not(.eyebrow) {
            display: none;
          }

          .continuity-banner.compact small {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .continuity-banner.compact .continuity-facts {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .continuity-banner.compact .next-action-card {
            grid-column: 1 / -1;
          }

          .continuity-banner.compact .continuity-facts :global(.observation-ledger-card) {
            grid-column: 1 / -1;
          }

          .continuity-banner.compact .continuity-actions,
          .continuity-banner.compact .continuity-actions :global(a),
          .continuity-banner.compact .continuity-actions button {
            width: auto;
          }

          .continuity-banner.compact .continuity-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .continuity-banner.compact .continuity-actions :global(a:first-child) {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </section>
  )
}
