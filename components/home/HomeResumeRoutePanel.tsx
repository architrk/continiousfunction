import Link from 'next/link'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import {
  clearLearningRouteSnapshot,
  getSavedLearningRouteSnapshot,
  learningRouteSnapshotEventName,
  saveLearningRouteSnapshot,
  type LearningRouteSnapshot,
} from '@/lib/learningRouteSnapshot'
import { kvMemoryEquation, normalizeLearningRoutePathId } from '@/lib/learningRouteConstants'
import LearningRouteContinuityBanner from '@/components/product/LearningRouteContinuityBanner'

function graphHref(snapshot: LearningRouteSnapshot) {
  if (snapshot.graphRoute) return '/graph/?from=home#learning-route'

  if (!normalizeLearningRoutePathId(snapshot.mappingId)) return null
  return `/graph/?route=${encodeURIComponent(snapshot.mappingId)}&from=home#learning-route`
}

function searchHref(snapshot: LearningRouteSnapshot) {
  const query =
    snapshot.nextRepair ??
    snapshot.currentObject?.title ??
    snapshot.primaryEquation?.label ??
    snapshot.routeLabels[1] ??
    snapshot.routeLabels[0]

  if (!query) return '/search/#route-search-lens'

  return `/search/?q=${encodeURIComponent(query)}&from=home#route-search-lens`
}

function labHref(snapshot: LearningRouteSnapshot) {
  if (snapshot.mappingId !== 'kv-cache' || snapshot.labStatus !== 'live') return null
  return '/paths/attention-serving/?focus=kv-cache&from=home#serving-module'
}

function hasSavedLabObservation(snapshot: LearningRouteSnapshot) {
  if (snapshot.lastObservation) return true
  return (
    snapshot.routeProgress?.checkpoints?.some(
      (checkpoint) => checkpoint.id === 'kv-memory-prediction' && checkpoint.status === 'saved'
    ) ?? false
  )
}

function sourceLabel(source: LearningRouteSnapshot['source']) {
  switch (source) {
    case 'paper-map':
      return 'paper mapper'
    case 'graph':
      return 'learning graph'
    case 'attention-serving':
      return 'attention-serving module'
    case 'concept-notebook':
      return 'concept notebook'
    default:
      return 'browser session'
  }
}

function firstRepairHref(snapshot: LearningRouteSnapshot) {
  const concepts = snapshot.routeConcepts ?? []
  const repair = snapshot.nextRepair
  return (
    concepts.find((concept) => concept.label === repair)?.href ??
    concepts.find((concept, index) => index > 0 && concept.href)?.href ??
    concepts[0]?.href ??
    null
  )
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

function sourceObjectTypeLabel(type: NonNullable<LearningRouteSnapshot['currentObject']>['type']) {
  return type.replaceAll('-', ' ')
}

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value
  if (limit <= 3) return value.slice(0, limit)
  return `${value.slice(0, limit - 3).trimEnd()}...`
}

function graphNodeById(snapshot: LearningRouteSnapshot, id: string) {
  return snapshot.graphRoute?.routeNodes.find((node) => node.id === id)
}

function sourceObjectById(snapshot: LearningRouteSnapshot, id: string) {
  return snapshot.sourceObjects?.find((object) => object.id === id)
}

function labelForGraphId(snapshot: LearningRouteSnapshot, id: string) {
  return graphNodeById(snapshot, id)?.label ?? sourceObjectById(snapshot, id)?.title ?? id
}

function computedTargetLabel(snapshot: LearningRouteSnapshot) {
  const targetId = snapshot.graphRoute?.targetConceptId
  if (!targetId) return null

  return labelForGraphId(snapshot, targetId)
}

function computedKnownLabels(snapshot: LearningRouteSnapshot) {
  return snapshot.graphRoute?.knownConceptIds.map((id) => labelForGraphId(snapshot, id)) ?? []
}

function firstEdgeWitness(snapshot: LearningRouteSnapshot) {
  return snapshot.graphRoute?.edgeWitnesses[0] ?? null
}

function buildPublicStarterSnapshot(now = new Date().toISOString()): LearningRouteSnapshot {
  return {
    version: 'cf-route-snapshot-v1',
    source: 'attention-serving',
    paperTitle: 'Public trail: attention to serving',
    paperClueLabel: 'Attention to serving',
    inputKind: 'public local learning trail',
    mappingId: 'kv-cache',
    mappingTitle: 'Attention to Serving',
    routeLabels: ['Attention', 'Efficient Attention', 'RoPE', 'FlashAttention', 'Long Context', 'LLM Serving', 'Decoding'],
    routeConceptIds: [
      'attention-transformers',
      'efficient-attention',
      'rope',
      'flash-attention',
      'long-context',
      'llm-serving',
      'decoding-sampling',
    ],
    routeConcepts: [
      {
        label: 'Attention',
        href: '/domains/attention-transformers/attention-transformers/',
        role: 'Start with the weighted-copy mechanism.',
      },
      {
        label: 'Efficient Attention',
        href: '/domains/attention-transformers/efficient-attention/',
        role: 'Connect attention math to memory movement.',
      },
      {
        label: 'RoPE',
        href: '/domains/attention-transformers/rope/',
        role: 'Track relative position geometry before system scaling.',
      },
      {
        label: 'FlashAttention',
        href: '/domains/attention-transformers/flash-attention/',
        role: 'Understand IO-aware kernels before long-context pressure.',
      },
      {
        label: 'Long Context',
        href: '/domains/attention-transformers/long-context/',
        role: 'See why long prompts turn state into a systems problem.',
      },
      {
        label: 'LLM Serving',
        href: '/domains/llm-systems/llm-serving/',
        role: 'Translate the mechanism into prefill, decode, latency, and throughput.',
      },
      {
        label: 'Decoding',
        href: '/domains/llm-systems/decoding-sampling/',
        role: 'Close the path with next-token policy tradeoffs.',
      },
    ],
    nextRepair: 'Efficient Attention',
    currentQuestion: 'How does attention become a serving bottleneck?',
    primaryEquation: {
      label: 'KV memory',
      equation: kvMemoryEquation,
      confidence: 'high',
      sourceLabel: 'Attention-serving path',
    },
    labGoal: 'Predict which KV-cache term changes memory before opening the lab.',
    labStatus: 'live',
    sourceObjects: [
      {
        type: 'concept',
        id: 'attention-transformers',
        title: 'Attention',
        href: '/domains/attention-transformers/attention-transformers/',
        role: 'Start with the weighted-copy equation.',
        status: 'first concept',
        confidence: 'high',
      },
      {
        type: 'equation',
        id: 'kv-memory',
        discussionAnchorId: 'equation/attention-serving/kv-memory-symbol',
        title: 'KV memory equation',
        href: '/paths/attention-serving/?focus=kv-cache&from=home#serving-module',
        role: 'Predict which symbol the lab will reduce.',
        status: 'lab witness',
        confidence: 'high',
      },
      {
        type: 'lab',
        id: 'kv-cache-lab',
        title: 'KV memory lab',
        href: '/paths/attention-serving/?focus=kv-cache&from=home#serving-module',
        role: 'Commit a prediction, reveal the invariant, and save the observation.',
        status: 'live',
        confidence: 'high',
      },
    ],
    currentObject: {
      type: 'concept',
      id: 'attention-transformers',
      title: 'Attention',
      href: '/domains/attention-transformers/attention-transformers/',
      role: 'Start with the weighted-copy equation.',
      status: 'first concept',
      confidence: 'high',
    },
    routeProgress: {
      version: 'cf-route-progress-v1',
      stageReadiness: [
        {
          stageId: 'attention-transformers',
          label: 'Attention',
          status: 'ready',
          evidence: 'Starter trail anchors the weighted-copy mechanism first.',
          updatedAt: now,
        },
        {
          stageId: 'efficient-attention',
          label: 'Efficient Attention',
          status: 'active',
          evidence: 'Next checkpoint is cache-aware attention mechanics.',
          updatedAt: now,
        },
        {
          stageId: 'rope',
          label: 'RoPE',
          status: 'not-started',
          evidence: 'Position geometry stage is still unopened.',
        },
        {
          stageId: 'flash-attention',
          label: 'FlashAttention',
          status: 'not-started',
          evidence: 'IO-aware exact attention stage is queued after RoPE.',
        },
        {
          stageId: 'long-context',
          label: 'Long Context',
          status: 'needs-repair',
          evidence: 'Long-context pressure checks should follow RoPE and FlashAttention.',
        },
        {
          stageId: 'llm-serving',
          label: 'LLM Serving',
          status: 'needs-repair',
          evidence: 'Serving bottleneck diagnosis waits on upstream context readiness.',
        },
        {
          stageId: 'decoding-sampling',
          label: 'Decoding',
          status: 'not-started',
          evidence: 'Token-policy analysis remains unopened.',
        },
      ],
      checkpoints: [
        {
          id: 'public-trail-started',
          label: 'Trail started',
          status: 'saved',
          detail: 'Saved in this browser only.',
          updatedAt: now,
        },
        {
          id: 'kv-memory-prediction',
          label: 'KV memory prediction',
          status: 'pending',
          detail: 'Open the lab and reveal the hidden memory term.',
        },
      ],
      nextRepair: 'Efficient Attention',
      updatedAt: now,
    },
    groundingStatus: 'metadata-resolved',
    createdAt: now,
  }
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function parseTimestamp(value: string | undefined) {
  if (!value) return null

  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : timestamp
}

function latestRouteActivityTimestamp(snapshot: LearningRouteSnapshot) {
  const timestamps = [
    snapshot.createdAt,
    snapshot.routeProgress?.updatedAt,
    snapshot.lastObservation?.updatedAt,
    ...(snapshot.routeProgress?.stageReadiness ?? []).map((stage) => stage.updatedAt),
    ...(snapshot.routeProgress?.checkpoints ?? []).map((checkpoint) => checkpoint.updatedAt),
  ]
    .map(parseTimestamp)
    .filter((timestamp): timestamp is number => timestamp !== null)

  return timestamps.length ? Math.max(...timestamps) : null
}

function routeProgressHeadline(snapshot: LearningRouteSnapshot) {
  const stages = snapshot.routeProgress?.stageReadiness ?? []
  const readyCount = stages.filter((stage) => stage.status === 'ready').length
  if (stages.length > 0) return `${readyCount}/${stages.length} stages ready`

  const checkpoints = snapshot.routeProgress?.checkpoints ?? []
  const observedCheckpoints = checkpoints.filter((checkpoint) => checkpoint.status !== 'pending').length
  if (observedCheckpoints > 0) return `${pluralize(observedCheckpoints, 'checkpoint')} observed`

  return 'Snapshot saved in this browser'
}

function routeProgressDetail(snapshot: LearningRouteSnapshot) {
  const checkpoints = snapshot.routeProgress?.checkpoints ?? []
  const savedCheckpoints = checkpoints.filter((checkpoint) => checkpoint.status === 'saved').length
  const resolvedObjects = snapshot.routeProgress?.resolvedObjectIds?.length ?? 0
  const detailParts: string[] = []

  if (savedCheckpoints > 0) {
    detailParts.push(`${pluralize(savedCheckpoints, 'checkpoint')} saved`)
  }
  if (resolvedObjects > 0) {
    detailParts.push(`${pluralize(resolvedObjects, 'object')} resolved`)
  }

  const latestTimestamp = latestRouteActivityTimestamp(snapshot)
  if (latestTimestamp !== null) {
    const dateLabel = new Date(latestTimestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    detailParts.push(`Last active ${dateLabel}`)
  } else {
    detailParts.push('Local browser snapshot')
  }

  return detailParts.join(' · ')
}

const starterModes = [
  {
    label: 'Learner',
    title: 'Build the mental model',
    detail: 'Start with intuition, then repair prerequisites before derivations.',
    question: 'What is the smallest version of attention I can explain before the route gets technical?',
    nextMove: 'Follow the graph route from Attention to Efficient Attention, keeping one missing prerequisite visible.',
    href: '/graph/?route=kv-cache&from=home#learning-route',
    accent: '#2dd4bf',
  },
  {
    label: 'Researcher',
    title: 'Map a paper object',
    detail: 'Turn a clue into concepts, equations, source checks, and next questions.',
    question: 'Which claim, equation, or paper span should become the first inspectable object?',
    nextMove: 'Open Paper Mapper, extract one object, then ground it in a concept and source check.',
    href: '/paper-map/',
    accent: '#a78bfa',
  },
  {
    label: 'Experimenter',
    title: 'Make a prediction',
    detail: 'Hold variables fixed, vary one term, and save the observation locally.',
    question: 'What should change if the KV-cache story is actually right?',
    nextMove: 'Start the KV lab, commit a prediction, reveal the measurement, and carry the invariant forward.',
    href: '/paths/attention-serving/?focus=kv-cache&from=home#serving-module',
    accent: '#f59e0b',
  },
  {
    label: 'Professor',
    title: 'Teach the chain',
    detail: 'Use the route to explain the invariant, misconception, and transfer step.',
    question: 'What prerequisite, invariant, and transfer step would make this teachable?',
    nextMove: 'Open the first concept, then use the route to make the explanation reproducible.',
    href: '/domains/attention-transformers/attention-transformers/',
    accent: '#fb7185',
  },
] as const

const starterRoutePreview = ['Attention', 'Efficient Attn', 'RoPE', 'FlashAttn', 'Long Context', 'LLM Serving', 'Decoding']

export default function HomeResumeRoutePanel() {
  const [snapshot, setSnapshot] = useState<LearningRouteSnapshot | null>(null)
  const [activeStarterModeLabel, setActiveStarterModeLabel] = useState<(typeof starterModes)[number]['label']>('Learner')
  const activeStarterMode = starterModes.find((mode) => mode.label === activeStarterModeLabel) ?? starterModes[0]

  useEffect(() => {
    const refreshSnapshot = () => {
      setSnapshot(getSavedLearningRouteSnapshot())
    }

    refreshSnapshot()
    window.addEventListener('storage', refreshSnapshot)
    window.addEventListener(learningRouteSnapshotEventName, refreshSnapshot)

    return () => {
      window.removeEventListener('storage', refreshSnapshot)
      window.removeEventListener(learningRouteSnapshotEventName, refreshSnapshot)
    }
  }, [])

  if (!snapshot) {
    const startPublicTrail = () => {
      const now = new Date().toISOString()
      const starterSnapshot = buildPublicStarterSnapshot(now)
      const nextSnapshot: LearningRouteSnapshot = {
        ...starterSnapshot,
        currentQuestion: activeStarterMode.question,
        labGoal: activeStarterMode.nextMove,
        currentObject: starterSnapshot.currentObject
          ? {
              ...starterSnapshot.currentObject,
              role: activeStarterMode.detail,
              status: `${activeStarterMode.label.toLowerCase()} lens selected`,
            }
          : starterSnapshot.currentObject,
        routeProgress: starterSnapshot.routeProgress
          ? {
              ...starterSnapshot.routeProgress,
              checkpoints: [
                {
                  id: 'starter-mode-lens',
                  label: `${activeStarterMode.label} lens`,
                  status: 'saved',
                  detail: activeStarterMode.nextMove,
                  updatedAt: now,
                },
                ...(starterSnapshot.routeProgress.checkpoints ?? []),
              ],
              updatedAt: now,
            }
          : starterSnapshot.routeProgress,
      }
      saveLearningRouteSnapshot(nextSnapshot)
      setSnapshot(nextSnapshot)
    }

    return (
      <section className="starter-panel" aria-labelledby="local-trail-title">
        <div className="starter-copy">
          <div className="starter-kicker-row">
            <p className="eyebrow">Continuous Function Command Deck</p>
            <span>local-only memory</span>
          </div>
          <h2 id="local-trail-title">Start from the way you are thinking.</h2>
          <p className="starter-intro">
            Choose a mode, then carry one question through a concept route, equation witness, runnable lab, and
            discussion object. The home page remembers the route in this browser so the next step is never a cold catalog.
          </p>

          <div className="starter-mode-grid" aria-label="Ways to use Continuous Function">
            {starterModes.map((mode) => (
              <button
                key={mode.label}
                type="button"
                className={`mode-card ${activeStarterMode.label === mode.label ? 'is-active' : ''}`}
                style={{ '--mode-accent': mode.accent } as CSSProperties}
                aria-pressed={activeStarterMode.label === mode.label}
                onClick={() => setActiveStarterModeLabel(mode.label)}
              >
                <span>{mode.label}</span>
                <strong>{mode.title}</strong>
                <em>{mode.detail}</em>
              </button>
            ))}
          </div>
        </div>

        <div className="starter-card">
          <div className="route-console-header">
            <div>
              <span>Starter route</span>
              <strong>Attention to Serving</strong>
              <em>source-grounded concept path with a live KV-cache lab</em>
            </div>
            <span className="console-status">ready</span>
          </div>

          <div className="starter-lens-panel" style={{ '--mode-accent': activeStarterMode.accent } as CSSProperties}>
            <span>{activeStarterMode.label} lens</span>
            <strong>{activeStarterMode.question}</strong>
            <p>{activeStarterMode.nextMove}</p>
            <Link href={activeStarterMode.href}>Open this surface</Link>
          </div>

          <div className="route-map" aria-label="Attention to Serving route preview">
            {starterRoutePreview.map((label, index) => (
              <span key={label} className={index === 0 ? 'active-node' : ''}>
                <i />
                {label}
              </span>
            ))}
          </div>

          <div className="lab-grid" aria-label="Equation and prediction checkpoint">
            <article className="lab-note equation-note">
              <span>Equation witness</span>
              <code>{kvMemoryEquation}</code>
              <p>Track which term grows when context length changes.</p>
            </article>
            <article className="lab-note">
              <span>Prediction checkpoint</span>
              <strong>Which symbol changes memory first?</strong>
              <p>Commit an answer before the lab reveals the invariant.</p>
            </article>
          </div>

          <div className="starter-steps" aria-label="Account-free learning loop">
            <article>
              <span>1</span>
              <strong>Object</strong>
              <p>Begin from a paper clue, concept node, equation, or route.</p>
            </article>
            <article>
              <span>2</span>
              <strong>Witness</strong>
              <p>Read the invariant in words, math, code, and a toy lab.</p>
            </article>
            <article>
              <span>3</span>
              <strong>Discussion</strong>
              <p>Ask from the exact object in view and keep the next repair attached.</p>
            </article>
          </div>

          <div className="starter-actions">
            <button type="button" onClick={startPublicTrail}>
              Start local trail
            </button>
            <Link href="/graph/?route=kv-cache&from=home#learning-route">See route graph</Link>
            <Link href="/paper-map/">Map a paper instead</Link>
          </div>
        </div>

        <style jsx>{`
          .starter-panel {
            position: relative;
            isolation: isolate;
            overflow: hidden;
            display: grid;
            grid-template-columns: minmax(0, 0.88fr) minmax(380px, 1.12fr);
            gap: 1rem;
            align-items: stretch;
            box-sizing: border-box;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            min-height: min(560px, calc(100vh - 132px));
            padding: clamp(1rem, 2vw, 1.35rem);
            border-radius: 28px;
            border: 1px solid rgba(139, 198, 191, 0.2);
            background:
              linear-gradient(rgba(95, 165, 185, 0.08) 1px, transparent 1px),
              linear-gradient(90deg, rgba(95, 165, 185, 0.08) 1px, transparent 1px),
              radial-gradient(circle at 16% 18%, rgba(45, 212, 191, 0.25), transparent 30%),
              radial-gradient(circle at 82% 14%, rgba(167, 139, 250, 0.26), transparent 28%),
              radial-gradient(circle at 80% 86%, rgba(245, 158, 11, 0.18), transparent 26%),
              linear-gradient(135deg, #07111d 0%, #101827 48%, #18151f 100%);
            background-size: 34px 34px, 34px 34px, auto, auto, auto, auto;
            box-shadow:
              0 28px 72px rgba(5, 12, 20, 0.22),
              inset 0 1px 0 rgba(255, 255, 255, 0.08);
            color: #f8f3ea;
          }

          .starter-panel::before {
            content: '';
            position: absolute;
            inset: 1rem;
            z-index: -1;
            border: 1px solid rgba(248, 243, 234, 0.08);
            border-radius: 20px;
            pointer-events: none;
          }

          .starter-panel::after {
            content: '';
            position: absolute;
            inset: auto -12% -34% 48%;
            z-index: -1;
            height: 280px;
            background: radial-gradient(circle, rgba(194, 74, 45, 0.24), transparent 62%);
            pointer-events: none;
          }

          .starter-copy,
          .starter-card,
          .starter-steps article,
          .lab-note {
            box-sizing: border-box;
            min-width: 0;
          }

          .starter-copy {
            display: grid;
            align-content: space-between;
            gap: 1rem;
            padding: clamp(0.45rem, 1.2vw, 0.85rem);
          }

          .starter-kicker-row {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 0.55rem;
          }

          .eyebrow {
            margin: 0;
            font-family: var(--font-mono);
            font-size: 0.74rem;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: #7dd3fc;
          }

          .starter-kicker-row span,
          .console-status {
            display: inline-flex;
            align-items: center;
            min-height: 28px;
            padding: 0.34rem 0.58rem;
            border-radius: 999px;
            border: 1px solid rgba(45, 212, 191, 0.28);
            background: rgba(45, 212, 191, 0.1);
            color: #ccfbf1;
            font-family: var(--font-mono);
            font-size: 0.7rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          h2 {
            margin: 0;
            max-width: 14ch;
            font-family: var(--font-display);
            font-size: clamp(2.15rem, 4.4vw, 4rem);
            line-height: 0.96;
            color: #fff8ed;
            text-wrap: balance;
          }

          h2::before {
            content: none;
            display: none;
          }

          .starter-intro {
            margin: 0;
            max-width: 58ch;
            color: rgba(248, 243, 234, 0.78);
            line-height: 1.68;
            overflow-wrap: anywhere;
          }

          .starter-mode-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.62rem;
            align-self: end;
          }

          .starter-mode-grid :global(.mode-card) {
            display: grid;
            gap: 0.34rem;
            min-height: 138px;
            min-width: 0;
            padding: 0.82rem;
            border-radius: 8px;
            border: 1px solid color-mix(in srgb, var(--mode-accent) 44%, transparent);
            background:
              linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.025)),
              linear-gradient(90deg, color-mix(in srgb, var(--mode-accent) 18%, transparent), transparent 70%);
            color: inherit;
            font: inherit;
            text-align: left;
            text-decoration: none;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
            overflow: hidden;
            overflow-wrap: anywhere;
            cursor: pointer;
            appearance: none;
            transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
          }

          .starter-mode-grid :global(.mode-card:hover),
          .starter-mode-grid :global(.mode-card.is-active) {
            transform: translateY(-2px);
            border-color: color-mix(in srgb, var(--mode-accent) 70%, transparent);
          }

          .starter-mode-grid :global(.mode-card.is-active) {
            background:
              linear-gradient(180deg, color-mix(in srgb, var(--mode-accent) 18%, rgba(255, 255, 255, 0.09)), rgba(255, 255, 255, 0.04)),
              linear-gradient(90deg, color-mix(in srgb, var(--mode-accent) 28%, transparent), transparent 74%);
            box-shadow:
              inset 0 0 0 1px color-mix(in srgb, var(--mode-accent) 34%, transparent),
              inset 0 1px 0 rgba(255, 255, 255, 0.1);
          }

          .starter-mode-grid :global(.mode-card:focus-visible) {
            outline: 2px solid color-mix(in srgb, var(--mode-accent) 70%, white);
            outline-offset: 3px;
          }

          .starter-mode-grid :global(.mode-card span) {
            width: fit-content;
            color: color-mix(in srgb, var(--mode-accent) 86%, white);
            font-family: var(--font-mono);
            font-size: 0.7rem;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          .starter-mode-grid :global(.mode-card strong) {
            color: #fff8ed;
            line-height: 1.16;
          }

          .starter-mode-grid :global(.mode-card em) {
            color: rgba(248, 243, 234, 0.66);
            font-size: 0.82rem;
            font-style: normal;
            line-height: 1.45;
          }

          .starter-card {
            display: grid;
            gap: 0.85rem;
            align-content: start;
            padding: clamp(0.8rem, 1.8vw, 1rem);
            border-radius: 8px;
            border: 1px solid rgba(248, 243, 234, 0.14);
            background:
              linear-gradient(180deg, rgba(248, 243, 234, 0.1), rgba(248, 243, 234, 0.035)),
              rgba(5, 12, 20, 0.46);
            box-shadow:
              0 20px 48px rgba(0, 0, 0, 0.2),
              inset 0 1px 0 rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(12px) saturate(116%);
          }

          .starter-lens-panel {
            display: grid;
            gap: 0.46rem;
            min-width: 0;
            padding: 0.86rem;
            border-radius: 8px;
            border: 1px solid color-mix(in srgb, var(--mode-accent) 42%, rgba(248, 243, 234, 0.1));
            border-left: 4px solid var(--mode-accent);
            background:
              radial-gradient(circle at 12% 20%, color-mix(in srgb, var(--mode-accent) 18%, transparent), transparent 46%),
              rgba(248, 243, 234, 0.065);
          }

          .starter-lens-panel span {
            width: fit-content;
            color: color-mix(in srgb, var(--mode-accent) 86%, white);
            font-family: var(--font-mono);
            font-size: 0.68rem;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          .starter-lens-panel strong {
            color: #fff8ed;
            line-height: 1.24;
            overflow-wrap: anywhere;
          }

          .starter-lens-panel p {
            margin: 0;
            color: rgba(248, 243, 234, 0.68);
            line-height: 1.5;
            overflow-wrap: anywhere;
          }

          .starter-lens-panel :global(a) {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: fit-content;
            min-height: 44px;
            max-width: 100%;
            padding: 0.48rem 0.7rem;
            border-radius: 999px;
            border: 1px solid rgba(248, 243, 234, 0.16);
            background: rgba(248, 243, 234, 0.92);
            color: #07111d;
            font-size: 0.82rem;
            font-weight: 800;
            line-height: 1.15;
            text-align: center;
            text-decoration: none;
          }

          .route-console-header {
            display: flex;
            gap: 1rem;
            justify-content: space-between;
            align-items: start;
            padding: 0.8rem;
            border-radius: 8px;
            border: 1px solid rgba(248, 243, 234, 0.12);
            background:
              radial-gradient(circle at 18% 20%, rgba(45, 212, 191, 0.16), transparent 52%),
              rgba(248, 243, 234, 0.06);
          }

          .route-console-header div,
          .lab-note {
            display: grid;
            gap: 0.34rem;
          }

          .route-console-header span,
          .lab-note span {
            font-family: var(--font-mono);
            font-size: 0.68rem;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #7dd3fc;
          }

          .route-console-header strong {
            color: #fff8ed;
            font-size: clamp(1.18rem, 2vw, 1.55rem);
            line-height: 1.08;
          }

          .route-console-header em {
            color: rgba(248, 243, 234, 0.68);
            font-style: normal;
            line-height: 1.35;
          }

          .route-map {
            position: relative;
            display: grid;
            grid-template-columns: repeat(7, minmax(0, 1fr));
            gap: 0.44rem;
            padding: 0.78rem;
            border-radius: 8px;
            border: 1px solid rgba(125, 211, 252, 0.16);
            background:
              linear-gradient(90deg, rgba(45, 212, 191, 0.08), transparent 48%, rgba(245, 158, 11, 0.08)),
              rgba(2, 6, 12, 0.34);
          }

          .route-map span {
            position: relative;
            display: grid;
            gap: 0.4rem;
            align-content: start;
            min-height: 76px;
            padding: 0.5rem 0.42rem;
            border-radius: 8px;
            border: 1px solid rgba(248, 243, 234, 0.1);
            background: rgba(248, 243, 234, 0.055);
            color: rgba(248, 243, 234, 0.74);
            font-size: 0.72rem;
            line-height: 1.22;
            overflow-wrap: anywhere;
          }

          .route-map i {
            display: block;
            width: 12px;
            height: 12px;
            border-radius: 999px;
            background: #7dd3fc;
            box-shadow: 0 0 18px rgba(125, 211, 252, 0.5);
          }

          .route-map .active-node {
            border-color: rgba(45, 212, 191, 0.46);
            color: #fff8ed;
            background: rgba(45, 212, 191, 0.12);
          }

          .route-map .active-node i {
            background: #2dd4bf;
            box-shadow: 0 0 22px rgba(45, 212, 191, 0.72);
          }

          .lab-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
            gap: 0.65rem;
          }

          .lab-note {
            padding: 0.86rem;
            border-radius: 8px;
            border: 1px solid rgba(248, 243, 234, 0.12);
            background: rgba(248, 243, 234, 0.07);
          }

          .equation-note {
            background:
              linear-gradient(135deg, rgba(45, 212, 191, 0.13), transparent 68%),
              rgba(248, 243, 234, 0.07);
          }

          .lab-note code {
            display: block;
            max-width: 100%;
            padding: 0.58rem;
            border-radius: 8px;
            overflow-x: auto;
            background: rgba(2, 6, 12, 0.42);
            color: #ccfbf1;
            font-family: var(--font-mono);
            font-size: 0.75rem;
            line-height: 1.45;
          }

          .lab-note strong {
            color: #fff8ed;
            line-height: 1.22;
          }

          .lab-note p {
            margin: 0;
            color: rgba(248, 243, 234, 0.66);
            line-height: 1.46;
          }

          .starter-steps {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.65rem;
          }

          .starter-steps article,
          .starter-focus {
            display: grid;
            gap: 0.4rem;
            padding: 0.82rem;
            border-radius: 8px;
            border: 1px solid rgba(248, 243, 234, 0.1);
            background: rgba(248, 243, 234, 0.055);
          }

          .starter-steps span {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border-radius: 999px;
            background: rgba(245, 158, 11, 0.16);
            color: #fcd34d;
            border: 1px solid rgba(245, 158, 11, 0.24);
            font-family: var(--font-mono);
            font-size: 0.78rem;
            font-weight: 800;
          }

          .starter-focus span {
            font-family: var(--font-mono);
            font-size: 0.72rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #c24a2d;
          }

          .starter-steps strong,
          .starter-focus strong {
            color: #fff8ed;
            line-height: 1.3;
            overflow-wrap: break-word;
          }

          .starter-steps p,
          .starter-focus em {
            margin: 0;
            color: rgba(248, 243, 234, 0.62);
            font-style: normal;
            line-height: 1.5;
          }

          .starter-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.65rem;
          }

          .starter-actions :global(a),
          .starter-actions button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 42px;
            padding: 0.72rem 0.9rem;
            border-radius: 999px;
            border: 1px solid rgba(248, 243, 234, 0.16);
            font: inherit;
            font-weight: 700;
            text-decoration: none;
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          }

          .starter-actions button {
            color: #07111d;
            background: #f8d16d;
            border-color: rgba(248, 209, 109, 0.88);
          }

          .starter-actions :global(a) {
            color: #f8f3ea;
            background: rgba(248, 243, 234, 0.08);
          }

          .starter-actions :global(a:hover),
          .starter-actions button:hover {
            transform: translateY(-1px);
            box-shadow: 0 14px 26px rgba(0, 0, 0, 0.2);
            border-color: rgba(45, 212, 191, 0.42);
          }

          .starter-actions :global(a:focus-visible),
          .starter-actions button:focus-visible {
            outline: 2px solid rgba(31, 111, 120, 0.48);
            outline-offset: 3px;
          }

          @media (max-width: 980px) {
            .starter-panel {
              grid-template-columns: 1fr;
              min-height: auto;
            }

            .starter-copy {
              align-content: start;
            }
          }

          @media (max-width: 640px) {
            .starter-panel {
              width: 100%;
              max-width: 100%;
              padding: 0.9rem;
              border-radius: 20px;
            }

            .starter-card,
            .starter-copy {
              width: 100%;
              max-width: 100%;
            }

            .starter-steps {
              grid-template-columns: 1fr;
            }

            .lab-grid {
              grid-template-columns: 1fr;
            }

            .starter-mode-grid {
              grid-template-columns: 1fr;
              gap: 0.5rem;
            }

            .starter-mode-grid :global(.mode-card) {
              min-height: 0;
              padding: 0.72rem;
              overflow: visible;
            }

            .starter-mode-grid :global(.mode-card strong) {
              font-size: 0.92rem;
            }

            .starter-lens-panel :global(a) {
              width: 100%;
            }

            .starter-mode-grid :global(.mode-card em) {
              font-size: 0.72rem;
              line-height: 1.36;
            }

            .route-console-header {
              display: grid;
            }

            .route-map {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .starter-actions,
            .starter-actions :global(a),
            .starter-actions button {
              width: 100%;
            }
          }

          @media (max-width: 360px) {
            .starter-mode-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </section>
    )
  }

  const activeGraphHref = graphHref(snapshot)
  const activeLabHref = labHref(snapshot)
  const activeSearchHref = searchHref(snapshot)
  const repairHref = firstRepairHref(snapshot)
  const conceptObjectHref = snapshot.source === 'concept-notebook' ? snapshot.currentObject?.href ?? null : null
  const continueHref = activeGraphHref ?? conceptObjectHref ?? repairHref
  const routeLabels = snapshot.routeLabels.length ? snapshot.routeLabels : ['Mapped paper']
  const visibleLabels = routeLabels.slice(0, 3)
  const hiddenCount = Math.max(routeLabels.length - visibleLabels.length, 0)
  const labStatus = snapshot.labStatus === 'live' ? 'KV memory lab live' : 'No live lab yet'
  const question = truncate(snapshot.currentQuestion ?? 'What should I inspect next?', 120)
  const paperLabel = truncate(snapshot.paperClueLabel ?? snapshot.paperTitle, 150)
  const mappingLabel = snapshot.mappingTitle ? truncate(snapshot.mappingTitle, 120) : null
  const localProgressHeadline = routeProgressHeadline(snapshot)
  const localProgressDetail = routeProgressDetail(snapshot)
  const continueLabel = activeGraphHref
    ? 'Continue route'
    : conceptObjectHref
      ? 'Resume concept object'
      : snapshot.nextRepair
        ? `Repair ${snapshot.nextRepair}`
        : 'Open first concept'
  const clueLabel =
    snapshot.source === 'paper-map'
      ? 'Paper / clue'
      : snapshot.source === 'attention-serving'
        ? 'Module / route'
        : snapshot.source === 'concept-notebook'
          ? 'Concept / object'
          : 'Question / route'
  const knownLabels = computedKnownLabels(snapshot)
  const targetLabel = computedTargetLabel(snapshot)
  const witness = firstEdgeWitness(snapshot)
  const graphRouteNodes = snapshot.graphRoute?.routeNodes ?? []
  const currentObject = snapshot.currentObject
  const currentObjectLabel = currentObject?.title ?? snapshot.primaryEquation?.label ?? snapshot.nextRepair ?? 'Route question'
  const currentObjectMeta = currentObject
    ? `${sourceObjectTypeLabel(currentObject.type)}${currentObject.status ? ` · ${currentObject.status}` : ''}`
    : snapshot.primaryEquation
      ? 'equation carried'
      : 'route focus pending'
  const routeFirstDetail =
    currentObject?.role ??
    (snapshot.nextRepair ? `Repair ${snapshot.nextRepair} before extending the route.` : 'Continue the saved route.')
  const shouldPrioritizeLabAction = Boolean(activeLabHref) && hasSavedLabObservation(snapshot)
  const nextActionLabel = shouldPrioritizeLabAction ? 'Open KV memory lab' : continueLabel
  const nextActionDetail = shouldPrioritizeLabAction
    ? snapshot.lastObservation?.nextQuestion ?? snapshot.labGoal ?? routeFirstDetail
    : routeFirstDetail
  const resumeDetail = snapshot.graphRoute
    ? 'Saved only in this browser with the known concepts, target, first repair, and route cost still attached.'
    : snapshot.source === 'concept-notebook'
      ? 'Saved only in this browser with the focused concept object, current question, and next concept still attached.'
    : 'Saved only in this browser with the starting clue, equation, first repair, and grounding status still attached.'

  const clearRoute = () => {
    clearLearningRouteSnapshot()
    setSnapshot(null)
  }

  return (
    <section className="resume-route-panel" aria-label="Resume saved learning route">
      <LearningRouteContinuityBanner surface="home" snapshot={snapshot} onClear={clearRoute} compact />

      <details className="resume-route-details">
        <summary>Route details</summary>
        <div className="resume-route-detail-grid">
          <div className="resume-copy">
            <p className="eyebrow">Resume Your Route</p>
            <h2 id="resume-route-detail-title">Saved route detail</h2>
            <p>
              <strong>{question}</strong>
              <br />
              Continue the route mapped from the {sourceLabel(snapshot.source)}. {resumeDetail}
            </p>
          </div>

          <div className="resume-card">
            <div className="paper-line">
              <span>{clueLabel}</span>
              <strong>{paperLabel}</strong>
              {mappingLabel ? <em>Mapped route: {mappingLabel}</em> : null}
            </div>

            <div className="route-chips" aria-label="Saved concept route">
              {visibleLabels.map((label, index) => (
                <span key={`${label}-${index}`}>{label}</span>
              ))}
              {hiddenCount > 0 ? <span>+{hiddenCount} more</span> : null}
            </div>

            <div className="resume-local-progress">
              <span>Detailed progress</span>
              <strong>{localProgressHeadline}</strong>
              <small>{localProgressDetail}</small>
            </div>

            {snapshot.graphRoute ? (
              <div className="resume-graph-context">
                <span>Computed route context</span>
                <strong>
                  Known: {knownLabels.slice(0, 4).join(', ')}
                  {knownLabels.length > 4 ? ` +${knownLabels.length - 4} more` : ''}
                </strong>
                {targetLabel ? <em>Target: {targetLabel}</em> : null}
                <p>Route: {graphRouteNodes.map((node) => node.label).join(' -> ')}</p>
                {witness ? (
                  <small>
                    First edge: {labelForGraphId(snapshot, witness.from)}
                    {' -> '}
                    {labelForGraphId(snapshot, witness.to)} · {witness.type}
                  </small>
                ) : null}
              </div>
            ) : null}

            <div className="resume-current-object">
              <span>Current object</span>
              {currentObject?.href ? <Link href={currentObject.href}>{currentObjectLabel}</Link> : <strong>{currentObjectLabel}</strong>}
              <em>{currentObjectMeta}</em>
              {currentObject?.role ? <p>{currentObject.role}</p> : null}
            </div>

            <div className="resume-next-action">
              <span>Next action</span>
              <strong>{nextActionLabel}</strong>
              <p>{truncate(nextActionDetail, 180)}</p>
            </div>

            <div className="resume-facts">
              {snapshot.graphRoute ? (
                <>
                  <article>
                    <span>Known</span>
                    <strong>
                      {knownLabels.slice(0, 3).join(', ')}
                      {knownLabels.length > 3 ? ` +${knownLabels.length - 3}` : ''}
                    </strong>
                  </article>
                  <article>
                    <span>Target</span>
                    <strong>{targetLabel ?? snapshot.graphRoute.targetConceptId}</strong>
                  </article>
                  <article>
                    <span>First repair</span>
                    <strong>{snapshot.nextRepair ?? 'Target is next'}</strong>
                  </article>
                  <article>
                    <span>Route cost</span>
                    <strong>{snapshot.graphRoute.totalWeight.toFixed(2)}</strong>
                  </article>
                </>
              ) : (
                <>
                  <article>
                    <span>Equation</span>
                    <code>{snapshot.primaryEquation?.equation ?? 'No equation carried yet'}</code>
                  </article>
                  <article>
                    <span>First repair</span>
                    <strong>{snapshot.nextRepair ?? routeLabels[1] ?? routeLabels[0]}</strong>
                  </article>
                  <article>
                    <span>Grounding</span>
                    <strong>{groundingLabel(snapshot.groundingStatus)}</strong>
                  </article>
                  <article>
                    <span>Status</span>
                    <strong>{labStatus}</strong>
                  </article>
                </>
              )}
            </div>

            <div className="resume-actions">
              {continueHref ? <Link href={continueHref}>{continueLabel}</Link> : null}
              <Link href={activeSearchHref}>Search this route</Link>
              {activeLabHref ? <Link href={activeLabHref}>Open KV memory lab</Link> : null}
              <button type="button" onClick={clearRoute} aria-label="Clear saved learning route from this browser">
                Clear saved route
              </button>
            </div>
          </div>
        </div>
      </details>

      <style jsx>{`
        .resume-route-panel {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          align-items: stretch;
          min-width: 0;
          padding: 1.2rem;
          border-radius: 24px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(135deg, rgba(255, 251, 245, 0.9), rgba(241, 247, 244, 0.88)),
            radial-gradient(circle at 14% 16%, rgba(15, 118, 110, 0.13), transparent 30%),
              radial-gradient(circle at 86% 20%, rgba(194, 74, 45, 0.11), transparent 28%);
        }

        .resume-route-details {
          min-width: 0;
        }

        .resume-route-details summary {
          display: inline-flex;
          align-items: center;
          width: max-content;
          max-width: 100%;
          min-height: 34px;
          padding: 0.42rem 0.65rem;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.86);
          color: #1b2430;
          font-weight: 730;
          cursor: pointer;
        }

        .resume-route-details summary:focus-visible {
          outline: 2px solid rgba(31, 111, 120, 0.42);
          outline-offset: 2px;
        }

        .resume-route-detail-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.82fr) minmax(320px, 1fr);
          gap: 1rem;
          align-items: stretch;
          min-width: 0;
          margin-top: 0.75rem;
        }

        .resume-copy,
        .resume-card,
        .resume-facts article {
          min-width: 0;
        }

        .eyebrow {
          margin: 0 0 0.55rem;
          font-family: var(--font-mono);
          font-size: 0.74rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        h2,
        p,
        strong {
          overflow-wrap: break-word;
        }

        h2 {
          margin: 0;
          max-width: 18ch;
          font-family: var(--font-display);
          font-size: clamp(1.8rem, 3.6vw, 2.85rem);
          line-height: 1;
          color: #151d27;
        }

        h2::before {
          content: none;
          display: none;
        }

        .resume-copy p:last-child {
          margin: 0.9rem 0 0;
          max-width: 56ch;
          color: #455361;
          line-height: 1.76;
        }

        .resume-card {
          display: grid;
          gap: 0.85rem;
          padding: 1rem;
          border-radius: 20px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.86);
          box-shadow: 0 16px 32px rgba(27, 36, 48, 0.05);
        }

        .paper-line {
          display: grid;
          gap: 0.35rem;
        }

        .paper-line span,
        .resume-facts span {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #65717d;
        }

        .paper-line strong {
          font-size: 1rem;
          line-height: 1.35;
          color: #151d27;
        }

        .paper-line em {
          margin: 0;
          font-style: normal;
          line-height: 1.45;
          color: #52606c;
        }

        .route-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .route-chips span {
          display: inline-flex;
          align-items: center;
          min-height: 32px;
          padding: 0.45rem 0.62rem;
          border-radius: 999px;
          border: 1px solid rgba(31, 111, 120, 0.18);
          background: rgba(239, 247, 244, 0.88);
          color: #26434a;
          font-size: 0.82rem;
          font-weight: 650;
        }

        .resume-facts {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.65rem;
        }

        .resume-observation {
          display: grid;
          gap: 0.32rem;
          min-width: 0;
          padding: 0.82rem;
          border-radius: 16px;
          border: 1px solid rgba(31, 111, 120, 0.16);
          background: rgba(231, 248, 244, 0.72);
        }

        .resume-current-object,
        .resume-next-action {
          display: grid;
          gap: 0.34rem;
          min-width: 0;
          padding: 0.82rem;
          border-radius: 16px;
          border: 1px solid rgba(194, 74, 45, 0.16);
          background: rgba(255, 244, 238, 0.68);
        }

        .resume-next-action {
          border-color: rgba(31, 111, 120, 0.16);
          background: rgba(231, 248, 244, 0.72);
        }

        .resume-local-progress {
          display: grid;
          gap: 0.28rem;
          min-width: 0;
          padding: 0.76rem 0.82rem;
          border-radius: 14px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 255, 255, 0.58);
        }

        .resume-local-progress span {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #51606d;
        }

        .resume-local-progress strong,
        .resume-local-progress small {
          margin: 0;
          line-height: 1.48;
          overflow-wrap: break-word;
        }

        .resume-local-progress strong {
          color: #151d27;
          font-size: 0.95rem;
        }

        .resume-local-progress small {
          color: #455361;
          font-size: 0.8rem;
        }

        .resume-graph-context {
          display: grid;
          gap: 0.35rem;
          min-width: 0;
          padding: 0.82rem;
          border-radius: 16px;
          border: 1px solid rgba(194, 74, 45, 0.16);
          background: rgba(255, 244, 238, 0.68);
        }

        .resume-graph-context span {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #c24a2d;
        }

        .resume-graph-context strong,
        .resume-graph-context em,
        .resume-graph-context p,
        .resume-graph-context small {
          margin: 0;
          line-height: 1.5;
          overflow-wrap: break-word;
        }

        .resume-graph-context strong {
          color: #151d27;
        }

        .resume-graph-context em {
          color: #26434a;
          font-style: normal;
          font-weight: 650;
        }

        .resume-graph-context p,
        .resume-graph-context small {
          color: #455361;
        }

        .resume-current-object span,
        .resume-next-action span {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #c24a2d;
        }

        .resume-next-action span {
          color: #1f6f78;
        }

        .resume-current-object strong,
        .resume-current-object :global(a),
        .resume-next-action strong {
          color: #151d27;
          font-weight: 750;
          line-height: 1.35;
          text-decoration: none;
        }

        .resume-current-object :global(a:hover) {
          color: #1f6f78;
        }

        .resume-current-object p,
        .resume-current-object em,
        .resume-next-action p {
          margin: 0;
          color: #455361;
          font-style: normal;
          line-height: 1.52;
        }

        .resume-observation span {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        .resume-observation strong {
          color: #151d27;
          line-height: 1.35;
        }

        .resume-observation p,
        .resume-observation em,
        .resume-observation small {
          margin: 0;
          color: #455361;
          line-height: 1.52;
        }

        .resume-observation small {
          font-size: 0.82rem;
        }

        .resume-observation em {
          font-style: normal;
          font-weight: 650;
        }

        .resume-facts article {
          display: grid;
          gap: 0.35rem;
          min-height: 108px;
          padding: 0.82rem;
          border-radius: 16px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 255, 255, 0.52);
        }

        .resume-facts strong {
          align-self: end;
          font-size: 0.92rem;
          line-height: 1.42;
          color: #1b2430;
        }

        .resume-facts code {
          align-self: end;
          padding: 0.5rem;
          border-radius: 12px;
          background: rgba(27, 36, 48, 0.06);
          color: #17202b;
          font-size: 0.84rem;
          line-height: 1.45;
          white-space: normal;
          overflow-wrap: anywhere;
        }

        .resume-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem;
          align-items: center;
        }

        .resume-actions :global(a),
        .resume-actions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 0.72rem 0.9rem;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.12);
          font: inherit;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
        }

        .resume-actions :global(a:first-child) {
          color: #fff;
          background: #1f4b99;
          border-color: #1f4b99;
        }

        .resume-actions :global(a:not(:first-child)),
        .resume-actions button {
          color: #1b2430;
          background: rgba(255, 251, 245, 0.92);
        }

        .resume-actions :global(a:hover),
        .resume-actions button:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 24px rgba(27, 36, 48, 0.09);
        }

        .resume-actions :global(a:focus-visible),
        .resume-actions button:focus-visible {
          outline: 2px solid rgba(31, 111, 120, 0.48);
          outline-offset: 3px;
        }

        @media (max-width: 980px) {
          .resume-route-detail-grid {
            grid-template-columns: 1fr;
          }

          h2 {
            max-width: 16ch;
          }
        }

        @media (max-width: 640px) {
          .resume-route-panel {
            gap: 0.58rem;
            padding: 0.68rem;
            border-radius: 16px;
          }

          .eyebrow {
            margin-bottom: 0.28rem;
            font-size: 0.64rem;
            letter-spacing: 0.1em;
          }

          h2 {
            max-width: none;
            font-size: clamp(1.18rem, 5vw, 1.42rem);
            line-height: 1.08;
          }

          .resume-copy p:last-child {
            display: none;
          }

          .resume-card {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.5rem;
            padding: 0.62rem;
            border-radius: 15px;
          }

          .paper-line,
          .route-chips,
          .resume-local-progress,
          .resume-graph-context,
          .resume-observation,
          .resume-facts,
          .resume-actions {
            grid-column: 1 / -1;
          }

          .paper-line {
            gap: 0.2rem;
          }

          .paper-line span,
          .resume-local-progress span,
          .resume-current-object span,
          .resume-next-action span,
          .resume-observation span,
          .resume-graph-context span,
          .resume-facts span {
            font-size: 0.6rem;
            letter-spacing: 0.08em;
          }

          .paper-line strong {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
            font-size: 0.86rem;
            line-height: 1.25;
          }

          .paper-line em {
            display: none;
          }

          .route-chips {
            flex-wrap: nowrap;
            gap: 0.34rem;
            overflow-x: auto;
            padding-bottom: 0.05rem;
          }

          .route-chips span {
            flex: 0 0 auto;
            min-height: 27px;
            padding: 0.32rem 0.48rem;
            font-size: 0.72rem;
          }

          .resume-local-progress,
          .resume-current-object,
          .resume-next-action,
          .resume-observation,
          .resume-graph-context {
            padding: 0.56rem;
            border-radius: 12px;
            gap: 0.24rem;
          }

          .resume-local-progress strong,
          .resume-current-object strong,
          .resume-current-object :global(a),
          .resume-next-action strong,
          .resume-observation strong,
          .resume-graph-context strong {
            font-size: 0.84rem;
            line-height: 1.24;
          }

          .resume-local-progress small,
          .resume-current-object p,
          .resume-current-object em,
          .resume-next-action p,
          .resume-observation p,
          .resume-observation em,
          .resume-observation small,
          .resume-graph-context p,
          .resume-graph-context em,
          .resume-graph-context small {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
            font-size: 0.72rem;
            line-height: 1.3;
          }

          .resume-graph-context p,
          .resume-facts {
            display: none;
          }

          .resume-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.42rem;
          }

          .resume-actions :global(a),
          .resume-actions button {
            min-height: 34px;
            padding: 0.44rem 0.5rem;
            border-radius: 12px;
            font-size: 0.78rem;
            line-height: 1.12;
            width: auto;
          }
        }
      `}</style>
    </section>
  )
}
