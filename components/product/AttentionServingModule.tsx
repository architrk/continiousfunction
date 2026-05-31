import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import {
  clearLearningRouteSnapshot,
  getSavedLearningRouteSnapshot,
  saveLearningRouteSnapshot,
  type LearningRouteProgress,
  type LearningRouteSourceObject,
  type LearningRouteSnapshot,
} from '@/lib/learningRouteSnapshot'
import { kvMemoryEquation, kvMemoryQuestion } from '@/lib/learningRouteConstants'
import ResearchReadingRoom from '@/components/discussion/ResearchReadingRoom'
import LearningCompanionPanel from '@/components/ai/LearningCompanionPanel'
import {
  buildDiscussionAnchor,
  buildDiscussionPlaceholder,
  type DiscussionAnchorListItem,
  type DiscussionObjectType,
} from '@/lib/discussionAnchors'
import { routeSourceObjectFromDiscussionItem } from '@/lib/researchDiscussionRoom'

type Stage = {
  id: string
  label: string
  href: string
  role: string
  question: string
  output: string
}

type EquationObject = {
  id: string
  label: string
  equation: string
  source: string
  conceptHref: string
  symbols: Array<{ symbol: string; meaning: string; shape: string }>
  stressTest: string
}

type AttentionDiscussionSeed = {
  id: string
  objectType: Extract<DiscussionObjectType, 'claim' | 'equation' | 'toy-experiment' | 'misconception'>
  title: string
  contextLabel: string
  prompt: string
}

type PredictionChoice = {
  id: 'h-kv' | 'tokens' | 'bytes' | 'layers'
  label: string
  symbol: string
  correct: boolean
  feedback: string
}

type DecodePredictionChoice = {
  id: 'top-k-binding' | 'temperature-restores' | 'top-p-controls' | 'raw-logits'
  label: string
  mechanism: string
  correct: boolean
  feedback: string
}

type RouteObjectFocus = {
  id: string
  eyebrow: string
  label: string
  description: string
  context: string
  sourceObject: LearningRouteSourceObject
}

type PathRoleLens = {
  label: string
  cue: string
  detail: string
  objectId: string
  scrollId: string
  stageId?: string
  equationId?: string
}

const stages: Stage[] = [
  {
    id: 'attention',
    label: 'Attention',
    href: '/domains/attention-transformers/attention-transformers/',
    role: 'content-addressed weighted copy',
    question: 'Which previous tokens should this query copy from?',
    output: 'A weighted value vector per head.',
  },
  {
    id: 'efficient-attention',
    label: 'Efficient Attention',
    href: '/domains/attention-transformers/efficient-attention/',
    role: 'same math under memory pressure',
    question: 'What state must be kept so decode does not recompute the past?',
    output: 'A KV cache plus head-sharing tradeoffs.',
  },
  {
    id: 'rope',
    label: 'RoPE',
    href: '/domains/attention-transformers/rope/',
    role: 'relative position geometry',
    question: 'How does position change the dot product without adding a separate bias table?',
    output: 'Rotated query/key coordinates.',
  },
  {
    id: 'flash-attention',
    label: 'FlashAttention',
    href: '/domains/attention-transformers/flash-attention/',
    role: 'IO-aware exact attention',
    question: 'Can we avoid materializing the attention matrix?',
    output: 'Streaming softmax state in fast memory.',
  },
  {
    id: 'long-context',
    label: 'Long Context',
    href: '/domains/attention-transformers/long-context/',
    role: 'stress regime',
    question: 'What breaks first as context grows: position, memory, or retrieval quality?',
    output: 'A list of pressure points to measure.',
  },
  {
    id: 'llm-serving',
    label: 'LLM Serving',
    href: '/domains/llm-systems/llm-serving/',
    role: 'runtime bottleneck model',
    question: 'Is this request prefill-bound, decode-bound, or cache-bound?',
    output: 'TTFT, TPOT, goodput, and memory budgets.',
  },
  {
    id: 'decoding',
    label: 'Decoding',
    href: '/domains/llm-systems/decoding-sampling/',
    role: 'token loop policy',
    question: 'Which next-token policy trades diversity against reliability?',
    output: 'Temperature, top-k, and top-p behavior.',
  },
]

const equations: EquationObject[] = [
  {
    id: 'attention',
    label: 'Scaled dot-product attention',
    equation: 'Attn(Q,K,V) = softmax(QK^T / sqrt(d_k)) V',
    source: 'Attention',
    conceptHref: '/domains/attention-transformers/attention-transformers/',
    symbols: [
      { symbol: 'Q', meaning: 'queries for current tokens', shape: 'T_q x d_k' },
      { symbol: 'K', meaning: 'keys for available tokens', shape: 'T_k x d_k' },
      { symbol: 'V', meaning: 'values copied by attention weights', shape: 'T_k x d_v' },
      { symbol: 'd_k', meaning: 'key/query head width', shape: 'scalar' },
    ],
    stressTest: 'Remove the scale and large dot products make softmax too sharp early in training.',
  },
  {
    id: 'kv',
    label: 'KV cache memory',
    equation: kvMemoryEquation,
    source: 'Efficient Attention / LLM Serving',
    conceptHref: '/domains/attention-transformers/efficient-attention/',
    symbols: [
      { symbol: 'B', meaning: 'active batch size', shape: 'scalar' },
      { symbol: 'N_layers', meaning: 'number of transformer layers', shape: 'scalar' },
      { symbol: 'T', meaning: 'cached tokens per sequence', shape: 'scalar' },
      { symbol: 'H_kv', meaning: 'key/value heads after MHA, GQA, or MQA sharing', shape: 'scalar' },
      { symbol: 'd_head', meaning: 'width of each key/value head', shape: 'scalar' },
      { symbol: '2', meaning: 'keys plus values are both cached', shape: 'constant' },
      { symbol: 'bytes', meaning: 'bytes per scalar for the chosen precision', shape: 'scalar' },
    ],
    stressTest: 'Double the context and this term doubles. During decode it is touched on every generated token.',
  },
  {
    id: 'gqa',
    label: 'Grouped-query attention',
    equation: 'o_h = softmax(Q_h K_g(h)^T / sqrt(d_k)) V_g(h)',
    source: 'Efficient Attention',
    conceptHref: '/domains/attention-transformers/efficient-attention/',
    symbols: [
      { symbol: 'h', meaning: 'query head index', shape: '1..H_q' },
      { symbol: 'g(h)', meaning: 'map from query head to shared KV head', shape: '1..H_kv' },
      { symbol: 'K_g(h), V_g(h)', meaning: 'shared key/value tensors for a group', shape: 'T x d_head' },
    ],
    stressTest: 'Reduce H_kv and memory falls, but too much sharing can remove useful head-specific retrieval.',
  },
  {
    id: 'latency',
    label: 'Serving latency',
    equation: 'Latency ~= TTFT + (T_out - 1) * TPOT',
    source: 'LLM Serving',
    conceptHref: '/domains/llm-systems/llm-serving/',
    symbols: [
      { symbol: 'TTFT', meaning: 'time to first token, often prefill-heavy', shape: 'milliseconds' },
      { symbol: 'TPOT', meaning: 'time per output token, often decode-heavy', shape: 'milliseconds/token' },
      { symbol: 'T_out', meaning: 'number of generated tokens', shape: 'tokens' },
    ],
    stressTest: 'A model can have fine average latency and still fail if TPOT tails break an interactive SLO.',
  },
]

const discussionSeeds: AttentionDiscussionSeed[] = [
  {
    id: 'what-is-compressed',
    objectType: 'claim',
    title: 'KV compression claim',
    contextLabel: 'Paper claim',
    prompt: 'What exactly is being compressed: heads, tokens, values, precision, or cache pages?',
  },
  {
    id: 'kv-memory-symbol',
    objectType: 'equation',
    title: 'Mem_KV equation',
    contextLabel: 'Equation',
    prompt: 'Which symbol does the proposed method reduce, and which symbols stay unchanged?',
  },
  {
    id: 'gqa-comparison-lab',
    objectType: 'toy-experiment',
    title: 'GQA comparison lab',
    contextLabel: 'Toy experiment',
    prompt: 'At what context length does MQA become necessary, and what quality risk would you test first?',
  },
  {
    id: 'latency-throughput-confusion',
    objectType: 'misconception',
    title: 'Latency vs throughput confusion',
    contextLabel: 'Systems misconception',
    prompt: 'Is the serving win visible in first-token latency, decode latency, throughput, or only memory capacity?',
  },
]

const attentionCompanionSeeds = [
  {
    id: 'inspect-paper-claim',
    label: 'Check Claim',
    prompt:
      'Help me inspect a paper claim about KV cache compression. Identify which symbol or system bottleneck the claim changes, what remains fixed, and what evidence I should ask for before believing it.',
  },
  {
    id: 'explain-equation-object',
    label: 'Explain Equation',
    prompt:
      'Explain the active equation object in this route. Define every symbol, give shapes or units, and connect the equation to the current serving tradeoff.',
  },
  {
    id: 'diagnose-lab-observation',
    label: 'Diagnose Lab',
    prompt:
      'Use the current KV memory lab settings or saved observation to diagnose what changed, what stayed invariant, and the next failure mode I should test.',
  },
  {
    id: 'research-discussion',
    label: 'Research Thread',
    prompt:
      'Turn my confusion into a precise research discussion question attached to a concept, equation, claim, toy experiment, or misconception on this route.',
  },
]

function attentionDiscussionItems(): DiscussionAnchorListItem[] {
  return discussionSeeds.flatMap((seed) => {
    const anchor = buildDiscussionAnchor({
      objectType: seed.objectType,
      surface: 'attention-serving',
      segments: [seed.id],
      title: seed.title,
      contextLabel: seed.contextLabel,
    })
    if (!anchor) return []

    const thread = buildDiscussionPlaceholder(anchor, seed.prompt)
    return thread ? [{ anchor, thread }] : []
  })
}

function attentionServingSourceObjects(): LearningRouteSourceObject[] {
  const conceptObjects: LearningRouteSourceObject[] = stages.map((stage) => ({
    type: 'concept',
    id: stage.id,
    title: stage.label,
    href: stage.href,
    role: stage.role,
    status: 'live route concept',
  }))

  const discussionObjects: LearningRouteSourceObject[] = discussionSeeds.flatMap((seed) => {
    const anchor = buildDiscussionAnchor({
      objectType: seed.objectType,
      surface: 'attention-serving',
      segments: [seed.id],
      title: seed.title,
      contextLabel: seed.contextLabel,
    })

    return [
      {
        type: seed.objectType,
        id: seed.id,
        discussionAnchorId: anchor?.id,
        title: seed.title,
        role: seed.prompt,
        status: 'discussion placeholder',
      },
    ]
  })

  return [...conceptObjects, ...discussionObjects].slice(0, 12)
}

const decodeTokens = [
  { token: 'cache', logit: 3.2 },
  { token: 'memory', logit: 2.7 },
  { token: 'latency', logit: 2.25 },
  { token: 'quality', logit: 1.45 },
  { token: 'paper', logit: 0.85 },
  { token: 'noise', logit: 0.2 },
]

const bytesOptions = [
  { label: 'fp32', value: 4 },
  { label: 'fp16 / bf16', value: 2 },
  { label: 'int8', value: 1 },
]

const kvPredictionChoices: PredictionChoice[] = [
  {
    id: 'h-kv',
    label: 'KV heads',
    symbol: 'H_kv',
    correct: true,
    feedback: 'GQA and MQA share keys and values across query heads, so they directly reduce H_kv while the other displayed memory terms stay fixed. Too much sharing can reduce head-specific retrieval capacity, so quality is the next thing to test.',
  },
  {
    id: 'tokens',
    label: 'Cached tokens',
    symbol: 'T',
    correct: false,
    feedback: 'T is the cached context length. Sliding windows, eviction, retrieval, or shorter context reduce T; GQA/MQA head sharing does not.',
  },
  {
    id: 'bytes',
    label: 'Precision',
    symbol: 'bytes',
    correct: false,
    feedback: 'bytes is the right lever for precision or KV-cache quantization. It can combine with GQA/MQA, but it is not the symbol reduced by head sharing.',
  },
  {
    id: 'layers',
    label: 'Layers',
    symbol: 'N_layers',
    correct: false,
    feedback: 'Depth multiplies the cache because every layer stores K/V. Head sharing changes the cache width, not the number of layers.',
  },
]

const decodePredictionChoices: DecodePredictionChoice[] = [
  {
    id: 'top-k-binding',
    label: 'One token survives: top-k is binding.',
    mechanism: 'top-k',
    correct: true,
    feedback:
      'Correct. Temperature can flatten or sharpen probabilities, but top-k = 1 then keeps only the highest-ranked token. After filtering, that survivor is renormalized to probability 1.',
  },
  {
    id: 'temperature-restores',
    label: 'Many tokens return because temperature is high.',
    mechanism: 'temperature',
    correct: false,
    feedback:
      'Not quite. Temperature reshapes probabilities before filtering, but filtering is destructive. Once top-k = 1 is applied, every non-top token has zero sampling probability.',
  },
  {
    id: 'top-p-controls',
    label: 'Top-p controls the result.',
    mechanism: 'top-p',
    correct: false,
    feedback:
      'Not here. Top-p can further remove tokens, but with top-k = 1 there is already only one candidate. It is not the binding constraint in this probe.',
  },
  {
    id: 'raw-logits',
    label: 'Raw logits decide everything, so filtering has no effect.',
    mechanism: 'logits',
    correct: false,
    feedback:
      'Raw logits can stay the same while the sampling distribution changes. The sampler uses transformed probabilities after temperature, filtering, and renormalization.',
  },
]

function kvGb(context: number, layers: number, hKv: number, dHead: number, batch: number, bytes: number) {
  return (batch * layers * context * hKv * dHead * 2 * bytes) / 1e9
}

function formatGb(value: number) {
  return value >= 100 ? `${value.toFixed(0)} GB` : `${value.toFixed(1)} GB`
}

function softmaxWithTemperature(logits: number[], temperature: number) {
  const scaled = logits.map((logit) => logit / temperature)
  const max = Math.max(...scaled)
  const exp = scaled.map((value) => Math.exp(value - max))
  const total = exp.reduce((sum, value) => sum + value, 0)
  return exp.map((value) => value / total)
}

function filteredDistribution(temperature: number, topK: number, topP: number) {
  const probabilities = softmaxWithTemperature(decodeTokens.map((token) => token.logit), temperature)
  const ranked = decodeTokens
    .map((token, index) => ({ ...token, probability: probabilities[index] }))
    .sort((a, b) => b.probability - a.probability)

  const topKSet = new Set(ranked.slice(0, topK).map((item) => item.token))
  let cumulative = 0
  const kept = ranked.filter((item) => {
    cumulative += item.probability
    return topKSet.has(item.token) && cumulative - item.probability < topP
  })
  const keptTotal = kept.reduce((sum, item) => sum + item.probability, 0)

  return ranked.map((item) => {
    const isKept = kept.some((keptItem) => keptItem.token === item.token)

    return {
      ...item,
      kept: isKept,
      normalized: isKept && keptTotal > 0 ? item.probability / keptTotal : 0,
    }
  })
}

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function conceptIdFromHref(href: string) {
  return href.split('/').filter(Boolean).at(-1) ?? ''
}

function defaultAttentionCurrentObject(): LearningRouteSourceObject {
  return {
    type: 'equation',
    id: 'kv',
    title: 'KV cache memory',
    href: '/domains/attention-transformers/efficient-attention/',
    role: 'Default focused equation object',
    status: 'selected',
  }
}

function sourceObjectTypeLabel(type: LearningRouteSourceObject['type']) {
  return type.replaceAll('-', ' ')
}

function groundingLabel(status: LearningRouteSnapshot['groundingStatus']) {
  switch (status) {
    case 'metadata-resolved':
      return 'metadata resolved'
    case 'source-checked':
      return 'source check ran'
    case 'source-check-error':
      return 'source check failed'
    case 'local-preview':
    default:
      return 'local preview only'
  }
}

function sourceIdsLabel(sourceIds?: string[]) {
  return sourceIds?.length ? sourceIds.join(', ') : 'source ids pending'
}

function paperEvidenceObjects(snapshot: LearningRouteSnapshot | null) {
  return (snapshot?.sourceObjects ?? []).filter(
    (object) =>
      object.type === 'paper' ||
      object.type === 'equation' ||
      object.type === 'claim' ||
      object.sourceIds?.length ||
      object.sourceDetail ||
      object.confidence
  )
}

function shouldShowPaperSourceRail(snapshot: LearningRouteSnapshot | null) {
  if (!snapshot) return false
  return snapshot.source === 'paper-map' || paperEvidenceObjects(snapshot).some((object) => object.sourceIds?.length || object.sourceDetail || object.confidence)
}

function paperEvidenceContext(snapshot: LearningRouteSnapshot | null) {
  if (!shouldShowPaperSourceRail(snapshot)) return 'Paper evidence carried: none.'

  const evidence = paperEvidenceObjects(snapshot).slice(0, 6)
  return [
    `Paper evidence carried: ${snapshot?.paperClueLabel ?? snapshot?.paperTitle ?? 'paper clue pending'}`,
    `Grounding: ${groundingLabel(snapshot?.groundingStatus)}`,
    snapshot?.primaryEquation
      ? `Primary equation: ${snapshot.primaryEquation.label} (${snapshot.primaryEquation.confidence}); source ${snapshot.primaryEquation.sourceLabel ?? 'pending'}`
      : undefined,
    ...evidence.map((object) =>
      [
        `${sourceObjectTypeLabel(object.type)}: ${object.title}`,
        object.confidence ? `confidence ${object.confidence}` : undefined,
        object.sourceDetail,
        object.sourceIds?.length ? `source ids ${object.sourceIds.join(', ')}` : undefined,
      ]
        .filter(Boolean)
        .join('; ')
    ),
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')
}

function PaperSourceContinuityRail({ snapshot }: { snapshot: LearningRouteSnapshot | null }) {
  if (!shouldShowPaperSourceRail(snapshot)) return null

  const evidenceObjects = paperEvidenceObjects(snapshot)
  const paperObject = evidenceObjects.find((object) => object.type === 'paper')
  const equationObject =
    snapshot?.currentObject?.type === 'equation'
      ? snapshot.currentObject
      : evidenceObjects.find((object) => object.type === 'equation')
  const claimObjects = evidenceObjects.filter((object) => object.type === 'claim').slice(0, 2)
  const visibleObjects = [paperObject, equationObject, ...claimObjects].filter(
    (object, index, objects): object is LearningRouteSourceObject =>
      Boolean(object) &&
      objects.findIndex(
        (candidate) =>
          candidate?.discussionAnchorId === object?.discussionAnchorId &&
          candidate?.title === object?.title &&
          candidate?.type === object?.type
      ) === index
  )

  return (
    <section className="paper-source-rail" aria-labelledby="paper-source-rail-title">
      <div className="paper-source-heading">
        <p className="eyebrow">Paper Evidence Carried In</p>
        <h3 id="paper-source-rail-title">{snapshot?.paperClueLabel ?? snapshot?.paperTitle ?? 'Paper clue'}</h3>
        <span>
          {groundingLabel(snapshot?.groundingStatus)}
          {snapshot?.inputKind ? ` · ${snapshot.inputKind}` : ''}
        </span>
      </div>

      <div className="source-object-grid">
        {snapshot?.primaryEquation ? (
          <article>
            <span>Primary equation</span>
            <strong>{snapshot.primaryEquation.label}</strong>
            <code>{snapshot.primaryEquation.equation}</code>
            <em>
              {snapshot.primaryEquation.confidence} confidence
              {snapshot.primaryEquation.sourceLabel ? ` · ${snapshot.primaryEquation.sourceLabel}` : ''}
            </em>
          </article>
        ) : null}

        {visibleObjects.map((object) => (
          <article key={`${object.type}-${object.id ?? object.title}`}>
            <span>{sourceObjectTypeLabel(object.type)}</span>
            <strong>{object.title}</strong>
            {object.role ? <p>{object.role}</p> : null}
            <em>
              {object.confidence ? `${object.confidence} confidence · ` : ''}
              {object.sourceDetail ?? object.status ?? 'source detail pending'}
            </em>
            <small>{sourceIdsLabel(object.sourceIds)}</small>
          </article>
        ))}
      </div>

      <style jsx>{`
        .paper-source-rail {
          display: grid;
          gap: 0.8rem;
          min-width: 0;
          padding: 1rem;
          border-radius: 22px;
          border: 1px solid rgba(31, 111, 120, 0.16);
          background:
            linear-gradient(180deg, rgba(247, 252, 250, 0.94), rgba(255, 251, 245, 0.92)),
            linear-gradient(90deg, rgba(31, 111, 120, 0.1), rgba(194, 74, 45, 0.08));
          box-shadow: 0 16px 34px rgba(27, 36, 48, 0.05);
        }

        .paper-source-heading,
        .source-object-grid article {
          min-width: 0;
        }

        .paper-source-heading {
          display: grid;
          gap: 0.34rem;
        }

        .paper-source-heading h3 {
          margin: 0;
          max-width: 58rem;
          color: #151d27;
          font-size: clamp(1.2rem, 2vw, 1.55rem);
          line-height: 1.1;
          overflow-wrap: break-word;
        }

        .paper-source-heading h3::before {
          content: none;
          display: none;
        }

        .paper-source-heading span {
          color: #52606c;
          line-height: 1.45;
          overflow-wrap: break-word;
        }

        .source-object-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 0.55rem;
          min-width: 0;
        }

        .source-object-grid article {
          display: grid;
          gap: 0.34rem;
          min-height: 122px;
          padding: 0.72rem;
          border-radius: 15px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.8);
        }

        .source-object-grid span {
          font-family: var(--font-mono);
          font-size: 0.64rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #c24a2d;
        }

        .source-object-grid strong {
          color: #151d27;
          line-height: 1.35;
          overflow-wrap: break-word;
        }

        .source-object-grid p,
        .source-object-grid em,
        .source-object-grid small {
          margin: 0;
          color: #52606c;
          font-size: 0.82rem;
          font-style: normal;
          line-height: 1.42;
          overflow-wrap: break-word;
        }

        .source-object-grid code {
          padding: 0.42rem;
          border-radius: 10px;
          background: rgba(27, 36, 48, 0.06);
          color: #17202b;
          font-size: 0.8rem;
          line-height: 1.4;
          white-space: normal;
          overflow-wrap: anywhere;
        }
      `}</style>
    </section>
  )
}

function progressObjectId(sourceObject?: LearningRouteSourceObject) {
  if (!sourceObject) return undefined
  return sourceObject.discussionAnchorId ?? `${sourceObject.type}:${sourceObject.id ?? sourceObject.title}`
}

function compactProgressText(value: string | undefined, limit = 180) {
  if (!value) return undefined
  if (value.length <= limit) return value
  if (limit <= 3) return value.slice(0, limit)
  return `${value.slice(0, limit - 3).trimEnd()}...`
}

function buildAttentionRouteProgress({
  activeStage,
  routeSnapshot,
  selectedPredictionChoice,
  selectedDecodePredictionChoice,
  decodeProbeActive,
  focusedObjectId,
}: {
  activeStage: string
  routeSnapshot: LearningRouteSnapshot | null
  selectedPredictionChoice?: PredictionChoice
  selectedDecodePredictionChoice?: DecodePredictionChoice
  decodeProbeActive?: boolean
  focusedObjectId?: string
}): LearningRouteProgress {
  const now = new Date().toISOString()
  const previousProgress = routeSnapshot?.routeProgress
  const readyStageIds = new Set(
    previousProgress?.stageReadiness.filter((stage) => stage.status === 'ready').map((stage) => stage.stageId) ?? []
  )

  if (routeSnapshot || activeStage !== 'attention') readyStageIds.add('attention')
  if (selectedPredictionChoice) readyStageIds.add('attention')
  if (selectedPredictionChoice?.correct || routeSnapshot?.lastObservation) readyStageIds.add('efficient-attention')
  if (routeSnapshot?.lastObservation) {
    readyStageIds.add('long-context')
    readyStageIds.add('llm-serving')
  }
  if (selectedDecodePredictionChoice?.correct || decodeProbeActive) readyStageIds.add('decoding')

  const stageReadiness = stages.map((stage) => {
    const status: LearningRouteProgress['stageReadiness'][number]['status'] = readyStageIds.has(stage.id)
      ? 'ready'
      : stage.id === activeStage
        ? 'active'
        : 'needs-repair'
    const previousStage = previousProgress?.stageReadiness.find((item) => item.stageId === stage.id)
    const evidence =
      status === 'ready'
        ? previousStage?.evidence ??
          (stage.id === 'attention'
            ? 'Route opened and question carried.'
            : stage.id === 'efficient-attention'
              ? 'KV-head prediction or checkpoint completed.'
              : stage.id === 'long-context' || stage.id === 'llm-serving'
                ? 'KV memory checkpoint saved with held-fixed variables.'
                : stage.id === 'decoding'
                  ? 'Decoding prediction probe observed.'
                  : undefined)
        : status === 'active'
          ? 'Current workspace focus.'
          : previousStage?.evidence

    return {
      stageId: stage.id,
      label: stage.label,
      status,
      evidence: compactProgressText(evidence),
      updatedAt: status === previousStage?.status ? previousStage?.updatedAt : now,
    }
  })
  const nextRepair = stageReadiness.find((stage) => stage.status !== 'ready')?.label
  const previousResolved = previousProgress?.resolvedObjectIds ?? []
  const resolvedObjectIds = focusedObjectId
    ? [focusedObjectId, ...previousResolved.filter((id) => id !== focusedObjectId)].slice(0, 24)
    : previousResolved
  const firstUnreadyIndex = stages.findIndex((stage) => !readyStageIds.has(stage.id))

  const routeStageReadiness: LearningRouteProgress['stageReadiness'] = stageReadiness.map((stage, index) => {
    if (stage.status === 'ready' || stage.stageId === activeStage) return stage
    const status: LearningRouteProgress['stageReadiness'][number]['status'] =
      index === firstUnreadyIndex ? 'needs-repair' : 'not-started'
    return {
      ...stage,
      status,
      evidence: index === firstUnreadyIndex ? stage.evidence : undefined,
    }
  })
  const routeNextRepair = routeStageReadiness.find((stage) => stage.status === 'needs-repair')?.label ?? nextRepair

  return {
    version: 'cf-route-progress-v1',
    stageReadiness: routeStageReadiness,
    checkpoints: [
      {
        id: 'kv-prediction',
        label: 'KV memory prediction',
        status: routeSnapshot?.lastObservation ? 'saved' : selectedPredictionChoice ? 'observed' : 'pending',
        detail: compactProgressText(selectedPredictionChoice?.feedback ?? routeSnapshot?.lastObservation?.value),
        updatedAt: selectedPredictionChoice || routeSnapshot?.lastObservation ? now : previousProgress?.updatedAt,
      },
      {
        id: 'kv-checkpoint',
        label: 'KV memory checkpoint',
        status: routeSnapshot?.lastObservation ? 'saved' : 'pending',
        detail: compactProgressText(routeSnapshot?.lastObservation?.value),
        updatedAt: routeSnapshot?.lastObservation?.updatedAt,
      },
      {
        id: 'decoding-probe',
        label: 'Decoding probe',
        status: selectedDecodePredictionChoice || decodeProbeActive ? 'observed' : 'pending',
        detail: compactProgressText(selectedDecodePredictionChoice?.feedback),
        updatedAt: selectedDecodePredictionChoice || decodeProbeActive ? now : previousProgress?.updatedAt,
      },
      {
        id: 'research-ai-handoff',
        label: 'Research discussion object',
        status: focusedObjectId ? 'observed' : 'pending',
        detail: compactProgressText(routeSnapshot?.currentObject?.title),
        updatedAt: focusedObjectId ? now : previousProgress?.updatedAt,
      },
    ],
    resolvedObjectIds,
    nextRepair: routeNextRepair,
    updatedAt: now,
  }
}

function RouteProgressPanel({ progress }: { progress: LearningRouteProgress }) {
  const readyCount = progress.stageReadiness.filter((stage) => stage.status === 'ready').length
  const savedCheckpoints = progress.checkpoints?.filter((checkpoint) => checkpoint.status === 'saved').length ?? 0

  return (
    <section className="route-progress-panel" aria-labelledby="route-progress-title">
      <div className="progress-heading">
        <p className="eyebrow">Route Progress</p>
        <h3 id="route-progress-title">What is understood, and what still needs repair.</h3>
        <span>
          {readyCount}/{progress.stageReadiness.length} stages ready · {savedCheckpoints} saved checkpoint
          {savedCheckpoints === 1 ? '' : 's'} · {progress.resolvedObjectIds?.length ?? 0} object focus item
          {(progress.resolvedObjectIds?.length ?? 0) === 1 ? '' : 's'}
        </span>
      </div>

      <div className="progress-layout">
        <div className="stage-progress-list" aria-label="Stage readiness">
          {progress.stageReadiness.map((stage, index) => (
            <article key={stage.stageId} className={stage.status}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{stage.label}</strong>
              <em>{stage.status.replaceAll('-', ' ')}</em>
              {stage.evidence ? <p>{stage.evidence}</p> : null}
            </article>
          ))}
        </div>

        <div className="progress-side">
          <article>
            <span>Next repair</span>
            <strong>{progress.nextRepair ?? 'Route is ready for synthesis'}</strong>
            <p>The next discussion or AI handoff should stay anchored to this route state.</p>
          </article>

          <div className="checkpoint-list" aria-label="Checkpoint status">
            {progress.checkpoints?.map((checkpoint) => (
              <article key={checkpoint.id} className={checkpoint.status}>
                <span>{checkpoint.status}</span>
                <strong>{checkpoint.label}</strong>
                {checkpoint.detail ? <p>{checkpoint.detail}</p> : null}
              </article>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .route-progress-panel {
          display: grid;
          gap: 0.85rem;
          min-width: 0;
          padding: 1rem;
          border-radius: 22px;
          border: 1px solid rgba(27, 36, 48, 0.09);
          background: rgba(255, 251, 245, 0.86);
          box-shadow: 0 16px 34px rgba(27, 36, 48, 0.05);
        }

        .progress-heading,
        .progress-side,
        .stage-progress-list article,
        .checkpoint-list article {
          min-width: 0;
        }

        .progress-heading {
          display: grid;
          gap: 0.34rem;
        }

        .progress-heading h3 {
          margin: 0;
          color: #151d27;
          font-size: clamp(1.2rem, 2vw, 1.55rem);
          line-height: 1.1;
          overflow-wrap: break-word;
        }

        .progress-heading h3::before {
          content: none;
          display: none;
        }

        .progress-heading span {
          color: #52606c;
          line-height: 1.45;
        }

        .progress-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(230px, 0.34fr);
          gap: 0.65rem;
          min-width: 0;
        }

        .stage-progress-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 0.5rem;
          min-width: 0;
        }

        .stage-progress-list article,
        .progress-side > article,
        .checkpoint-list article {
          display: grid;
          gap: 0.32rem;
          padding: 0.68rem;
          border-radius: 15px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.78);
        }

        .stage-progress-list article.ready,
        .checkpoint-list article.saved {
          border-color: rgba(31, 111, 120, 0.18);
          background: rgba(231, 248, 244, 0.72);
        }

        .stage-progress-list article.active,
        .checkpoint-list article.observed {
          border-color: rgba(194, 74, 45, 0.18);
          background: rgba(255, 244, 238, 0.72);
        }

        .stage-progress-list span,
        .progress-side span,
        .checkpoint-list span {
          font-family: var(--font-mono);
          font-size: 0.64rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #c24a2d;
        }

        .stage-progress-list strong,
        .progress-side strong,
        .checkpoint-list strong {
          color: #151d27;
          line-height: 1.35;
          overflow-wrap: break-word;
        }

        .stage-progress-list em,
        .stage-progress-list p,
        .progress-side p,
        .checkpoint-list p {
          margin: 0;
          color: #52606c;
          font-size: 0.82rem;
          font-style: normal;
          line-height: 1.42;
          overflow-wrap: break-word;
        }

        .progress-side {
          display: grid;
          gap: 0.55rem;
          align-content: start;
        }

        .checkpoint-list {
          display: grid;
          gap: 0.5rem;
          min-width: 0;
        }

        @media (max-width: 960px) {
          .progress-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}

function sharedKvTargetFor(queryHeads: number) {
  return [8, 4, 2, 1].find((heads) => heads < queryHeads && queryHeads % heads === 0) ?? 1
}

function attentionServingSnapshot(): LearningRouteSnapshot {
  const currentObject = defaultAttentionCurrentObject()

  return {
    version: 'cf-route-snapshot-v1',
    source: 'attention-serving',
    paperClueLabel: 'KV cache memory in attention serving',
    paperTitle: 'KV cache memory in attention serving',
    inputKind: 'study module',
    mappingId: 'kv-cache',
    mappingTitle: 'Attention to serving route',
    routeLabels: stages.map((stage) => stage.label),
    routeConceptIds: stages.map((stage) => conceptIdFromHref(stage.href)).filter(Boolean),
    routeConcepts: stages.map((stage) => ({
      label: stage.label,
      href: stage.href,
      role: stage.role,
    })),
    nextRepair: 'Efficient Attention',
    currentQuestion: kvMemoryQuestion,
    primaryEquation: {
      label: equations[1].label,
      equation: equations[1].equation,
      confidence: 'high',
      sourceLabel: 'Attention-serving module',
    },
    labGoal: 'Use MHA, GQA, MQA, context length, and precision controls to inspect KV memory.',
    labStatus: 'live',
    sourceObjects: attentionServingSourceObjects(),
    currentObject,
    routeProgress: buildAttentionRouteProgress({
      activeStage: 'efficient-attention',
      routeSnapshot: null,
      focusedObjectId: progressObjectId(currentObject),
    }),
    groundingStatus: 'local-preview',
    createdAt: new Date().toISOString(),
  }
}

export default function AttentionServingModule() {
  const router = useRouter()
  const [activeStage, setActiveStage] = useState(stages[0].id)
  const [activeEquation, setActiveEquation] = useState(equations[1].id)
  const [routeSnapshot, setRouteSnapshot] = useState<LearningRouteSnapshot | null>(null)
  const [routeFocus, setRouteFocus] = useState<string | null>(null)
  const [context, setContext] = useState(32768)
  const [layers, setLayers] = useState(32)
  const [queryHeads, setQueryHeads] = useState(32)
  const [kvHeads, setKvHeads] = useState(32)
  const [dHead, setDHead] = useState(128)
  const [batch, setBatch] = useState(4)
  const [bytes, setBytes] = useState(2)
  const [temperature, setTemperature] = useState(0.8)
  const [topK, setTopK] = useState(4)
  const [topP, setTopP] = useState(0.9)
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionChoice['id'] | null>(null)
  const [selectedDecodePrediction, setSelectedDecodePrediction] = useState<DecodePredictionChoice['id'] | null>(null)
  const [selectedRouteObjectId, setSelectedRouteObjectId] = useState('equation:kv')

  const stage = stages.find((item) => item.id === activeStage) ?? stages[0]
  const equation = equations.find((item) => item.id === activeEquation) ?? equations[0]
  const effectiveKvHeads = Math.min(kvHeads, queryHeads)
  const memory = kvGb(context, layers, effectiveKvHeads, dHead, batch, bytes)
  const mhaMemory = kvGb(context, layers, queryHeads, dHead, batch, bytes)
  const mqaMemory = kvGb(context, layers, 1, dHead, batch, bytes)
  const savings = Math.max(0, 1 - memory / mhaMemory)
  const sharedKvHeadTarget = sharedKvTargetFor(queryHeads)
  const predictionExperimentHeads = effectiveKvHeads === queryHeads ? sharedKvHeadTarget : queryHeads
  const decodeDistribution = useMemo(
    () => filteredDistribution(temperature, topK, topP),
    [temperature, topK, topP]
  )
  const selectedPredictionChoice = kvPredictionChoices.find((choice) => choice.id === selectedPrediction)
  const selectedDecodePredictionChoice = decodePredictionChoices.find((choice) => choice.id === selectedDecodePrediction)
  const labUnlocked = selectedPrediction !== null
  const canSaveCheckpoint = selectedPredictionChoice?.correct === true
  const checkpointKvHeads = effectiveKvHeads === queryHeads ? sharedKvHeadTarget : effectiveKvHeads
  const predictionExperimentLabel = canSaveCheckpoint
    ? effectiveKvHeads === queryHeads
      ? `Try ${sharedKvHeadTarget} KV heads and save checkpoint`
      : `Save H_kv ${queryHeads} -> ${effectiveKvHeads} checkpoint and compare full MHA`
    : 'Run correction experiment'
  const headSharingRatio = queryHeads / sharedKvHeadTarget
  const headSharingSavings = Math.round((1 - sharedKvHeadTarget / queryHeads) * 100)
  const isKvRoute = routeFocus === 'kv-cache' || routeSnapshot?.mappingId === 'kv-cache'
  const decodeProbeActive = selectedDecodePrediction !== null && temperature === 1.8 && topK === 1
  const decodeCandidateCount = decodeDistribution.filter((item) => item.kept).length
  const discussionItems = useMemo(() => attentionDiscussionItems(), [])
  const kvLabSourceObject = useMemo<LearningRouteSourceObject>(
    () => ({
      type: 'toy-experiment',
      id: 'kv-memory-lab',
      title: 'KV memory lab',
      role: 'Prediction-first MHA/GQA/MQA memory comparison',
      status: canSaveCheckpoint ? 'checkpoint ready' : labUnlocked ? 'prediction selected' : 'prediction pending',
    }),
    [canSaveCheckpoint, labUnlocked]
  )
  const decodeProbeSourceObject = useMemo<LearningRouteSourceObject>(
    () => ({
      type: 'toy-experiment',
      id: 'decoding-probe',
      title: 'Decoding filter probe',
      role: 'Temperature, top-k, and top-p candidate-set test',
      status: decodeProbeActive ? 'probe observed' : selectedDecodePrediction ? 'prediction selected' : 'prediction pending',
    }),
    [decodeProbeActive, selectedDecodePrediction]
  )
  const routeObjectFocusOptions: RouteObjectFocus[] = useMemo(() => {
    const stageOptions = stages.map((item) => ({
      id: `stage:${item.id}`,
      eyebrow: 'Stage',
      label: item.label,
      description: item.question,
      context: [
        `Stage: ${item.label}`,
        `Role: ${item.role}`,
        `Question: ${item.question}`,
        `Output: ${item.output}`,
        `Concept link: ${item.href}`,
      ].join('\n'),
      sourceObject: {
        type: 'concept' as const,
        id: item.id,
        title: item.label,
        href: item.href,
        role: item.role,
        status: item.id === activeStage ? 'active stage' : 'route stage',
      },
    }))

    const equationOptions = equations.map((item) => ({
      id: `equation:${item.id}`,
      eyebrow: 'Equation',
      label: item.label,
      description: item.stressTest,
      context: [
        `Equation: ${item.label}`,
        item.equation,
        `Source: ${item.source}`,
        `Symbols: ${item.symbols.map((symbol) => `${symbol.symbol} ${symbol.shape}`).join(', ')}`,
        `Stress test: ${item.stressTest}`,
      ].join('\n'),
      sourceObject: {
        type: 'equation' as const,
        id: item.id,
        title: item.label,
        href: item.conceptHref,
        role: item.equation.length <= 140 ? item.equation : 'Active equation object',
        status: item.id === activeEquation ? 'active equation' : 'route equation',
      },
    }))

    const labOptions: RouteObjectFocus[] = [
      {
        id: 'lab:kv-memory',
        eyebrow: 'Lab',
        label: 'KV memory lab',
        description: canSaveCheckpoint
          ? 'A checkpoint can be saved from the current H_kv comparison.'
          : 'Commit to the KV-memory prediction before changing controls.',
        context: [
          'Lab: KV memory',
          `Current controls: B=${batch}, T=${context.toLocaleString()}, layers=${layers}, H_q=${queryHeads}, H_kv=${effectiveKvHeads}, d_head=${dHead}, precision=${bytes} bytes/scalar`,
          `Current estimate: ${formatGb(memory)}; ${Math.round(savings * 100)}% smaller than full MHA.`,
          selectedPredictionChoice ? `Prediction: ${selectedPredictionChoice.label} - ${selectedPredictionChoice.feedback}` : 'Prediction: not selected yet.',
          routeSnapshot?.lastObservation
            ? `Saved observation: ${routeSnapshot.lastObservation.value}. ${routeSnapshot.lastObservation.nextQuestion ?? ''}`
            : 'Saved observation: none yet.',
        ].join('\n'),
        sourceObject: kvLabSourceObject,
      },
      {
        id: 'lab:decoding-probe',
        eyebrow: 'Lab',
        label: 'Decoding filter probe',
        description: decodeProbeActive
          ? 'The top-k = 1 probe has been observed.'
          : 'Predict which sampling control is binding before running the probe.',
        context: [
          'Lab: Decoding filter probe',
          `Controls: temperature=${temperature.toFixed(1)}, top-k=${topK}, top-p=${topP.toFixed(2)}`,
          `Kept candidates: ${decodeCandidateCount}`,
          selectedDecodePredictionChoice
            ? `Prediction: ${selectedDecodePredictionChoice.label} - ${selectedDecodePredictionChoice.feedback}`
            : 'Prediction: not selected yet.',
          decodeProbeActive
            ? 'Observation: candidate set = 1 token; after renormalization, the survivor has probability 100%.'
            : 'Observation: probe not run yet.',
        ].join('\n'),
        sourceObject: decodeProbeSourceObject,
      },
    ]

    const discussionOptions = discussionItems.map((item) => ({
      id: `discussion:${item.anchor.id}`,
      eyebrow: 'Discussion',
      label: item.anchor.title,
      description: item.thread.seedPrompt,
      context: [
        `Discussion anchor: ${item.anchor.id}`,
        `Object type: ${item.anchor.objectType}`,
        `Context: ${item.anchor.contextLabel ?? 'route object'}`,
        `Question: ${item.thread.seedPrompt}`,
      ].join('\n'),
      sourceObject: {
        type: item.anchor.objectType,
        id: item.anchor.id.split('/').at(-1),
        discussionAnchorId: item.anchor.id,
        title: item.anchor.title,
        role: item.thread.seedPrompt,
        status: 'discussion anchor',
      },
    }))

    return [...stageOptions, ...equationOptions, ...labOptions, ...discussionOptions]
  }, [
    activeEquation,
    activeStage,
    batch,
    bytes,
    canSaveCheckpoint,
    context,
    dHead,
    decodeCandidateCount,
    decodeProbeActive,
    discussionItems,
    effectiveKvHeads,
    kvLabSourceObject,
    layers,
    memory,
    queryHeads,
    routeSnapshot?.lastObservation,
    savings,
    selectedDecodePredictionChoice,
    selectedPredictionChoice,
    temperature,
    topK,
    topP,
    decodeProbeSourceObject,
  ])
  const selectedRouteObject =
    routeObjectFocusOptions.find((item) => item.id === selectedRouteObjectId) ??
    routeObjectFocusOptions.find((item) => item.id === 'equation:kv') ??
    routeObjectFocusOptions[0]
  const routeProgress = useMemo(
    () =>
      buildAttentionRouteProgress({
        activeStage,
        routeSnapshot,
        selectedPredictionChoice,
        selectedDecodePredictionChoice,
        decodeProbeActive,
        focusedObjectId: progressObjectId(routeSnapshot?.currentObject),
      }),
    [
      activeStage,
      decodeProbeActive,
      routeSnapshot,
      selectedDecodePredictionChoice,
      selectedPredictionChoice,
    ]
  )
  const carriedPaperEvidenceContext = useMemo(() => paperEvidenceContext(routeSnapshot), [routeSnapshot])
  const currentRouteContext = [
    `Active stage: ${stage.label} (${stage.role})`,
    `Active equation: ${equation.label}: ${equation.equation}`,
    selectedRouteObject
      ? `Focused object: ${selectedRouteObject.eyebrow} - ${selectedRouteObject.label}\n${selectedRouteObject.context}`
      : 'Focused object: none selected.',
    `KV lab: B=${batch}, T=${context.toLocaleString()}, layers=${layers}, H_q=${queryHeads}, H_kv=${effectiveKvHeads}, d_head=${dHead}, precision=${bytes} bytes/scalar`,
    `Current KV estimate: ${formatGb(memory)}; ${Math.round(savings * 100)}% smaller than full MHA under these settings.`,
    `Route progress: ${routeProgress.stageReadiness.filter((item) => item.status === 'ready').length}/${routeProgress.stageReadiness.length} stages ready; next repair ${routeProgress.nextRepair ?? 'none'}.`,
    carriedPaperEvidenceContext,
    routeSnapshot?.lastObservation
      ? `Saved observation: ${routeSnapshot.lastObservation.value}. ${routeSnapshot.lastObservation.nextQuestion ?? ''}`
      : 'No saved lab observation yet.',
  ].join('\n')
  const companionNextStep =
    routeSnapshot?.lastObservation?.nextQuestion ??
    (selectedPredictionChoice?.correct
      ? 'Save or compare the KV-head checkpoint, then test the quality risk behind head sharing.'
      : 'Commit to the KV memory prediction, then change one serving variable at a time.')
  const rememberedRouteObject = routeSnapshot?.currentObject
  const rememberedRouteObjectLabel =
    rememberedRouteObject?.title ?? routeSnapshot?.primaryEquation?.label ?? 'KV cache memory'
  const rememberedRouteObjectMeta = rememberedRouteObject
    ? `${sourceObjectTypeLabel(rememberedRouteObject.type)}${rememberedRouteObject.status ? ` · ${rememberedRouteObject.status}` : ''}`
    : 'equation carried'
  const routeNextActionLabel = routeSnapshot?.lastObservation
    ? 'Test quality risk'
    : selectedPredictionChoice?.correct
      ? 'Save KV checkpoint'
      : 'Run prediction check'
  const pathRoleLenses: PathRoleLens[] = [
    {
      label: 'Learner',
      cue: 'follow the spine',
      detail: 'Start with attention as weighted copy, then watch every later systems choice preserve or compress that object.',
      objectId: 'stage:attention',
      scrollId: 'path-module-map',
      stageId: 'attention',
    },
    {
      label: 'Researcher',
      cue: 'audit the claim',
      detail: 'Attach the route to the KV compression claim: which symbol changes, which variables stay fixed, and what evidence would convince you?',
      objectId: `discussion:${discussionItems[0]?.anchor.id ?? 'claim/attention-serving/what-is-compressed'}`,
      scrollId: 'research-reading-room-workspace',
      equationId: 'kv',
    },
    {
      label: 'Experimenter',
      cue: 'move one variable',
      detail: 'Use the KV lab as a prediction-first experiment: change H_kv, hold the rest fixed, then save the checkpoint.',
      objectId: 'lab:kv-memory',
      scrollId: 'kv-memory-lab',
      stageId: 'efficient-attention',
      equationId: 'kv',
    },
    {
      label: 'Professor',
      cue: 'name invariants',
      detail: 'Keep the attention and KV equations visible while asking what survives through GQA, long context, serving, and decoding.',
      objectId: 'equation:attention',
      scrollId: 'carried-equations',
      stageId: 'attention',
      equationId: 'attention',
    },
  ]
  const pathEvidenceLoop = [
    {
      label: 'Predict',
      detail: selectedPredictionChoice ? 'KV variable chosen' : 'Which symbol controls cache size?',
      href: '#kv-memory-lab',
    },
    {
      label: 'Ground',
      detail: equation.label,
      href: '#carried-equations',
    },
    {
      label: 'Experiment',
      detail: routeSnapshot?.lastObservation ? 'checkpoint saved' : 'change H_kv only',
      href: '#kv-memory-lab',
    },
    {
      label: 'Carry',
      detail: routeProgress.nextRepair ?? 'ready for synthesis',
      href: '#route-progress-title',
    },
  ]

  useEffect(() => {
    if (!router.isReady) return

    const focus = queryValue(router.query.focus)
    const snapshot = getSavedLearningRouteSnapshot()
    setRouteFocus(focus ?? null)

    if (focus === 'kv-cache' && snapshot?.mappingId !== 'kv-cache') {
      const nextSnapshot = attentionServingSnapshot()
      saveLearningRouteSnapshot(nextSnapshot)
      setRouteSnapshot(nextSnapshot)
    } else {
      setRouteSnapshot(snapshot)
    }

    if (focus === 'kv-cache' || snapshot?.mappingId === 'kv-cache') {
      setActiveStage('efficient-attention')
      setActiveEquation('kv')

      const labState = snapshot?.lastObservation?.workbench?.lab.state ?? snapshot?.lastObservation?.labState
      if (labState) {
        setContext(labState.context)
        setLayers(labState.layers)
        setQueryHeads(labState.queryHeads)
        setKvHeads(Math.min(labState.kvHeads, labState.queryHeads))
        setDHead(labState.dHead)
        setBatch(labState.batch)
        setBytes(labState.bytes)
        setSelectedPrediction('h-kv')
      }
    }
  }, [router.isReady, router.query.focus])

  useEffect(() => {
    setKvHeads((current) => Math.min(current, queryHeads))
  }, [queryHeads])

  const clearCarriedRoute = () => {
    clearLearningRouteSnapshot()
    setRouteSnapshot(null)
    setRouteFocus(null)
    void router.replace('/paths/attention-serving/#serving-module', undefined, { shallow: true })
  }

  const rememberFocusedObject = (sourceObject: LearningRouteSourceObject, progressActiveStage = activeStage) => {
    const baseSnapshot = routeSnapshot?.mappingId === 'kv-cache' ? routeSnapshot : attentionServingSnapshot()
    const draftSnapshot: LearningRouteSnapshot = {
      ...baseSnapshot,
      sourceObjects: baseSnapshot.sourceObjects?.length ? baseSnapshot.sourceObjects : attentionServingSourceObjects(),
      currentObject: sourceObject,
    }
    const nextSnapshot: LearningRouteSnapshot = {
      ...draftSnapshot,
      routeProgress: buildAttentionRouteProgress({
        activeStage: progressActiveStage,
        routeSnapshot: draftSnapshot,
        selectedPredictionChoice,
        selectedDecodePredictionChoice,
        decodeProbeActive,
        focusedObjectId: progressObjectId(sourceObject),
      }),
    }

    saveLearningRouteSnapshot(nextSnapshot)
    setRouteSnapshot(nextSnapshot)
  }

  const selectRouteObjectById = (id: string) => {
    setSelectedRouteObjectId(id)
    const focus = routeObjectFocusOptions.find((item) => item.id === id)
    if (focus) {
      const progressActiveStage = id.startsWith('stage:') ? id.replace(/^stage:/, '') : activeStage
      rememberFocusedObject(focus.sourceObject, progressActiveStage)
    }
  }

  const focusDiscussionObject = (item: DiscussionAnchorListItem) => {
    const optionId = `discussion:${item.anchor.id}`

    if (routeObjectFocusOptions.some((option) => option.id === optionId)) {
      selectRouteObjectById(optionId)
      return
    }

    setSelectedRouteObjectId(optionId)
    rememberFocusedObject(routeSourceObjectFromDiscussionItem(item))
  }

  const activateRoleLens = (lens: PathRoleLens) => {
    if (lens.stageId) setActiveStage(lens.stageId)
    if (lens.equationId) setActiveEquation(lens.equationId)
    selectRouteObjectById(lens.objectId)

    if (typeof document !== 'undefined') {
      document.getElementById(lens.scrollId)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }

  const saveKvObservation = (targetKvHeads: number) => {
    const baseSnapshot = routeSnapshot?.mappingId === 'kv-cache' ? routeSnapshot : attentionServingSnapshot()
    const sharedMemory = kvGb(context, layers, targetKvHeads, dHead, batch, bytes)
    const ratio = mhaMemory / sharedMemory
    const reduction = Math.round((1 - sharedMemory / mhaMemory) * 100)
    const precision = bytesOptions.find((option) => option.value === bytes)?.label ?? `${bytes} bytes/scalar`
    const caveat = 'Formula estimate only; excludes allocator, paged-cache, metadata, scheduler, and layout overhead.'
    const changed = {
      symbol: 'H_kv',
      from: queryHeads,
      to: targetKvHeads,
    }
    const heldFixed = [
      { symbol: 'B', value: batch },
      { symbol: 'T', value: context },
      { symbol: 'N_layers', value: layers },
      { symbol: 'd_head', value: dHead },
      { symbol: 'precision', value: precision },
    ]
    const result = {
      before: mhaMemory,
      after: sharedMemory,
      ratio,
      unit: 'GB-decimal' as const,
    }
    const labState = {
      context,
      layers,
      queryHeads,
      kvHeads: targetKvHeads,
      dHead,
      batch,
      bytes,
    }
    const evidence = `Changed H_kv only; held fixed B=${batch}, T=${context.toLocaleString()}, N_layers=${layers}, d_head=${dHead}, precision=${precision}. Result: ${reduction}% less KV cache in decimal GB.`
    const draftSnapshot: LearningRouteSnapshot = {
      ...baseSnapshot,
      labStatus: 'live',
      labGoal: 'Use MHA, GQA, MQA, context length, and precision controls to inspect KV memory.',
      currentObject: kvLabSourceObject,
      lastObservation: {
        label: 'KV checkpoint',
        value: `H_kv ${queryHeads} -> ${targetKvHeads}: ${formatGb(mhaMemory)} -> ${formatGb(sharedMemory)}, ${ratio.toFixed(1)}x smaller`,
        detail: evidence,
        nextQuestion: 'Quality risk to test: does shared K/V hurt long-context retrieval or head-specific behavior?',
        source: 'prediction-checkpoint',
        updatedAt: new Date().toISOString(),
        kind: 'formula-comparison',
        changed,
        heldFixed,
        result,
        caveat,
        labState,
        workbench: {
          type: 'formula-workbench',
          equationObject: {
            label: 'KV-cache memory equation',
            equation: 'Mem_KV = B * L * T * H_kv * d_head * 2 * bytes',
          },
          committedPrediction: {
            id: 'h-kv',
            label: 'Changing H_kv changes KV-cache memory',
            text: `H_kv ${queryHeads} -> ${targetKvHeads}: ${formatGb(mhaMemory)} -> ${formatGb(sharedMemory)}, ${ratio.toFixed(1)}x smaller`,
          },
          evidence,
          invariant: 'For fixed batch, layers, context, head dimension, and precision, KV-cache memory scales linearly with stored K/V heads.',
          nextMove: 'Quality risk to test: does shared K/V hurt long-context retrieval or head-specific behavior?',
          changed,
          heldFixed,
          result,
          caveat,
          lab: {
            id: 'attention-serving-kv-memory-lab',
            version: '2026-05-31',
            state: labState,
            restoreHref: '/paths/attention-serving/?focus=kv-cache#kv-cache-lab',
          },
        },
      },
    }
    const nextSnapshot: LearningRouteSnapshot = {
      ...draftSnapshot,
      routeProgress: buildAttentionRouteProgress({
        activeStage,
        routeSnapshot: draftSnapshot,
        selectedPredictionChoice,
        selectedDecodePredictionChoice,
        decodeProbeActive,
        focusedObjectId: progressObjectId(kvLabSourceObject),
      }),
    }

    saveLearningRouteSnapshot(nextSnapshot)
    setSelectedRouteObjectId('lab:kv-memory')
    setRouteSnapshot(nextSnapshot)
  }

  const architectureRows = [
    { label: 'MHA', heads: queryHeads, note: 'Each query head owns its KV head.', memory: mhaMemory },
    { label: 'GQA', heads: effectiveKvHeads, note: 'Query heads share KV within groups.', memory },
    { label: 'MQA', heads: 1, note: 'All query heads share one KV head.', memory: mqaMemory },
  ]

  return (
    <section id="serving-module" className="flagship-shell" aria-label="Attention to serving study module">
      {isKvRoute ? (
        <section className="carried-question" aria-labelledby="carried-question-title">
          <div>
            <p className="eyebrow">Route Question Carried In</p>
            <h2 id="carried-question-title">{routeSnapshot?.currentQuestion ?? kvMemoryQuestion}</h2>
            <p>
              Change context length, KV heads, and precision below. Watch whether the claim changes memory, latency,
              or only the risk that retrieval quality breaks.
            </p>
          </div>

          <div className="carried-facts">
            <article>
              <span>Route source</span>
              <strong>{routeSnapshot?.paperClueLabel ?? routeSnapshot?.paperTitle ?? 'KV cache compression / long-context serving'}</strong>
            </article>
            <article>
              <span>Equation</span>
              <strong>{routeSnapshot?.primaryEquation?.equation ?? equations[1].equation}</strong>
            </article>
            <article>
              <span>First repair</span>
              <strong>{routeSnapshot?.nextRepair ?? 'Efficient Attention'}</strong>
            </article>
            <article>
              <span>Current object</span>
              {rememberedRouteObject?.href ? (
                <Link href={rememberedRouteObject.href}>{rememberedRouteObjectLabel}</Link>
              ) : (
                <strong>{rememberedRouteObjectLabel}</strong>
              )}
              <em>{rememberedRouteObjectMeta}</em>
            </article>
            {routeSnapshot?.lastObservation ? (
              <article>
                <span>Last observation</span>
                <strong>{routeSnapshot.lastObservation.value}</strong>
              </article>
            ) : null}
            <article>
              <span>Next action</span>
              <strong>{routeNextActionLabel}</strong>
              <em>{companionNextStep}</em>
            </article>
          </div>

          <button type="button" onClick={clearCarriedRoute}>
            Clear route
          </button>
        </section>
      ) : null}

      {isKvRoute ? <PaperSourceContinuityRail snapshot={routeSnapshot} /> : null}
      {isKvRoute ? <RouteProgressPanel progress={routeProgress} /> : null}

      <section className="route-role-studio" aria-labelledby="route-role-studio-title" data-route-role-studio>
        <div className="role-studio-heading">
          <p className="eyebrow">Route Studio</p>
          <h2 id="route-role-studio-title">Pick a lens, then keep the same evidence moving.</h2>
          <p>
            The path should work as a learner map, a claim audit, a lab bench, and a lecture spine without splitting into
            four different products.
          </p>
        </div>

        <div className="role-lens-grid" aria-label="Learning path role lenses">
          {pathRoleLenses.map((lens) => (
            <button
              key={lens.label}
              type="button"
              onClick={() => activateRoleLens(lens)}
              data-role-lens={lens.label.toLowerCase()}
              aria-label={`${lens.label}: ${lens.cue}. ${lens.detail}`}
            >
              <span>{lens.cue}</span>
              <strong>{lens.label}</strong>
              <em>{lens.detail}</em>
            </button>
          ))}
        </div>

        <div className="path-evidence-loop" aria-label="Path evidence loop">
          {pathEvidenceLoop.map((step, index) => (
            <a key={step.label} href={step.href}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{step.label}</strong>
              <em>{step.detail}</em>
            </a>
          ))}
        </div>
      </section>

      <div id="path-module-map" className="module-map">
        <div className="module-intro">
          <p className="eyebrow">Study Module</p>
          <h2>One paper route from math to production.</h2>
          <p>
            This module reads transformer inference as one continuous mechanism: attention defines the copy operation,
            cache design decides what can be reused, and serving turns every symbol into memory, latency, and quality
            tradeoffs.
          </p>
        </div>

        <div className="stage-strip" aria-label="Attention to serving route">
          {stages.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={item.id === activeStage ? 'active' : ''}
              onClick={() => {
                setActiveStage(item.id)
                selectRouteObjectById(`stage:${item.id}`)
              }}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{item.label}</strong>
              <em>{item.role}</em>
            </button>
          ))}
        </div>

        <article className="stage-detail">
          <span>{stage.role}</span>
          <h3>{stage.label}</h3>
          <p>{stage.question}</p>
          <strong>{stage.output}</strong>
          <Link href={stage.href}>Open concept</Link>
        </article>
      </div>

      <div className="workspace-grid">
        <section id="carried-equations" className="equation-workbench" aria-labelledby="equation-workbench-title">
          <div className="panel-heading">
          <p className="eyebrow">Carried Equations</p>
            <h3 id="equation-workbench-title">Every formula is a route object.</h3>
          </div>

          <div className="equation-tabs" aria-label="Equation objects">
            {equations.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === activeEquation ? 'active' : ''}
                onClick={() => {
                  setActiveEquation(item.id)
                  selectRouteObjectById(`equation:${item.id}`)
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <code>{equation.equation}</code>

          <div className="symbol-grid">
            {equation.symbols.map((symbol) => (
              <article key={symbol.symbol}>
                <span>{symbol.symbol}</span>
                <strong>{symbol.meaning}</strong>
                <em>{symbol.shape}</em>
              </article>
            ))}
          </div>

          <div className="source-note">
            <span>source</span>
            <strong>{equation.source}</strong>
            <p>{equation.stressTest}</p>
            <Link href={equation.conceptHref}>Read the concept</Link>
          </div>
        </section>

        <section id="kv-memory-lab" className="kv-calculator" aria-labelledby="kv-calculator-title">
          <div className="panel-heading">
            <p className="eyebrow">KV Memory Lab</p>
            <h3 id="kv-calculator-title">Change the serving budget.</h3>
          </div>

          <div className="prediction-checkpoint" aria-labelledby="kv-prediction-title">
            <div className="prediction-copy">
              <span>Predict first</span>
              <strong id="kv-prediction-title">A paper changes MHA to GQA or MQA. Which memory symbol should move first?</strong>
              <p>
                Hold B, N_layers, T, d_head, and bytes fixed. A model variant shares K/V heads. Commit to the term
                before touching the controls.
              </p>
            </div>

            <div className="prediction-options" aria-label="KV memory prediction choices">
              {kvPredictionChoices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  className={`${choice.id === selectedPrediction ? 'active' : ''} ${choice.correct ? 'correct' : 'miss'}`}
                  onClick={() => {
                    setSelectedPrediction(choice.id)
                    selectRouteObjectById('lab:kv-memory')
                  }}
                  aria-pressed={choice.id === selectedPrediction}
                >
                  <span>{choice.symbol}</span>
                  {choice.label}
                </button>
              ))}
            </div>

            {selectedPredictionChoice ? (
              <div className="prediction-feedback" role="status">
                <strong>{selectedPredictionChoice.correct ? 'Correct: head sharing reduces H_kv.' : 'Not this mechanism.'}</strong>
                <p>{selectedPredictionChoice.feedback}</p>
                {selectedPredictionChoice.correct ? (
                  <p>
                    With {queryHeads} query heads and {sharedKvHeadTarget} KV heads, memory should be about{' '}
                    {headSharingRatio.toFixed(1)}x smaller, or {headSharingSavings}% less, before quality effects.
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setActiveEquation('kv')
                    if (canSaveCheckpoint) {
                      saveKvObservation(checkpointKvHeads)
                    }
                    setKvHeads(predictionExperimentHeads)
                  }}
                >
                  {predictionExperimentLabel}
                </button>
              </div>
            ) : (
              <p className="unlock-note">Choose an answer to unlock the calculator.</p>
            )}
          </div>

          <div className={labUnlocked ? 'control-grid' : 'control-grid locked'} aria-disabled={!labUnlocked}>
            <label>
              <span>Context tokens</span>
              <input type="range" min="2048" max="131072" step="2048" value={context} disabled={!labUnlocked} onChange={(event) => setContext(Number(event.target.value))} />
              <strong>{context.toLocaleString()}</strong>
            </label>
            <label>
              <span>Layers</span>
              <input type="range" min="8" max="96" step="4" value={layers} disabled={!labUnlocked} onChange={(event) => setLayers(Number(event.target.value))} />
              <strong>{layers}</strong>
            </label>
            <label>
              <span>Batch</span>
              <input type="range" min="1" max="32" step="1" value={batch} disabled={!labUnlocked} onChange={(event) => setBatch(Number(event.target.value))} />
              <strong>{batch}</strong>
            </label>
            <label>
              <span>Query heads</span>
              <input type="range" min="8" max="96" step="8" value={queryHeads} disabled={!labUnlocked} onChange={(event) => setQueryHeads(Number(event.target.value))} />
              <strong>{queryHeads}</strong>
            </label>
            <label>
              <span>KV heads</span>
              <input type="range" min="1" max={queryHeads} step="1" value={effectiveKvHeads} disabled={!labUnlocked} onChange={(event) => setKvHeads(Number(event.target.value))} />
              <strong>{effectiveKvHeads}</strong>
              <em>Real GQA usually uses KV-head counts that divide query heads; this slider shows cache-width scaling.</em>
            </label>
            <label>
              <span>Head dim</span>
              <input type="range" min="64" max="256" step="32" value={dHead} disabled={!labUnlocked} onChange={(event) => setDHead(Number(event.target.value))} />
              <strong>{dHead}</strong>
            </label>
          </div>

          <div className="precision-row" aria-label="Precision selector">
            {bytesOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                className={option.value === bytes ? 'active' : ''}
                disabled={!labUnlocked}
                onClick={() => setBytes(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="memory-result">
            <span>current KV cache</span>
            <strong>{formatGb(memory)}</strong>
            <p>{Math.round(savings * 100)}% smaller than full MHA under these settings.</p>
          </div>
        </section>
      </div>

      <div className="comparison-grid">
        <section className="architecture-panel" aria-labelledby="architecture-title">
          <div className="panel-heading">
            <p className="eyebrow">MHA / GQA / MQA</p>
            <h3 id="architecture-title">Same attention equation, different cache width.</h3>
          </div>

          <div className="architecture-list">
            {architectureRows.map((row) => (
              <article key={row.label}>
                <div>
                  <span>{row.label}</span>
                  <strong>{row.heads} KV head{row.heads === 1 ? '' : 's'}</strong>
                  <p>{row.note}</p>
                </div>
                <div className="bar-shell" aria-label={`${row.label} memory ${formatGb(row.memory)}`}>
                  <span style={{ width: `${Math.max(5, (row.memory / mhaMemory) * 100)}%` }} />
                </div>
                <em>{formatGb(row.memory)}</em>
              </article>
            ))}
          </div>
        </section>

        <section className="decode-panel" aria-labelledby="decode-title">
          <div className="panel-heading">
            <p className="eyebrow">Decoding Lab</p>
            <h3 id="decode-title">Sampling controls change the next-token set.</h3>
          </div>

          <div className="prediction-checkpoint decode-checkpoint" aria-labelledby="decode-prediction-title">
            <div className="prediction-copy">
              <span>Predict first</span>
              <strong id="decode-prediction-title">High temperature, top-k = 1: what survives?</strong>
              <p>
                The lab reshapes next-token probabilities with temperature, filters the candidate set, then
                renormalizes what remains. Predict the binding constraint before inspecting the token list.
              </p>
              <p>Choose first; the probe will then set the sliders to the high-temperature, top-k = 1 case.</p>
            </div>

            <div className="prediction-options decode-options" aria-label="Decoding prediction choices">
              {decodePredictionChoices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  className={`${choice.id === selectedDecodePrediction ? 'active' : ''} ${choice.correct ? 'correct' : 'miss'}`}
                  onClick={() => {
                    setSelectedDecodePrediction(choice.id)
                    selectRouteObjectById('lab:decoding-probe')
                  }}
                  aria-pressed={choice.id === selectedDecodePrediction}
                >
                  <span>{choice.mechanism}</span>
                  {choice.label}
                </button>
              ))}
            </div>

            {selectedDecodePredictionChoice ? (
              <div className="prediction-feedback decode-feedback" role="status">
                <strong>{selectedDecodePredictionChoice.correct ? 'Correct: top-k is binding.' : 'Not the binding constraint.'}</strong>
                <p>{selectedDecodePredictionChoice.feedback}</p>
                <button
                  type="button"
                  onClick={() => {
                    setTemperature(1.8)
                    setTopK(1)
                    selectRouteObjectById('lab:decoding-probe')
                  }}
                >
                  Run probe: temp 1.8, top-k 1
                </button>
              </div>
            ) : null}
          </div>

          <div className="decode-controls">
            <label>
              <span>Temperature</span>
              <input type="range" min="0.2" max="1.8" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} />
              <strong>{temperature.toFixed(1)}</strong>
            </label>
            <label>
              <span>Top-k</span>
              <input type="range" min="1" max={decodeTokens.length} step="1" value={topK} onChange={(event) => setTopK(Number(event.target.value))} />
              <strong>{topK}</strong>
            </label>
            <label>
              <span>Top-p</span>
              <input type="range" min="0.45" max="1" step="0.05" value={topP} onChange={(event) => setTopP(Number(event.target.value))} />
              <strong>{topP.toFixed(2)}</strong>
            </label>
          </div>

          <div className="token-list">
            {decodeDistribution.map((item) => (
              <article
                key={item.token}
                className={item.kept ? 'kept' : ''}
                aria-label={`${item.token} ${item.kept ? `kept, normalized probability ${Math.round(item.normalized * 100)} percent` : 'cut'}`}
              >
                <span>{item.token}</span>
                <div className="bar-shell" aria-hidden="true">
                  <span style={{ width: item.kept ? `${Math.max(2, item.normalized * 100)}%` : '0%' }} />
                </div>
                <strong>{item.kept ? `${Math.round(item.normalized * 100)}%` : 'cut'}</strong>
              </article>
            ))}
          </div>

          {decodeProbeActive ? (
            <p className="decode-observation" role="status">
              <strong>Observation:</strong> candidate set = {decodeCandidateCount} token; after renormalization, the
              survivor has probability 100%.
            </p>
          ) : null}
        </section>
      </div>

      <ResearchReadingRoom
        eyebrow="Research Room"
        title="Keep the argument attached to the exact claim."
        intro="Pick a route object before asking for help. The selected paper claim, equation, lab, or misconception becomes the saved focus and companion context."
        items={discussionItems}
        variant="compact"
        showAnchorIds
        onFocusObject={focusDiscussionObject}
      />

      <section className="focus-object-panel" aria-labelledby="focus-object-title">
        <div className="panel-heading">
          <p className="eyebrow">AI Focus Object</p>
          <h3 id="focus-object-title">Ask about one exact object.</h3>
          <p>
            The companion prompt follows this selection, so a question can attach to a stage, equation, lab checkpoint,
            or discussion anchor instead of floating over the whole page.
          </p>
        </div>

        <div className="focus-options" aria-label="Route objects for AI context">
          {routeObjectFocusOptions.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === selectedRouteObject?.id ? 'active' : ''}
              onClick={() => selectRouteObjectById(item.id)}
              aria-pressed={item.id === selectedRouteObject?.id}
            >
              <span>{item.eyebrow}</span>
              <strong>{item.label}</strong>
            </button>
          ))}
        </div>

        {selectedRouteObject ? (
          <article className="focus-detail" aria-live="polite">
            <span>{selectedRouteObject.eyebrow}</span>
            <strong>{selectedRouteObject.label}</strong>
            <p>{selectedRouteObject.description}</p>
            <em>{routeSnapshot?.currentObject?.title === selectedRouteObject.sourceObject.title ? 'Remembered in this route' : 'Ready to ask'}</em>
          </article>
        ) : null}
      </section>

      <LearningCompanionPanel
        id="attention-serving-ai"
        title="Attention to serving route"
        contextLabel="Study module: Attention -> Efficient Attention -> RoPE -> FlashAttention -> Long Context -> LLM Serving -> Decoding"
        description="Ask about the current paper claim, equation object, lab setting, saved observation, or discussion anchor. In static preview this remains a grounded prompt surface; when the gateway is configured it becomes live assistance."
        currentSection={currentRouteContext}
        nextStep={companionNextStep}
        promptSeeds={attentionCompanionSeeds}
        compact
      />

      <style jsx>{`
        .flagship-shell {
          display: grid;
          gap: 1rem;
          min-width: 0;
        }

        .carried-question,
        .route-role-studio,
        .module-map,
        .equation-workbench,
        .kv-calculator,
        .architecture-panel,
        .decode-panel,
        .discussion-panel,
        .focus-object-panel {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.09);
          border-radius: 22px;
          background: rgba(255, 251, 245, 0.86);
          box-shadow: 0 16px 34px rgba(27, 36, 48, 0.05);
        }

        .carried-question {
          display: grid;
          gap: 0.8rem;
          padding: 1rem;
          border-color: rgba(31, 111, 120, 0.16);
          background:
            linear-gradient(180deg, rgba(247, 252, 250, 0.94), rgba(255, 251, 245, 0.92)),
            linear-gradient(90deg, rgba(31, 111, 120, 0.1), rgba(194, 74, 45, 0.08));
        }

        .carried-question h2 {
          max-width: 28ch;
        }

        .carried-question p {
          margin: 0.7rem 0 0;
          max-width: 58rem;
          color: #455361;
          line-height: 1.62;
        }

        .carried-facts {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 0.55rem;
        }

        .carried-facts article,
        .prediction-checkpoint {
          display: grid;
          gap: 0.34rem;
          min-width: 0;
          padding: 0.72rem;
          border-radius: 15px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.8);
        }

        .carried-facts span,
        .prediction-copy span,
        .prediction-options span {
          font-family: var(--font-mono);
          font-size: 0.64rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #c24a2d;
        }

        .carried-facts strong {
          color: #151d27;
          line-height: 1.35;
        }

        .carried-facts :global(a) {
          color: #151d27;
          font-weight: 750;
          line-height: 1.35;
          text-decoration: none;
        }

        .carried-facts :global(a:hover) {
          color: #1f6f78;
        }

        .carried-facts em {
          color: #52606c;
          font-size: 0.82rem;
          font-style: normal;
          line-height: 1.42;
        }

        .carried-question button {
          width: max-content;
          max-width: 100%;
          min-height: 38px;
          padding: 0.55rem 0.76rem;
          border-radius: 999px;
          background: rgba(255, 251, 245, 0.9);
          color: #1b2430;
        }

        .module-map {
          display: grid;
          grid-template-columns: minmax(220px, 0.42fr) minmax(0, 1fr) minmax(240px, 0.45fr);
          gap: 0.9rem;
          padding: 1rem;
        }

        .route-role-studio {
          display: grid;
          grid-template-columns: minmax(210px, 0.34fr) minmax(0, 1fr);
          align-items: start;
          gap: 0.85rem;
          padding: 1rem;
          background:
            linear-gradient(135deg, rgba(20, 184, 166, 0.12), rgba(255, 251, 245, 0.92) 42%),
            rgba(255, 251, 245, 0.86);
        }

        .role-studio-heading,
        .module-intro,
        .stage-detail,
        .panel-heading {
          min-width: 0;
        }

        .role-studio-heading {
          grid-row: 1 / 3;
        }

        .role-studio-heading p {
          margin: 0.7rem 0 0;
          color: #455361;
          line-height: 1.58;
        }

        .role-lens-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.55rem;
          align-items: start;
          min-width: 0;
        }

        .role-lens-grid button {
          display: grid;
          align-content: start;
          gap: 0.34rem;
          min-width: 0;
          min-height: 154px;
          padding: 0.76rem;
          border-radius: 16px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.9);
          color: #1b2430;
          text-align: left;
        }

        .role-lens-grid button:hover {
          transform: translateY(-1px);
          border-color: rgba(31, 111, 120, 0.26);
          background: rgba(247, 252, 250, 0.94);
        }

        .role-lens-grid span {
          color: #c24a2d;
          font-family: var(--font-mono);
          font-size: 0.66rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .role-lens-grid strong {
          color: #151d27;
          font-size: 1rem;
          line-height: 1.15;
        }

        .role-lens-grid em {
          color: #52606c;
          font-style: normal;
          font-size: 0.82rem;
          line-height: 1.42;
        }

        .path-evidence-loop {
          grid-column: 2;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.45rem;
          min-width: 0;
          padding: 0.5rem;
          border-radius: 16px;
          border: 1px solid rgba(20, 184, 166, 0.2);
          background:
            linear-gradient(135deg, rgba(20, 184, 166, 0.18), rgba(15, 23, 42, 0.95)),
            #111827;
        }

        .path-evidence-loop :global(a) {
          display: grid;
          gap: 0.24rem;
          min-width: 0;
          padding: 0.62rem;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          background: rgba(255, 255, 255, 0.06);
          color: #d7e8ea;
          text-decoration: none;
        }

        .path-evidence-loop :global(a:hover) {
          border-color: rgba(45, 212, 191, 0.38);
          background: rgba(15, 118, 110, 0.28);
        }

        .path-evidence-loop span {
          color: #8bd8d0;
          font-family: var(--font-mono);
          font-size: 0.62rem;
        }

        .path-evidence-loop strong {
          color: #ecfeff;
          line-height: 1.1;
        }

        .path-evidence-loop em {
          color: #b9cdd1;
          font-size: 0.78rem;
          font-style: normal;
          line-height: 1.28;
        }

        .eyebrow,
        .stage-detail span,
        .symbol-grid span,
        .source-note span,
        .memory-result span,
        .architecture-list span,
        .discussion-grid span,
        .decode-controls span,
        .control-grid span {
          margin: 0 0 0.52rem;
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        h2,
        h3,
        p,
        code,
        strong,
        em {
          overflow-wrap: break-word;
        }

        h2,
        h3 {
          margin: 0;
          color: #151d27;
          line-height: 1.08;
        }

        h2::before,
        h3::before {
          content: none;
          display: none;
        }

        h2 {
          font-family: var(--font-display);
          font-size: clamp(1.75rem, 3vw, 2.5rem);
        }

        h3 {
          font-size: 1.2rem;
        }

        .module-intro p,
        .stage-detail p,
        .source-note p,
        .memory-result p,
        .architecture-list p,
        .discussion-grid p,
        .focus-object-panel p,
        .prediction-copy p,
        .prediction-feedback p,
        .decode-observation,
        .preview-note {
          margin: 0.72rem 0 0;
          color: #455361;
          line-height: 1.62;
        }

        .prediction-checkpoint {
          margin-top: 0.82rem;
          background: rgba(255, 244, 238, 0.62);
        }

        .prediction-copy {
          display: grid;
          gap: 0.3rem;
        }

        .prediction-copy strong {
          color: #151d27;
          line-height: 1.35;
        }

        .prediction-copy p,
        .prediction-feedback p,
        .unlock-note {
          margin: 0;
        }

        .unlock-note {
          color: #5b6874;
          font-size: 0.86rem;
          line-height: 1.5;
        }

        .prediction-options {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.45rem;
          margin-top: 0.5rem;
        }

        .decode-options {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .prediction-options button {
          display: grid;
          gap: 0.28rem;
          align-content: center;
          min-width: 0;
          min-height: 68px;
          padding: 0.58rem;
          border-radius: 14px;
          background: rgba(255, 251, 245, 0.9);
          color: #1b2430;
          font-weight: 750;
          text-align: left;
        }

        .prediction-options button.active.correct {
          border-color: rgba(31, 111, 120, 0.35);
          background: rgba(231, 248, 244, 0.95);
        }

        .prediction-options button.active.miss {
          border-color: rgba(194, 74, 45, 0.3);
          background: rgba(255, 238, 229, 0.95);
        }

        .prediction-feedback {
          display: grid;
          gap: 0.45rem;
          margin-top: 0.5rem;
          padding: 0.68rem;
          border-radius: 14px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(247, 252, 250, 0.86);
        }

        .prediction-feedback strong {
          color: #151d27;
          line-height: 1.35;
        }

        .prediction-feedback button {
          width: max-content;
          max-width: 100%;
          min-height: 36px;
          padding: 0.48rem 0.68rem;
          border-radius: 999px;
          background: #1f6f78;
          color: #fff;
          font-weight: 800;
        }

        .decode-checkpoint {
          margin-top: 0.8rem;
          padding: 0.68rem;
          background: rgba(247, 252, 250, 0.7);
        }

        .decode-feedback {
          background: rgba(255, 251, 245, 0.86);
        }

        .stage-strip {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
          gap: 0.45rem;
          min-width: 0;
        }

        button {
          font: inherit;
          border: 1px solid rgba(27, 36, 48, 0.1);
          cursor: pointer;
        }

        .stage-strip button {
          display: grid;
          align-content: start;
          gap: 0.34rem;
          min-width: 0;
          min-height: 138px;
          padding: 0.66rem;
          border-radius: 16px;
          background: rgba(248, 243, 234, 0.78);
          color: #1b2430;
          text-align: left;
        }

        .stage-strip button.active,
        .equation-tabs button.active,
        .precision-row button.active {
          border-color: rgba(31, 111, 120, 0.3);
          background: rgba(231, 248, 244, 0.92);
        }

        .stage-strip button span {
          color: #c24a2d;
          font-family: var(--font-mono);
          font-size: 0.68rem;
        }

        .stage-strip button strong {
          color: #151d27;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .stage-strip button em {
          color: #5b6874;
          font-style: normal;
          font-size: 0.78rem;
          line-height: 1.3;
          overflow-wrap: anywhere;
        }

        .stage-detail {
          display: grid;
          align-content: start;
          gap: 0.55rem;
          padding: 0.85rem;
          border-radius: 18px;
          background: rgba(247, 252, 250, 0.86);
        }

        .stage-detail strong {
          color: #151d27;
          line-height: 1.35;
        }

        .stage-detail :global(a),
        .source-note :global(a) {
          color: #1f6f78;
          font-weight: 700;
          text-decoration: none;
        }

        .workspace-grid,
        .comparison-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 1rem;
          min-width: 0;
        }

        .equation-workbench,
        .kv-calculator,
        .architecture-panel,
        .decode-panel,
        .discussion-panel,
        .focus-object-panel {
          padding: 1rem;
        }

        .equation-tabs,
        .precision-row,
        .module-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.48rem;
          margin-top: 0.8rem;
        }

        .equation-tabs button,
        .precision-row button,
        .module-actions button {
          min-height: 38px;
          padding: 0.52rem 0.7rem;
          border-radius: 999px;
          background: rgba(255, 251, 245, 0.9);
          color: #1b2430;
        }

        .module-actions button:disabled {
          color: #66717d;
          background: rgba(239, 232, 219, 0.8);
          cursor: not-allowed;
        }

        code {
          display: block;
          margin: 0.82rem 0 0;
          padding: 0.82rem;
          border-radius: 14px;
          background: #151d27;
          color: #fbf4e8;
          line-height: 1.55;
          white-space: pre-wrap;
        }

        .symbol-grid,
        .discussion-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
          margin-top: 0.8rem;
        }

        .symbol-grid article,
        .source-note,
        .memory-result,
        .discussion-grid article {
          min-width: 0;
          padding: 0.72rem;
          border-radius: 15px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(247, 252, 250, 0.86);
        }

        .symbol-grid article {
          display: grid;
          gap: 0.24rem;
        }

        .symbol-grid strong,
        .discussion-grid strong,
        .architecture-list strong {
          color: #151d27;
          line-height: 1.35;
        }

        .symbol-grid em {
          color: #5b6874;
          font-style: normal;
          line-height: 1.35;
        }

        .source-note {
          display: grid;
          gap: 0.25rem;
          margin-top: 0.75rem;
        }

        .control-grid,
        .decode-controls {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.65rem;
          margin-top: 0.8rem;
        }

        label {
          display: grid;
          gap: 0.38rem;
          min-width: 0;
          padding: 0.68rem;
          border-radius: 15px;
          background: rgba(247, 252, 250, 0.86);
        }

        input[type='range'] {
          width: 100%;
          min-width: 0;
          accent-color: #1f6f78;
        }

        label strong {
          color: #151d27;
        }

        label em {
          color: #697581;
          font-size: 0.78rem;
          font-style: normal;
          line-height: 1.38;
        }

        .control-grid.locked label {
          opacity: 0.76;
        }

        input:disabled {
          cursor: not-allowed;
          opacity: 0.58;
        }

        .precision-row button:disabled {
          color: #737d87;
          background: rgba(239, 232, 219, 0.72);
          cursor: not-allowed;
        }

        .memory-result {
          margin-top: 0.8rem;
          background: #1b2430;
          color: #fbf4e8;
        }

        .memory-result span {
          color: #f6b47d;
        }

        .memory-result strong {
          display: block;
          color: #fbf4e8;
          font-family: var(--font-display);
          font-size: clamp(2rem, 4vw, 3.2rem);
          line-height: 1;
        }

        .memory-result p {
          color: rgba(251, 244, 232, 0.78);
        }

        .architecture-list,
        .token-list {
          display: grid;
          gap: 0.68rem;
          margin-top: 0.9rem;
        }

        .architecture-list article,
        .token-list article {
          display: grid;
          grid-template-columns: minmax(140px, 0.7fr) minmax(0, 1fr) auto;
          gap: 0.7rem;
          align-items: center;
          min-width: 0;
          padding: 0.72rem;
          border-radius: 16px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.78);
        }

        .architecture-list em {
          color: #151d27;
          font-style: normal;
          font-weight: 800;
        }

        .bar-shell {
          position: relative;
          min-width: 0;
          height: 12px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(27, 36, 48, 0.08);
        }

        .bar-shell span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #1f6f78, #c24a2d);
        }

        .token-list article {
          grid-template-columns: minmax(70px, 0.32fr) minmax(0, 1fr) minmax(42px, auto);
          color: #66717d;
          opacity: 0.7;
        }

        .token-list article.kept {
          color: #151d27;
          opacity: 1;
          background: rgba(231, 248, 244, 0.86);
        }

        .token-list article > span {
          font-weight: 700;
        }

        .token-list strong {
          color: inherit;
        }

        .decode-observation {
          padding: 0.68rem;
          border-radius: 14px;
          border: 1px solid rgba(31, 111, 120, 0.14);
          background: rgba(231, 248, 244, 0.78);
        }

        .decode-observation strong {
          color: #151d27;
        }

        .discussion-panel {
          display: grid;
          gap: 0.8rem;
        }

        .focus-object-panel {
          display: grid;
          gap: 0.8rem;
          border-color: rgba(31, 111, 120, 0.14);
          background:
            linear-gradient(180deg, rgba(247, 252, 250, 0.9), rgba(255, 251, 245, 0.88)),
            rgba(255, 251, 245, 0.86);
        }

        .focus-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 0.48rem;
          min-width: 0;
        }

        .focus-options button {
          display: grid;
          gap: 0.28rem;
          align-content: start;
          min-width: 0;
          min-height: 68px;
          padding: 0.62rem;
          border-radius: 14px;
          background: rgba(255, 251, 245, 0.9);
          color: #1b2430;
          text-align: left;
        }

        .focus-options button.active {
          border-color: rgba(31, 111, 120, 0.34);
          background: rgba(231, 248, 244, 0.95);
        }

        .focus-options span,
        .focus-detail span {
          font-family: var(--font-mono);
          font-size: 0.64rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #c24a2d;
        }

        .focus-options strong,
        .focus-detail strong {
          color: #151d27;
          line-height: 1.24;
        }

        .focus-detail {
          display: grid;
          gap: 0.35rem;
          min-width: 0;
          padding: 0.75rem;
          border-radius: 15px;
          border: 1px solid rgba(31, 111, 120, 0.14);
          background: rgba(255, 251, 245, 0.78);
        }

        .focus-detail p {
          margin: 0;
        }

        .focus-detail em {
          width: max-content;
          max-width: 100%;
          padding: 0.28rem 0.45rem;
          border-radius: 999px;
          background: rgba(31, 111, 120, 0.1);
          color: #1f6f78;
          font-size: 0.78rem;
          font-style: normal;
          font-weight: 760;
        }

        .preview-note {
          margin: 0;
          font-size: 0.86rem;
        }

        .discussion-grid article {
          background: rgba(255, 244, 238, 0.62);
        }

        @media (max-width: 1180px) {
          .route-role-studio,
          .module-map,
          .workspace-grid,
          .comparison-grid,
          .carried-facts {
            grid-template-columns: 1fr;
          }

          .role-lens-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .role-studio-heading,
          .path-evidence-loop {
            grid-column: 1;
            grid-row: auto;
          }

          .stage-strip {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .route-role-studio,
          .module-map,
          .equation-workbench,
          .kv-calculator,
          .architecture-panel,
          .decode-panel,
          .discussion-panel,
          .focus-object-panel {
            padding: 0.85rem;
            border-radius: 18px;
          }

          .route-role-studio {
            gap: 0.62rem;
          }

          .role-studio-heading h2 {
            font-size: clamp(1.42rem, 8vw, 1.9rem);
            line-height: 1.03;
          }

          .role-studio-heading p {
            margin-top: 0.5rem;
            line-height: 1.45;
          }

          .role-lens-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.5rem;
          }

          .role-lens-grid button {
            min-height: 86px;
            padding: 0.58rem;
            border-radius: 14px;
            gap: 0.26rem;
          }

          .role-lens-grid span {
            font-size: 0.56rem;
            letter-spacing: 0.08em;
            line-height: 1.15;
          }

          .role-lens-grid strong {
            font-size: 0.92rem;
          }

          .role-lens-grid em {
            display: none;
          }

          .path-evidence-loop {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.4rem;
            padding: 0.42rem;
            border-radius: 14px;
          }

          .path-evidence-loop :global(a) {
            padding: 0.52rem;
          }

          .path-evidence-loop em {
            display: none;
          }

          .stage-strip,
          .symbol-grid,
          .discussion-grid,
          .focus-options,
          .prediction-options,
          .control-grid,
          .decode-controls {
            grid-template-columns: 1fr;
          }

          .stage-strip button {
            min-height: 0;
          }

          .architecture-list article,
          .token-list article {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}
