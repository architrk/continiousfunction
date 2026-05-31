import { useEffect, useId, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'

import dynamic from 'next/dynamic'
import { emitDemoState, getLatestDemoState } from '../../../../../lib/demoState'

const AttentionGeometryViz = dynamic(
  () => import('@/components/foundations/AttentionGeometryViz'),
  { ssr: false }
)
const SelfAttentionViz = dynamic(() => import('@/components/foundations/SelfAttentionViz'), {
  ssr: false,
})
const TransformerArchitectureViz = dynamic(
  () => import('@/components/foundations/TransformerArchitectureViz'),
  { ssr: false }
)
const AttentionBackpropViz = dynamic(
  () => import('@/components/foundations/AttentionBackpropViz'),
  { ssr: false }
)

type TabId = 'geometry' | 'mechanics' | 'architecture' | 'backprop'
type PredictionKey = 'scores' | 'mixing' | 'block' | 'credit'

const MECHANISM_PREDICTIONS: Record<PredictionKey, { label: string; response: string }> = {
  scores: {
    label: 'Similarity scores',
    response: 'The useful invariant is that query-key dot products become a normalized attention distribution.',
  },
  mixing: {
    label: 'Value mixing',
    response: 'The useful invariant is that each token writes a weighted mixture of value vectors, often under a mask.',
  },
  block: {
    label: 'Block composition',
    response: 'The useful invariant is that attention, MLP, residual paths, and normalization form one reusable layer.',
  },
  credit: {
    label: 'Gradient credit',
    response: 'The useful invariant is that loss gradients split through attention weights, values, and projection matrices.',
  },
}

const ROUTER_DEMO_STATE_CONCEPT_ID = 'attention-transformers'
const ROUTER_DEMO_STATE_LABEL = 'Prediction-first attention mechanism router'

function expectedPredictionForTab(tab: TabId): PredictionKey {
  if (tab === 'geometry') return 'scores'
  if (tab === 'mechanics') return 'mixing'
  if (tab === 'architecture') return 'block'
  return 'credit'
}

export default function AttentionTransformersViz() {
  const uid = useId()
  const tabs = useMemo(
    () =>
      [
        {
          id: 'geometry' as const,
          label: 'Geometry',
          note: 'Dot products become attention weights: watch the similarities turn into a distribution.',
          Component: AttentionGeometryViz,
        },
        {
          id: 'mechanics' as const,
          label: 'Self-Attention',
          note: 'Queries/keys/values + masking: the actual computation you run in an LM layer.',
          Component: SelfAttentionViz,
        },
        {
          id: 'architecture' as const,
          label: 'Transformer Block',
          note: 'How attention, MLP, residuals, and normalization fit together into a layer.',
          Component: TransformerArchitectureViz,
        },
        {
          id: 'backprop' as const,
          label: 'Backprop',
          note: 'How gradients flow through attention weights and value mixing.',
          Component: AttentionBackpropViz,
        },
      ] as const,
    []
  )

  const [active, setActive] = useState<TabId>('geometry')
  const [prediction, setPrediction] = useState<PredictionKey | null>(null)
  const [revealed, setRevealed] = useState(false)
  const current = tabs.find((t) => t.id === active) ?? tabs[0]
  const Active = current.Component
  const expectedPrediction = expectedPredictionForTab(active)
  const expectedMechanism = MECHANISM_PREDICTIONS[expectedPrediction]
  const predictionCorrect = prediction !== null && prediction === expectedPrediction
  const predictionLabel = prediction === null ? 'Choose a mechanism' : MECHANISM_PREDICTIONS[prediction].label
  const demoSurfaceSteps = [
    {
      step: '01',
      label: 'Predict',
      detail: prediction === null ? 'Choose the mechanism before the demo appears.' : predictionLabel,
    },
    {
      step: '02',
      label: 'Observe',
      detail: revealed ? expectedMechanism.label : 'Reveal stays locked until a prediction is committed.',
    },
    {
      step: '03',
      label: 'Ground',
      detail: revealed ? current.note : 'The active tab note becomes the evidence anchor.',
    },
    {
      step: '04',
      label: 'Carry',
      detail: revealed
        ? predictionCorrect
          ? 'Matched prediction; carry the observation into the notebook.'
          : `Compare your prediction with ${expectedMechanism.label}.`
        : 'Then enter the live demo with a question in hand.',
    },
  ]

  const panelId = `${uid}-panel`
  const tabId = (id: TabId) => `${uid}-tab-${id}`
  const setActiveTab = (tab: TabId) => {
    setActive(tab)
    setPrediction(null)
    setRevealed(false)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const idx = tabs.findIndex((t) => t.id === active)
    if (idx < 0) return
    let next: TabId | null = null
    if (e.key === 'ArrowRight') next = tabs[(idx + 1) % tabs.length].id
    else if (e.key === 'ArrowLeft') next = tabs[(idx - 1 + tabs.length) % tabs.length].id
    else if (e.key === 'Home') next = tabs[0].id
    else if (e.key === 'End') next = tabs[tabs.length - 1].id
    if (!next) return
    e.preventDefault()
    setActiveTab(next)
    requestAnimationFrame(() => document.getElementById(tabId(next))?.focus())
  }

  useEffect(() => {
    const routerState = {
      conceptId: ROUTER_DEMO_STATE_CONCEPT_ID,
      label: ROUTER_DEMO_STATE_LABEL,
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : MECHANISM_PREDICTIONS[prediction].label}; the ${current.label} tab reveals ${expectedMechanism.label}.`
        : `Learner is choosing which transformer mechanism the ${current.label} tab should make concrete before entering the demo.`,
      values: [
        `active tab: ${current.label}`,
        `prediction: ${prediction === null ? 'none' : MECHANISM_PREDICTIONS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `expected mechanism: ${revealed ? expectedMechanism.label : 'hidden until reveal'}`,
        `mechanism invariant: ${revealed ? expectedMechanism.response : 'hidden until reveal'}`,
        `demo panel: ${revealed ? 'mounted' : 'hidden until reveal'}`,
        'evidence loop: predict -> observe -> ground -> carry',
      ],
    }

    const childOwnsDemoState = () => {
      const latest = getLatestDemoState(ROUTER_DEMO_STATE_CONCEPT_ID)
      return latest !== null && latest.label !== ROUTER_DEMO_STATE_LABEL
    }

    if (revealed && childOwnsDemoState()) return undefined

    emitDemoState(routerState)

    if (!revealed || typeof window === 'undefined') return undefined

    const timer = window.setTimeout(() => {
      if (!childOwnsDemoState()) emitDemoState(routerState)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [current.label, expectedMechanism.label, expectedMechanism.response, prediction, predictionCorrect, revealed])

  return (
    <div className="wrap">
      <div className="tabs" role="tablist" aria-label="Attention demos">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${t.id === active ? 'active' : ''}`}
            role="tab"
            id={tabId(t.id)}
            aria-selected={t.id === active}
            aria-controls={panelId}
            tabIndex={t.id === active ? 0 : -1}
            onClick={() => setActiveTab(t.id)}
            onKeyDown={onKeyDown}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="predictionPanel" aria-live="polite">
        <div className="predictionCopy">
          <span>prediction checkpoint</span>
          <strong>Which mechanism should this tab make concrete?</strong>
          <p>
            Choose the invariant before entering the active demo. The tabs are connected views of one transformer layer,
            so the reveal should name the object this view is responsible for.
          </p>
        </div>
        <div className="choiceRow" role="group" aria-label="Attention mechanism prediction">
          {(Object.keys(MECHANISM_PREDICTIONS) as PredictionKey[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={prediction === key}
              className={prediction === key ? 'selected' : ''}
              onClick={() => {
                setPrediction(key)
                setRevealed(false)
              }}
            >
              {MECHANISM_PREDICTIONS[key].label}
            </button>
          ))}
        </div>
        <div className="demoEvidenceStrip" aria-label="Prediction evidence loop">
          {demoSurfaceSteps.map((step, index) => (
            <article
              key={step.step}
              className={`evidenceStep ${
                (!revealed && index === 0) || (revealed && index === demoSurfaceSteps.length - 1) ? 'active' : ''
              }`}
            >
              <span>{step.step}</span>
              <strong>{step.label}</strong>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
        <button
          type="button"
          className="reveal"
          disabled={prediction === null}
          onClick={() => setRevealed(true)}
        >
          Reveal mechanism
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>
              {predictionCorrect
                ? 'Prediction matches. Observation ready.'
                : `${expectedMechanism.label} is the mechanism for this tab.`}
            </h4>
            <p>
              {expectedMechanism.response} {current.note} Carry this observation into the live demo and Research Room.
            </p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose a mechanism to unlock the active demo.' : 'Reveal the mechanism to enter this tab.'}</p>
        )}
      </section>

      <div className="panel" role="tabpanel" id={panelId} aria-labelledby={tabId(active)} tabIndex={0}>
        {revealed ? <Active /> : (
          <div className="panelGate">
            <span>{current.label}</span>
            <strong>Demo hidden until prediction reveal</strong>
            <p>Commit to the mechanism first, then use the mounted demo to test that invariant directly.</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
        }

        .tab {
          appearance: none;
          border: 1px solid var(--border-subtle);
          background: rgba(255, 250, 240, 0.78);
          color: var(--text-secondary);
          border-radius: 999px;
          padding: 0.35rem 0.65rem;
          font-size: 0.85rem;
          cursor: pointer;
          transition: border-color 120ms ease, transform 120ms ease, color 120ms ease;
        }

        .tab:hover {
          border-color: rgba(99, 102, 241, 0.6);
          color: var(--text-primary);
          transform: translateY(-1px);
        }

        .tab:focus-visible {
          outline: 2px solid rgba(148, 163, 184, 0.6);
          outline-offset: 2px;
        }

        .tab.active {
          border-color: rgba(99, 102, 241, 0.8);
          background: rgba(99, 102, 241, 0.16);
          color: #3730a3;
        }

        .note {
          font-size: 0.9rem;
          color: var(--text-muted);
          line-height: 1.5;
        }

        .predictionPanel,
        .result {
          display: grid;
          gap: 0.72rem;
          min-width: 0;
          padding: 0.82rem;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          background: rgba(8, 12, 20, 0.18);
        }

        .predictionPanel {
          border-color: rgba(214, 199, 173, 0.92);
          background: rgba(255, 250, 240, 0.88);
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.08);
        }

        .predictionCopy {
          display: grid;
          gap: 0.32rem;
          min-width: 0;
        }

        .predictionCopy span,
        .panelGate span {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
            monospace;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0;
          color: var(--text-secondary);
        }

        .predictionCopy strong,
        .result h4,
        .panelGate strong {
          color: var(--text-primary);
          line-height: 1.28;
          overflow-wrap: anywhere;
        }

        .predictionCopy p,
        .result p,
        .panelGate p {
          margin: 0;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .choiceRow {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.5rem;
          min-width: 0;
        }

        .choiceRow button,
        .reveal {
          min-width: 0;
          min-height: 2.7rem;
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          background: rgba(255, 250, 240, 0.9);
          color: var(--text-primary);
          padding: 0.45rem 0.62rem;
          font: inherit;
          font-weight: 800;
          line-height: 1.18;
          overflow-wrap: anywhere;
          cursor: pointer;
        }

        .choiceRow button.selected {
          border-color: rgba(37, 99, 235, 0.58);
          background: rgba(37, 99, 235, 0.12);
          color: #1d4ed8;
        }

        .reveal {
          justify-self: start;
          background: linear-gradient(135deg, #fde68a, #f59e0b);
          border-color: rgba(180, 83, 9, 0.52);
          color: #1f2937;
          box-shadow: 0 10px 24px rgba(245, 158, 11, 0.18);
        }

        .reveal:disabled {
          opacity: 0.58;
          cursor: not-allowed;
        }

        .demoEvidenceStrip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.5rem;
          min-width: 0;
          padding: 0.52rem;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 8px;
          background:
            linear-gradient(rgba(148, 163, 184, 0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.045) 1px, transparent 1px),
            #0f172a;
          background-size: 22px 22px;
        }

        .evidenceStep {
          display: grid;
          align-content: start;
          gap: 0.2rem;
          min-width: 0;
          min-height: 7.6rem;
          padding: 0.58rem;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 8px;
          background: rgba(15, 23, 42, 0.86);
        }

        .evidenceStep.active {
          border-color: rgba(96, 165, 250, 0.76);
          background: rgba(37, 99, 235, 0.24);
        }

        .evidenceStep span {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
            monospace;
          font-size: 0.68rem;
          color: #93c5fd;
        }

        .evidenceStep strong {
          color: #f8fafc;
          line-height: 1.18;
          overflow-wrap: anywhere;
        }

        .evidenceStep p {
          margin: 0;
          color: #cbd5e1;
          font-size: 0.78rem;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .result {
          min-height: 5rem;
        }

        .result.shown {
          border-color: rgba(245, 158, 11, 0.28);
          background: rgba(245, 158, 11, 0.1);
        }

        .result h4 {
          margin: 0;
          font-size: 1rem;
        }

        .panel {
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          background: rgba(8, 12, 20, 0.25);
          padding: 0.75rem;
        }

        .panelGate {
          display: grid;
          gap: 0.38rem;
          min-height: 13rem;
          align-content: center;
          padding: 1rem;
          border-radius: calc(var(--radius-lg) - 4px);
          background:
            linear-gradient(rgba(148, 163, 184, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px),
            rgba(255, 250, 240, 0.68);
          background-size: 28px 28px;
          text-align: center;
        }

        @media (max-width: 720px) {
          .choiceRow,
          .demoEvidenceStrip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .evidenceStep {
            min-height: 7rem;
          }
        }

        @media (max-width: 520px) {
          .choiceRow,
          .demoEvidenceStrip {
            grid-template-columns: 1fr;
          }

          .reveal {
            width: 100%;
          }

          .panel {
            margin-inline: -0.75rem;
            padding: 0.45rem;
          }
        }
      `}</style>
    </div>
  )
}
