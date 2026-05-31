import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  clearLearningRouteSnapshot,
  getSavedLearningRouteSnapshot,
  saveLearningRouteSnapshot,
  type LearningRouteSourceObject,
  type LearningRouteSnapshot,
} from '@/lib/learningRouteSnapshot'
import { kvMemoryEquation, normalizeLearningRoutePathId } from '@/lib/learningRouteConstants'
import GraphRouteEngine from './GraphRouteEngine'
import ResearchReadingRoom from '@/components/discussion/ResearchReadingRoom'
import {
  buildDiscussionAnchor,
  buildDiscussionPlaceholder,
  type DiscussionAnchorListItem,
  type DiscussionObjectType,
} from '@/lib/discussionAnchors'
import { routeSourceObjectFromDiscussionItem } from '@/lib/researchDiscussionRoom'
import LearningRouteContinuityBanner from './LearningRouteContinuityBanner'
import { getLocalObjectActionDraft } from '@/lib/localObjectActionJournal'

type GraphPathNode = {
  label: string
  role: string
  href?: string
  status?: 'live' | 'planned'
}

type GraphPath = {
  id: string
  prompt: string
  audience: string
  answer: string
  nodes: GraphPathNode[]
  edges: Array<{ type: string; from: string; to: string; why: string }>
  objects: Array<{
    type: DiscussionObjectType
    id: string
    title: string
    status: string
    prompt?: string
  }>
}

const paths: GraphPath[] = [
  {
    id: 'mamba',
    prompt: 'I know transformers and Adam. What do I need for Mamba-2?',
    audience: 'Researcher / engineer',
    answer: 'Repair the long-context pressure first, then cross the bridge from attention memory to fixed-state recurrence.',
    nodes: [
      { label: 'Attention', role: 'known transformer mechanism', href: '/domains/attention-transformers/attention-transformers/' },
      { label: 'Efficient Attention', role: 'why KV memory hurts', href: '/domains/attention-transformers/efficient-attention/' },
      { label: 'Long Context', role: 'systems pressure', href: '/domains/attention-transformers/long-context/' },
      { label: 'Linear Transformations', role: 'state update language', href: '/domains/linear-algebra/linear-transformations/' },
      { label: 'SSM Hybrids', role: 'recurrence bridge', status: 'planned' },
      { label: 'Parallel Scan', role: 'implementation trick', status: 'planned' },
      { label: 'State-Space Duality', role: 'paper-specific bridge', status: 'planned' },
    ],
    edges: [
      { type: 'prerequisite', from: 'Attention', to: 'Efficient Attention', why: 'You need weighted copying before memory optimization makes sense.' },
      { type: 'invented to fix', from: 'Efficient Attention', to: 'Long Context', why: 'Long contexts expose the cost of storing and reading all prior keys and values.' },
      { type: 'same pressure', from: 'Long Context', to: 'SSM Hybrids', why: 'Fixed-size states are attractive because KV memory grows with sequence length.' },
      { type: 'implementation dependency', from: 'SSM Hybrids', to: 'Parallel Scan', why: 'Training recurrent-looking models at scale requires parallelizable sequence computation.' },
    ],
    objects: [
      { type: 'paper', id: 'mamba-state-space-duality', title: 'Mamba-2 / state-space duality', status: 'mapper candidate' },
      { type: 'equation', id: 'selective-state-update', title: 'h_t = A(x_t)h_{t-1} + B(x_t)x_t', status: 'needs explainer' },
      { type: 'toy-experiment', id: 'fixed-state-kv-memory-simulator', title: 'fixed state vs KV memory simulator', status: 'planned' },
      {
        type: 'claim',
        id: 'recurrence-attention-control-theory',
        title: 'recurrence, attention, or control theory?',
        status: 'object question',
        prompt: 'Which framing best explains the route: recurrence, attention, convolution, or control theory?',
      },
    ],
  },
  {
    id: 'kv-cache',
    prompt: 'A paper claims it compresses the KV cache. What should I inspect?',
    audience: 'ML systems professional',
    answer: 'Follow the runtime path from attention math to serving bottlenecks, then test which memory term is being reduced.',
    nodes: [
      { label: 'Attention', role: 'core equation', href: '/domains/attention-transformers/attention-transformers/' },
      { label: 'Efficient Attention', role: 'cache mechanics', href: '/domains/attention-transformers/efficient-attention/' },
      { label: 'RoPE', role: 'position behavior', href: '/domains/attention-transformers/rope/' },
      { label: 'FlashAttention', role: 'memory movement', href: '/domains/attention-transformers/flash-attention/' },
      { label: 'Long Context', role: 'stress regime', href: '/domains/attention-transformers/long-context/' },
      { label: 'LLM Serving', role: 'prefill/decode split', href: '/domains/llm-systems/llm-serving/' },
      { label: 'Decoding', role: 'runtime loop', href: '/domains/llm-systems/decoding-sampling/' },
    ],
    edges: [
      { type: 'prerequisite', from: 'Attention', to: 'Efficient Attention', why: 'Cache tricks only matter after Q/K/V shape and softmax copying are clear.' },
      { type: 'implementation dependency', from: 'Efficient Attention', to: 'LLM Serving', why: 'Decode is often bandwidth-bound because it repeatedly reads cached keys and values.' },
      { type: 'breaks when', from: 'RoPE', to: 'Long Context', why: 'Position extrapolation changes the geometry of attention scores.' },
      { type: 'systems tradeoff', from: 'FlashAttention', to: 'LLM Serving', why: 'FlashAttention changes memory traffic, not the attention function itself.' },
    ],
    objects: [
      { type: 'paper', id: 'kv-cache-compression-result', title: 'KV cache compression result', status: 'carried from mapper when available' },
      { type: 'equation', id: 'kv-memory-equation', title: kvMemoryEquation, status: 'live in serving module' },
      { type: 'toy-experiment', id: 'mha-mqa-gqa-calculator', title: 'MHA vs MQA vs GQA calculator', status: 'live: KV memory calculator' },
      {
        type: 'claim',
        id: 'capacity-bandwidth-quality',
        title: 'capacity vs bandwidth vs quality',
        status: 'object question',
        prompt: 'Is the bottleneck capacity, bandwidth, latency, or attention quality?',
      },
    ],
  },
  {
    id: 'dpo',
    prompt: 'I understand cross-entropy. How do I read DPO or RLHF papers?',
    audience: 'Student / alignment reader',
    answer: 'Move from likelihood to preference shaping, then keep the KL reference model visible at every step.',
    nodes: [
      { label: 'Maximum Likelihood', role: 'fit observed data', href: '/domains/probability/maximum-likelihood/' },
      { label: 'Cross-Entropy', role: 'classification loss', href: '/domains/probability/cross-entropy/' },
      { label: 'KL Divergence', role: 'reference anchor', href: '/domains/information-theory/kl-divergence/' },
      { label: 'RLHF', role: 'reward route', href: '/domains/alignment/rlhf/' },
      { label: 'DPO', role: 'direct preference route', href: '/domains/alignment/dpo/' },
      { label: 'Reward Hacking', role: 'failure mode', href: '/domains/alignment/reward-hacking/' },
    ],
    edges: [
      { type: 'prerequisite', from: 'Cross-Entropy', to: 'DPO', why: 'DPO is still a classification-style loss, but on preference pairs.' },
      { type: 'same mathematical trick', from: 'KL Divergence', to: 'RLHF', why: 'KL keeps the learned policy near a reference distribution.' },
      { type: 'invented to fix', from: 'RLHF', to: 'DPO', why: 'DPO avoids separately learning and optimizing an explicit reward model.' },
      { type: 'breaks when', from: 'Reward Hacking', to: 'RLHF', why: 'Optimizing a proxy can select behavior humans did not intend.' },
    ],
    objects: [
      { type: 'paper', id: 'preference-optimization-paper', title: 'preference optimization paper', status: 'mapper candidate' },
      { type: 'equation', id: 'reference-relative-log-odds', title: 'reference-relative log odds', status: 'live in concept' },
      { type: 'toy-experiment', id: 'pairwise-preference-probability-shaper', title: 'pairwise preference probability shaper', status: 'live concept demo' },
      {
        type: 'misconception',
        id: 'what-kl-preserves',
        title: 'what exactly does KL preserve?',
        status: 'object question',
        prompt: 'What behavior is preserved by the KL anchor, and what can still change?',
      },
    ],
  },
  {
    id: 'muon',
    prompt: 'What should I know before comparing Muon to AdamW?',
    audience: 'Practitioner / optimizer reader',
    answer: 'Separate the base update rule, adaptive scaling, matrix geometry, and loss-surface consequences.',
    nodes: [
      { label: 'Gradient Descent', role: 'base step', href: '/domains/optimization/gradient-descent/' },
      { label: 'Adam', role: 'adaptive baseline', href: '/domains/optimization/adam/' },
      { label: 'Weight Decay AdamW', role: 'regularized baseline', href: '/domains/optimization/weight-decay-adamw/' },
      { label: 'Linear Transformations', role: 'matrix parameter lens', href: '/domains/linear-algebra/linear-transformations/' },
      { label: 'Loss Landscapes', role: 'geometry consequence', href: '/domains/optimization/loss-landscapes/' },
      { label: 'Muon', role: 'orthogonalized update', href: '/concepts/optimizers/muon/' },
    ],
    edges: [
      { type: 'prerequisite', from: 'Gradient Descent', to: 'Adam', why: 'Adam modifies the update, not the basic optimization objective.' },
      { type: 'implementation dependency', from: 'Linear Transformations', to: 'Muon', why: 'Muon treats matrix-shaped updates as objects with geometry.' },
      { type: 'same mathematical trick', from: 'Loss Landscapes', to: 'Muon', why: 'The optimizer changes how steps move through curved parameter space.' },
      { type: 'research frontier', from: 'Adam', to: 'Muon', why: 'The practical question is when orthogonalized updates beat adaptive moments.' },
    ],
    objects: [
      { type: 'paper', id: 'muon-optimizer-comparison', title: 'Muon / optimizer comparison', status: 'mapper candidate' },
      { type: 'equation', id: 'orthogonalized-update', title: 'X -> X(X^T X)^(-1/2)', status: 'needs explainer' },
      { type: 'toy-experiment', id: 'adamw-vs-orthogonalized-update', title: 'AdamW vs orthogonalized update toy loss', status: 'planned' },
      {
        type: 'claim',
        id: 'geometry-or-implementation-detail',
        title: 'geometry or implementation detail?',
        status: 'object question',
        prompt: 'Is Muon helping because of optimizer geometry, implementation details, or both?',
      },
    ],
  },
  {
    id: 'diffusion-flow',
    prompt: 'A paper compares diffusion, score models, and flow matching. What should I inspect?',
    audience: 'Generative modeling reader',
    answer: 'Start from distributions, then separate score fields, stochastic denoising, invertible density change, and learned transport paths.',
    nodes: [
      { label: 'Distributions', role: 'probability mass and density', href: '/domains/probability/distributions/' },
      { label: 'Score Matching', role: 'learn the density gradient', href: '/domains/generative-models/score-matching/' },
      { label: 'Diffusion', role: 'denoise through a score field', href: '/domains/generative-models/diffusion/' },
      { label: 'Normalizing Flows', role: 'invertible density change', href: '/domains/generative-models/normalizing-flows/' },
      { label: 'Flow Matching', role: 'learn a transport vector field', href: '/domains/generative-models/flow-matching/' },
    ],
    edges: [
      { type: 'prerequisite', from: 'Distributions', to: 'Score Matching', why: 'Score models need density language before gradients of log density make sense.' },
      { type: 'same mathematical object', from: 'Score Matching', to: 'Diffusion', why: 'Diffusion samplers follow learned score information while reversing noise.' },
      { type: 'contrast', from: 'Normalizing Flows', to: 'Flow Matching', why: 'Both describe continuous change, but flow matching learns a vector field rather than an invertible likelihood map.' },
      { type: 'research frontier', from: 'Diffusion', to: 'Flow Matching', why: 'Many recent papers ask whether straighter paths can reduce sampling cost.' },
    ],
    objects: [
      { type: 'paper', id: 'diffusion-flow-matching-paper', title: 'diffusion / flow matching paper', status: 'mapper candidate' },
      { type: 'equation', id: 'flow-matching-velocity-field', title: 'dx_t/dt = v_t(x_t)', status: 'live in flow-matching concept' },
      { type: 'toy-experiment', id: 'particle-path-vector-field-comparison', title: 'particle path and vector-field comparison', status: 'live concept demos' },
      {
        type: 'claim',
        id: 'score-velocity-likelihood-map',
        title: 'score field, velocity field, or likelihood map?',
        status: 'object question',
        prompt: 'Which mathematical object does the paper actually learn: score, velocity, or likelihood map?',
      },
    ],
  },
]

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function conceptIdFromHref(href?: string) {
  return href?.split('/').filter(Boolean).at(-1) ?? ''
}

function searchHrefForPath(path: GraphPath) {
  const query = path.nodes[1]?.label ?? path.nodes[0]?.label ?? path.prompt
  return `/search/?q=${encodeURIComponent(query)}&from=graph#route-search-lens`
}

function hashHref(baseHref: string | undefined, hash: string) {
  if (!baseHref) return null
  return `${baseHref.split('#')[0]}#${hash}`
}

function nextLiveRepairNode(path: GraphPath) {
  return path.nodes.find((node, index) => index > 0 && node.href) ?? path.nodes.find((node) => node.href) ?? null
}

function experimentHrefForPath(path: GraphPath) {
  if (path.id === 'kv-cache') {
    return '/paths/attention-serving/?focus=kv-cache&from=graph#serving-module'
  }

  const liveLab = path.objects.find(
    (object) => object.type === 'toy-experiment' && object.status.toLowerCase().includes('live')
  )
  if (!liveLab) return searchHrefForPath(path)

  const demoNode =
    path.nodes.find((node) => node.href && liveLab.title.toLowerCase().includes(node.label.toLowerCase())) ??
    path.nodes.find((node) => node.href && node.label.toLowerCase().includes(path.id.split('-')[0])) ??
    nextLiveRepairNode(path)

  return hashHref(demoNode?.href, 'interactive-demo') ?? searchHrefForPath(path)
}

function experimentActionLabelForPath(path: GraphPath, labObject: GraphPath['objects'][number] | undefined) {
  if (path.id === 'kv-cache') return 'Open KV memory lab'
  return labObject?.status.toLowerCase().includes('live') ? 'Open demo witness' : 'Search lab bridge'
}

function routeWorkbenchForPath(path: GraphPath) {
  const repairNode = nextLiveRepairNode(path)
  const researchObject = path.objects.find((object) => object.prompt) ?? path.objects[0]
  const labObject = path.objects.find((object) => object.type === 'toy-experiment') ?? path.objects[0]
  const edge = path.edges[0]

  return {
    repairNode,
    researchObject,
    labObject,
    edge,
    experimentHref: experimentHrefForPath(path),
    experimentActionLabel: experimentActionLabelForPath(path, labObject),
  }
}

function graphRouteSnapshot(path: GraphPath): LearningRouteSnapshot {
  const equation = path.objects.find((object) => object.type === 'equation')
  const lab = path.objects.find((object) => object.type === 'toy-experiment')
  const liveLab = lab?.status.toLowerCase().includes('live')
  const conceptSourceObjects: LearningRouteSourceObject[] = path.nodes.slice(0, 12).map((node) => ({
    type: 'concept',
    title: node.label,
    href: node.href,
    role: node.role,
    status: node.status ?? 'live',
  }))
  const objectBudget = Math.max(12 - conceptSourceObjects.length, 0)
  const sourceObjects: LearningRouteSourceObject[] = [
    ...conceptSourceObjects,
    ...path.objects
      .map((object) => {
        const discussionAnchorId = buildDiscussionAnchorIdForGraphObject(path.id, object)
        const type: LearningRouteSourceObject['type'] = object.type

        return {
          type,
          id: object.id,
          discussionAnchorId: discussionAnchorId ?? undefined,
          title: object.title,
          status: object.status,
        }
      })
      .slice(0, objectBudget),
  ]

  return {
    version: 'cf-route-snapshot-v1',
    source: 'graph',
    paperClueLabel: path.prompt,
    paperTitle: path.prompt,
    inputKind: 'learning question',
    mappingId: path.id,
    mappingTitle: 'Learning graph route',
    routeLabels: path.nodes.map((node) => node.label),
    routeConceptIds: path.nodes.map((node) => conceptIdFromHref(node.href)).filter(Boolean),
    routeConcepts: path.nodes
      .filter((node) => node.href)
      .map((node) => ({
        label: node.label,
        href: node.href as string,
        role: node.role,
      })),
    nextRepair: path.nodes[1]?.label ?? path.nodes[0]?.label,
    currentQuestion: path.prompt,
    primaryEquation: equation
      ? {
          label: 'Route equation',
          equation: equation.title,
          confidence: 'medium',
          sourceLabel: 'Learning graph object',
        }
      : undefined,
    labGoal: lab?.title,
    labStatus: liveLab ? 'live' : 'planned',
    sourceObjects,
    currentObject:
      sourceObjects.find((object) => object.type === 'concept' && object.title === path.nodes[1]?.label) ??
      sourceObjects.find((object) => object.type === 'equation') ??
      sourceObjects[0],
    groundingStatus: 'local-preview',
    createdAt: new Date().toISOString(),
  }
}

function buildDiscussionAnchorIdForGraphObject(pathId: string, object: GraphPath['objects'][number]) {
  const anchor = buildDiscussionAnchor({
    objectType: object.type,
    surface: 'graph',
    segments: [pathId, object.id],
    title: object.title,
    contextLabel: object.status,
  })

  return anchor?.id ?? null
}

function graphDiscussionItems(path: GraphPath): DiscussionAnchorListItem[] {
  return path.objects.flatMap((object) => {
    const anchor = buildDiscussionAnchor({
      objectType: object.type,
      surface: 'graph',
      segments: [path.id, object.id],
      title: object.title,
      contextLabel: object.status,
    })
    if (!anchor) return []

    const thread = buildDiscussionPlaceholder(
      anchor,
      object.prompt ?? `What should we inspect about ${object.title} before treating this route object as understood?`
    )
    return thread ? [{ anchor, thread }] : []
  })
}

export function preserveMatchingObservation(
  nextSnapshot: LearningRouteSnapshot,
  previousSnapshot: LearningRouteSnapshot | null
): LearningRouteSnapshot {
  const previousPathId = normalizeLearningRoutePathId(previousSnapshot?.mappingId) ?? previousSnapshot?.mappingId
  const nextPathId = normalizeLearningRoutePathId(nextSnapshot.mappingId) ?? nextSnapshot.mappingId
  if (!previousSnapshot || previousPathId !== nextPathId) {
    return nextSnapshot
  }

  const hasPaperEvidence =
    previousSnapshot.source === 'paper-map' ||
    previousSnapshot.sourceObjects?.some(
      (object) => object.type === 'paper' || object.sourceIds?.length || object.sourceDetail || object.confidence
    )
  const mergedSourceObjects = hasPaperEvidence
    ? [
        ...(previousSnapshot.sourceObjects ?? []),
        ...(nextSnapshot.sourceObjects ?? []).filter((object) => {
          const duplicateKey = object.discussionAnchorId ?? `${object.type}:${object.id ?? object.title}`
          return !(previousSnapshot.sourceObjects ?? []).some(
            (previousObject) =>
              (previousObject.discussionAnchorId ?? `${previousObject.type}:${previousObject.id ?? previousObject.title}`) ===
              duplicateKey
          )
        }),
      ].slice(0, 12)
    : nextSnapshot.sourceObjects
  const mergedRouteProgress = nextSnapshot.routeProgress ?? previousSnapshot.routeProgress

  return {
    ...nextSnapshot,
    paperClueLabel: hasPaperEvidence ? previousSnapshot.paperClueLabel ?? nextSnapshot.paperClueLabel : nextSnapshot.paperClueLabel,
    paperTitle: hasPaperEvidence ? previousSnapshot.paperTitle : nextSnapshot.paperTitle,
    inputKind: hasPaperEvidence ? previousSnapshot.inputKind : nextSnapshot.inputKind,
    primaryEquation: hasPaperEvidence ? previousSnapshot.primaryEquation ?? nextSnapshot.primaryEquation : nextSnapshot.primaryEquation,
    sourceObjects: mergedSourceObjects,
    currentObject: hasPaperEvidence ? previousSnapshot.currentObject ?? nextSnapshot.currentObject : nextSnapshot.currentObject,
    groundingStatus: hasPaperEvidence ? previousSnapshot.groundingStatus ?? nextSnapshot.groundingStatus : nextSnapshot.groundingStatus,
    routeProgress: mergedRouteProgress,
    lastObservation: previousSnapshot.lastObservation ?? nextSnapshot.lastObservation,
  }
}

function hasSavedCurrentObjectAction(snapshot: LearningRouteSnapshot | null) {
  const objectKey = snapshot?.currentObject?.objectKey
  return Boolean(objectKey && getLocalObjectActionDraft(objectKey))
}

export default function GraphProductNavigator() {
  const router = useRouter()
  const [activePathId, setActivePathId] = useState(paths[0].id)
  const [savedSnapshot, setSavedSnapshot] = useState<LearningRouteSnapshot | null>(null)
  const [routeSaveStatus, setRouteSaveStatus] = useState<'idle' | 'saved'>('idle')
  const activePath = useMemo(
    () => paths.find((path) => path.id === activePathId) ?? paths[0],
    [activePathId]
  )
  const routeParam = normalizeLearningRoutePathId(queryValue(router.query.route))
  const isCarriedFromMapper = ['paper-map', 'home'].includes(queryValue(router.query.from) ?? '')
  const carriedRoute = savedSnapshot ?? null
  const shouldShowCarriedRoute = Boolean(carriedRoute || isCarriedFromMapper)
  const carriedBannerSnapshot = useMemo(
    () => carriedRoute ?? (isCarriedFromMapper ? graphRouteSnapshot(activePath) : null),
    [activePath, carriedRoute, isCarriedFromMapper]
  )
  const activePathSaved = normalizeLearningRoutePathId(savedSnapshot?.mappingId) === activePath.id
  const activePathDiscussionItems = useMemo(() => graphDiscussionItems(activePath), [activePath])
  const activeWorkbench = useMemo(() => routeWorkbenchForPath(activePath), [activePath])

  useEffect(() => {
    if (!router.isReady) return

    const snapshot = getSavedLearningRouteSnapshot()
    const snapshotPathId = normalizeLearningRoutePathId(snapshot?.mappingId)

    const nextPathId = routeParam ?? snapshotPathId
    if (nextPathId && paths.some((path) => path.id === nextPathId)) {
      setActivePathId(nextPathId)
    }

    const nextPath = paths.find((path) => path.id === nextPathId)
    if (routeParam && nextPath && snapshotPathId !== routeParam && hasSavedCurrentObjectAction(snapshot)) {
      setSavedSnapshot(snapshot)
      return
    }

    if (routeParam && nextPath && snapshotPathId !== routeParam) {
      const nextSnapshot = preserveMatchingObservation(graphRouteSnapshot(nextPath), snapshot)
      saveLearningRouteSnapshot(nextSnapshot)
      setSavedSnapshot(nextSnapshot)
      return
    }

    setSavedSnapshot(snapshot)
  }, [router.isReady, routeParam])

  useEffect(() => {
    setRouteSaveStatus('idle')
  }, [activePathId])

  const saveActivePath = () => {
    const nextSnapshot = preserveMatchingObservation(graphRouteSnapshot(activePath), getSavedLearningRouteSnapshot())
    saveLearningRouteSnapshot(nextSnapshot)
    setSavedSnapshot(nextSnapshot)
    setRouteSaveStatus('saved')
  }

  const clearCarriedRoute = () => {
    clearLearningRouteSnapshot()
    setSavedSnapshot(null)
    void router.replace('/graph/#learning-route', undefined, { shallow: true })
  }

  const focusDiscussionObject = (item: DiscussionAnchorListItem) => {
    const focusedObject = routeSourceObjectFromDiscussionItem(item)
    const baseSnapshot = activePathSaved && savedSnapshot ? savedSnapshot : graphRouteSnapshot(activePath)
    const nextSnapshot: LearningRouteSnapshot = {
      ...baseSnapshot,
      sourceObjects: [
        focusedObject,
        ...(baseSnapshot.sourceObjects ?? []).filter(
          (object) => object.discussionAnchorId !== focusedObject.discussionAnchorId
        ),
      ].slice(0, 12),
      currentObject: focusedObject,
    }

    saveLearningRouteSnapshot(nextSnapshot)
    setSavedSnapshot(nextSnapshot)
    setRouteSaveStatus('saved')
  }

  return (
    <section id="learning-route" className="graph-navigator" aria-labelledby="graph-product-title">
      <div className="section-header">
        <p className="eyebrow">Learning Route</p>
        <h2 id="graph-product-title">Ask the graph what to learn next.</h2>
        <p>
          Pick a question and the graph turns it into prerequisites, equations, labs, and honest links between ideas.
          When you arrive from the mapper, your current paper route stays visible.
        </p>
      </div>

      {shouldShowCarriedRoute ? (
        <LearningRouteContinuityBanner surface="graph" snapshot={carriedBannerSnapshot} onClear={clearCarriedRoute} compact />
      ) : null}

      <div className="query-layout">
        <div className="query-list" aria-label="Path queries">
          {paths.map((path) => (
            <button
              key={path.id}
              type="button"
              className={path.id === activePath.id ? 'active' : ''}
              onClick={() => setActivePathId(path.id)}
            >
              <span>{path.audience}</span>
              {path.prompt}
            </button>
          ))}
        </div>

        <div className="answer-panel">
          <p className="eyebrow">Answer</p>
          <h3>{activePath.prompt}</h3>
          <p>{activePath.answer}</p>
          <div className="answer-actions">
            <button type="button" onClick={saveActivePath}>
              {activePathSaved ? 'Update saved route' : 'Save this route'}
            </button>
            <Link href={searchHrefForPath(activePath)}>Search this route</Link>
            <span>
              {routeSaveStatus === 'saved'
                ? 'Saved in this browser.'
                : activePathSaved
                  ? 'This is the current saved route.'
                  : 'Preview only; your saved route is unchanged.'}
            </span>
          </div>

          <div className="route-workbench" aria-label="Route role workbench" data-testid="graph-route-workbench">
            <article className="route-mode primary">
              <span>Learner Repair</span>
              <strong>{activeWorkbench.repairNode?.label ?? activePath.nodes[0]?.label}</strong>
              <p>{activeWorkbench.repairNode?.role ?? activePath.answer}</p>
              {activeWorkbench.repairNode?.href ? (
                <Link href={activeWorkbench.repairNode.href}>Open {activeWorkbench.repairNode.label}</Link>
              ) : (
                <Link href={searchHrefForPath(activePath)}>Search repair</Link>
              )}
            </article>
            <article className="route-mode">
              <span>Researcher Object</span>
              <strong>{activeWorkbench.researchObject?.title ?? activePath.prompt}</strong>
              <p>{activeWorkbench.researchObject?.prompt ?? activeWorkbench.researchObject?.status ?? activePath.audience}</p>
              <Link href="#graph-route-research-room">Open research room</Link>
            </article>
            <article className="route-mode">
              <span>Experimenter Lab</span>
              <strong>{activeWorkbench.labObject?.title ?? 'Route witness'}</strong>
              <p>{activeWorkbench.labObject?.status ?? 'local preview'}</p>
              <Link href={activeWorkbench.experimentHref}>{activeWorkbench.experimentActionLabel}</Link>
            </article>
            <article className="route-mode">
              <span>Professor Edge</span>
              <strong>
                {activeWorkbench.edge?.from ?? activePath.nodes[0]?.label}
                {' -> '}
                {activeWorkbench.edge?.to ?? activePath.nodes[1]?.label}
              </strong>
              <p>{activeWorkbench.edge?.why ?? activePath.answer}</p>
              <Link href="#edge-title">Explain edge</Link>
            </article>
          </div>

          <div className="path-strip" aria-label="Recommended concept path">
            {activePath.nodes.map((node, index) => {
              const body = (
                <>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{node.label}</strong>
                  <em>{node.role}</em>
                  {node.status === 'planned' ? <b>planned</b> : null}
                </>
              )

              return node.href ? (
                <Link key={`${node.label}-${index}`} href={node.href} className="path-node">
                  {body}
                </Link>
              ) : (
                <div key={`${node.label}-${index}`} className="path-node pending">
                  {body}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <GraphRouteEngine
        savedSnapshot={savedSnapshot}
        onSaveSnapshot={(nextSnapshot) => {
          const mergedSnapshot = preserveMatchingObservation(nextSnapshot, getSavedLearningRouteSnapshot())
          saveLearningRouteSnapshot(mergedSnapshot)
          setSavedSnapshot(mergedSnapshot)
        }}
      />

      <div className="graph-objects-grid">
        <section className="edge-panel" aria-labelledby="edge-title">
          <p className="eyebrow">Typed Edges</p>
          <h3 id="edge-title">Why the route is honest</h3>
          <div className="edge-list">
            {activePath.edges.map((edge) => (
              <article key={`${edge.from}-${edge.to}-${edge.type}`}>
                <span>{edge.type}</span>
                <strong>
                  {edge.from}
                  {' -> '}
                  {edge.to}
                </strong>
                <p>{edge.why}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="object-panel" aria-labelledby="object-title">
          <p className="eyebrow">Learning Objects</p>
          <h3 id="object-title">What anchors this route</h3>
          <div className="object-list">
            {activePath.objects.map((object) => (
              <article key={`${object.type}-${object.id}`}>
                <span>{object.type}</span>
                <strong>{object.title}</strong>
                <p>{object.status}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div id="graph-route-research-room">
        <ResearchReadingRoom
          eyebrow="Research Room"
          title="Resolve the route object before moving on"
          intro="Pick a paper, equation, lab, claim, or misconception. The selected object becomes the saved route focus for the next companion prompt."
          items={activePathDiscussionItems}
          variant="compact"
          showAnchorIds
          onFocusObject={focusDiscussionObject}
        />
      </div>

      <style jsx>{`
        .graph-navigator {
          display: grid;
          gap: 1rem;
          min-width: 0;
          padding: 1.1rem;
          border-radius: 24px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(180deg, rgba(255, 251, 245, 0.78), rgba(248, 243, 234, 0.92)),
            radial-gradient(circle at 12% 16%, rgba(31, 111, 120, 0.1), transparent 32%),
            radial-gradient(circle at 88% 18%, rgba(194, 74, 45, 0.1), transparent 30%);
        }

        .section-header {
          max-width: 62rem;
        }

        .route-snapshot-banner {
          display: grid;
          gap: 0.8rem;
          min-width: 0;
          padding: 0.95rem;
          border-radius: 20px;
          border: 1px solid rgba(31, 111, 120, 0.16);
          background:
            linear-gradient(180deg, rgba(247, 252, 250, 0.92), rgba(255, 251, 245, 0.92)),
            linear-gradient(90deg, rgba(31, 111, 120, 0.1), rgba(194, 74, 45, 0.08));
        }

        .route-snapshot-banner h3 {
          max-width: 52rem;
        }

        .route-snapshot-banner p {
          margin: 0.65rem 0 0;
          color: #455361;
          line-height: 1.55;
        }

        .snapshot-facts {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 0.55rem;
          min-width: 0;
        }

        .snapshot-facts article {
          display: grid;
          gap: 0.32rem;
          min-width: 0;
          padding: 0.68rem;
          border-radius: 15px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.78);
        }

        .snapshot-facts span {
          font-family: var(--font-mono);
          font-size: 0.64rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #c24a2d;
        }

        .snapshot-facts strong {
          color: #151d27;
          line-height: 1.35;
        }

        .snapshot-observation {
          display: grid;
          gap: 0.32rem;
          min-width: 0;
          padding: 0.72rem;
          border-radius: 15px;
          border: 1px solid rgba(31, 111, 120, 0.16);
          background: rgba(231, 248, 244, 0.76);
        }

        .snapshot-observation span {
          font-family: var(--font-mono);
          font-size: 0.64rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        .snapshot-observation strong {
          color: #151d27;
          line-height: 1.35;
        }

        .snapshot-observation p {
          margin: 0;
          color: #455361;
          line-height: 1.5;
        }

        .snapshot-observation em {
          color: #455361;
          font-size: 0.82rem;
          font-style: normal;
          line-height: 1.5;
        }

        .snapshot-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .snapshot-actions :global(a),
        .snapshot-actions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0.55rem 0.76rem;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: #1b2430;
          color: #fbf4e8;
          font: inherit;
          font-weight: 700;
          text-decoration: none;
        }

        .snapshot-actions :global(a:nth-child(2)),
        .snapshot-actions button {
          background: rgba(255, 251, 245, 0.9);
          color: #1b2430;
        }

        .snapshot-actions :global(a:hover),
        .snapshot-actions button:hover {
          border-color: rgba(31, 111, 120, 0.28);
          background: #1f6f78;
          color: #fbf4e8;
          text-shadow: none;
          transform: translateY(-1px);
        }

        .eyebrow {
          margin: 0 0 0.55rem;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        h2,
        h3,
        p,
        strong,
        em,
        b {
          overflow-wrap: break-word;
        }

        h2,
        h3 {
          margin: 0;
          color: #151d27;
          line-height: 1.05;
        }

        h2::before,
        h3::before {
          content: none;
          display: none;
        }

        h2 {
          max-width: 16ch;
          font-family: var(--font-display);
          font-size: clamp(2rem, 4vw, 3.15rem);
        }

        h3 {
          font-size: clamp(1.3rem, 2.2vw, 1.65rem);
        }

        .section-header p,
        .answer-panel > p,
        .edge-list p,
        .object-list p {
          margin: 0.75rem 0 0;
          color: #455361;
          line-height: 1.68;
        }

        .query-layout,
        .graph-objects-grid {
          display: grid;
          grid-template-columns: minmax(260px, 0.42fr) minmax(0, 1fr);
          gap: 0.85rem;
          min-width: 0;
        }

        .query-list,
        .answer-panel,
        .edge-panel,
        .object-panel {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.09);
          border-radius: 20px;
          background: rgba(255, 251, 245, 0.84);
          box-shadow: 0 16px 32px rgba(27, 36, 48, 0.05);
        }

        .query-list {
          display: grid;
          gap: 0.55rem;
          padding: 0.8rem;
        }

        button {
          display: grid;
          gap: 0.38rem;
          min-height: 74px;
          padding: 0.78rem;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 16px;
          background: rgba(255, 251, 245, 0.9);
          color: #1b2430;
          font: inherit;
          text-align: left;
          cursor: pointer;
        }

        button span {
          font-family: var(--font-mono);
          font-size: 0.66rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #5b6874;
        }

        button.active,
        button:hover {
          border-color: rgba(194, 74, 45, 0.28);
          background: rgba(255, 244, 238, 0.9);
          transform: translateY(-1px);
        }

        button:focus-visible,
        .path-node:focus-visible {
          outline: 2px solid rgba(31, 111, 120, 0.35);
          outline-offset: 2px;
        }

        .answer-panel,
        .edge-panel,
        .object-panel {
          padding: 0.95rem;
        }

        .answer-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem;
          align-items: center;
          margin-top: 0.9rem;
        }

        .answer-actions button,
        .answer-actions :global(a) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0.58rem 0.82rem;
          border-color: rgba(31, 111, 120, 0.24);
          color: #fbf4e8;
          font-weight: 750;
          text-decoration: none;
          text-align: center;
        }

        .answer-actions button {
          background: #1f6f78;
        }

        .answer-actions :global(a) {
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.92);
          color: #1b2430;
        }

        .answer-actions :global(a:hover) {
          border-color: rgba(31, 111, 120, 0.28);
          background: #1f6f78;
          color: #fbf4e8;
          transform: translateY(-1px);
        }

        .answer-actions span {
          color: #5b6874;
          font-size: 0.86rem;
          line-height: 1.45;
        }

        .route-workbench {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 0.9rem;
          overflow: hidden;
          border: 1px solid rgba(31, 111, 120, 0.14);
          border-radius: 8px;
          background: rgba(247, 252, 250, 0.62);
        }

        .route-mode {
          display: grid;
          align-content: start;
          gap: 0.36rem;
          min-width: 0;
          padding: 0.72rem;
          border-right: 1px solid rgba(31, 111, 120, 0.12);
        }

        .route-mode:last-child {
          border-right: 0;
        }

        .route-mode.primary {
          background: rgba(231, 248, 244, 0.66);
        }

        .route-mode span {
          font-family: var(--font-mono);
          font-size: 0.62rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        .route-mode strong {
          color: #151d27;
          line-height: 1.22;
        }

        .route-mode p {
          margin: 0;
          color: #52606c;
          font-size: 0.86rem;
          line-height: 1.42;
        }

        .route-mode :global(a) {
          align-self: end;
          width: fit-content;
          max-width: 100%;
          min-height: 32px;
          margin-top: 0.1rem;
          padding: 0.42rem 0.56rem;
          border: 1px solid rgba(31, 111, 120, 0.18);
          border-radius: 999px;
          background: rgba(255, 251, 245, 0.88);
          color: #1b2430;
          font-size: 0.82rem;
          font-weight: 750;
          line-height: 1.15;
          text-decoration: none;
        }

        .route-mode :global(a:hover) {
          border-color: rgba(31, 111, 120, 0.3);
          background: #1f6f78;
          color: #fbf4e8;
          text-shadow: none;
        }

        .path-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.55rem;
          margin-top: 1rem;
        }

        .path-strip :global(.path-node),
        .path-node {
          display: grid;
          align-content: start;
          gap: 0.36rem;
          min-height: 118px;
          padding: 0.75rem;
          border-radius: 16px;
          border: 1px solid rgba(27, 36, 48, 0.09);
          background: rgba(255, 251, 245, 0.94);
          color: #1b2430;
          text-decoration: none;
        }

        .path-strip :global(.path-node:hover) {
          color: #1f6f78;
          transform: translateY(-2px);
          text-shadow: none;
        }

        .path-node.pending {
          background: rgba(239, 232, 219, 0.72);
        }

        .path-node span {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          color: #c24a2d;
        }

        .path-node strong {
          color: #151d27;
          line-height: 1.22;
        }

        .path-node em,
        .path-node b {
          color: #5b6874;
          font-style: normal;
          line-height: 1.35;
        }

        .path-node b {
          display: inline-flex;
          width: max-content;
          max-width: 100%;
          padding: 0.22rem 0.45rem;
          border-radius: 999px;
          background: rgba(31, 111, 120, 0.1);
          font-family: var(--font-mono);
          font-size: 0.66rem;
          text-transform: uppercase;
        }

        .edge-list,
        .object-list {
          display: grid;
          gap: 0.6rem;
          margin-top: 0.85rem;
        }

        .edge-list article,
        .object-list article {
          min-width: 0;
          padding: 0.78rem;
          border-radius: 16px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.78);
        }

        .edge-list span,
        .object-list span {
          display: inline-flex;
          margin-bottom: 0.42rem;
          font-family: var(--font-mono);
          font-size: 0.66rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #c24a2d;
        }

        .edge-list strong,
        .object-list strong {
          display: block;
          color: #151d27;
          line-height: 1.35;
        }

        @media (max-width: 1120px) {
          .query-layout,
          .graph-objects-grid {
            grid-template-columns: 1fr;
          }

          .path-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .route-workbench {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .route-mode:nth-child(2n) {
            border-right: 0;
          }

          .route-mode:nth-child(n + 3) {
            border-top: 1px solid rgba(31, 111, 120, 0.12);
          }

          .snapshot-facts {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .graph-navigator {
            padding: 0.9rem;
            border-radius: 20px;
          }

          h2 {
            max-width: 100%;
          }

          .path-strip {
            grid-template-columns: 1fr;
          }

          .route-workbench {
            grid-template-columns: 1fr;
          }

          .route-mode,
          .route-mode:nth-child(2n) {
            border-right: 0;
          }

          .route-mode:nth-child(n + 2) {
            border-top: 1px solid rgba(31, 111, 120, 0.12);
          }
        }
      `}</style>
    </section>
  )
}
