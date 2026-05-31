'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'

import dynamic from 'next/dynamic'

import VizShell from '@/components/viz/VizShell'
import VizStageAdapter from '@/components/viz/VizStageAdapter'
import { emitDemoState } from '../../../../../lib/demoState'

const ScalingLawsViz = dynamic(() => import('@/components/foundations/ScalingLawsViz'), { ssr: false })
const NeuralScalingViz = dynamic(() => import('@/components/foundations/NeuralScalingViz'), { ssr: false })

type TabId = 'laws' | 'tasks'
type PredictionKey = 'balance-params-data' | 'parameters-only' | 'data-only' | 'thresholded-metric'

const PREDICTIONS: Record<PredictionKey, { label: string; response: Record<TabId, string> }> = {
  'balance-params-data': {
    label: 'Scale parameters and data',
    response: {
      laws:
        'For a fixed training budget, the compute-optimal move is to grow model size and training tokens together instead of oversizing one side of the run.',
      tasks:
        'That is the training-allocation lesson. For the emergence view, the key move is how a measured threshold can make a smooth curve look abrupt.',
    },
  },
  'parameters-only': {
    label: 'Scale parameters first',
    response: {
      laws:
        'More parameters can lower loss, but the source-checked compute-allocation claim is not parameters alone. Too many parameters for too little data wastes the budget.',
      tasks:
        'More parameters may help the underlying curve, but the emergence view is asking why the displayed capability can look like a sudden jump.',
    },
  },
  'data-only': {
    label: 'Scale data first',
    response: {
      laws:
        'More tokens can lower loss, but the compute-optimal rule is not data alone. The useful frontier balances the model and token sides.',
      tasks:
        'More data may move the curve, but the emergence view is asking why the displayed capability can look discontinuous.',
    },
  },
  'thresholded-metric': {
    label: 'Thresholds make jumps',
    response: {
      laws:
        'That explains the emergence view. For the loss-scaling view, the expected mechanism is the compute-budget balance between parameters and tokens.',
      tasks:
        'A smooth capability curve can look sudden when the displayed metric is thresholded. The lab shows how the visible jump can come from measurement, not a literal discontinuity.',
    },
  },
}

const EXPECTED_BY_TAB: Record<TabId, PredictionKey> = {
  laws: 'balance-params-data',
  tasks: 'thresholded-metric',
}

export default function ScalingLawsDemo() {
  const uid = useId()
  const tabs = useMemo(
    () =>
      [
        {
          id: 'laws' as const,
          label: 'Loss Scaling',
          note: 'Fit and extrapolate a power law: how loss drops with parameters and data.',
          Component: NeuralScalingViz,
          question: 'Which mechanism best explains this view?',
        },
        {
          id: 'tasks' as const,
          label: 'Emergence',
          note: 'When smooth performance curves are thresholded, they can look abrupt.',
          Component: ScalingLawsViz,
          question: 'Which mechanism best explains this view?',
        },
      ] as const,
    []
  )

  const [active, setActive] = useState<TabId>('laws')
  const [prediction, setPrediction] = useState<PredictionKey | null>(null)
  const [revealed, setRevealed] = useState(false)
  const current = tabs.find((t) => t.id === active) ?? tabs[0]
  const Active = current.Component
  const expected = EXPECTED_BY_TAB[active]
  const expectedPrediction = PREDICTIONS[expected]
  const predictionCorrect = prediction === expected

  const panelId = `${uid}-panel`
  const tabId = (id: TabId) => `${uid}-tab-${id}`
  const selectTab = (id: TabId) => {
    setActive(id)
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
    selectTab(next)
    requestAnimationFrame(() => document.getElementById(tabId(next))?.focus())
  }

  useEffect(() => {
    emitDemoState({
      conceptId: 'scaling-laws',
      label: 'Prediction-first scaling-laws reveal',
      summary: revealed
        ? `Learner chose ${prediction === null ? 'none' : PREDICTIONS[prediction].label} for ${current.label}; expected ${expectedPrediction.label}.`
        : `Learner is choosing the ${current.label} mechanism before the scaling lab is mounted.`,
      values: [
        `active view: ${current.label}`,
        `prediction: ${prediction === null ? 'none' : PREDICTIONS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `expected mechanism: ${revealed ? expectedPrediction.label : 'hidden until reveal'}`,
        `scaling invariant: ${revealed ? expectedPrediction.response[active] : 'hidden until reveal'}`,
        `scaling lab: ${revealed ? 'mounted' : 'hidden until reveal'}`,
      ],
    })
  }, [active, current.label, expectedPrediction.label, expectedPrediction.response, prediction, predictionCorrect, revealed])

  return (
    <VizShell
      eyebrow="Interactive demo"
      title="Predict the scaling mechanism"
      subtitle="Choose what the scaling view should expose before the lab mounts."
      metrics={['prediction', 'commitment', 'lab reveal']}
      notes={
        <p>
          The reveal stays inside the page's source-checked scope. It is not a
          proof about intelligence, universal exponents, or literal
          discontinuous abilities.
        </p>
      }
      challenge={<p>Pick the mechanism first, then use the lab to inspect the curve.</p>}
    >
      <VizStageAdapter padding="compact" overflowX ariaLabel="Scrollable scaling prediction checkpoint and gated lab">
        <div className="wrap">
          <div className="tabs" role="tablist" aria-label="Scaling demo views">
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
                onClick={() => selectTab(t.id)}
                onKeyDown={onKeyDown}
              >
                {t.label}
              </button>
            ))}
          </div>

          <section className="predictionPanel">
            <div className="predictionCopy">
              <span>prediction checkpoint</span>
              <strong>{current.question}</strong>
              <p>Choose the mechanism before any interactive controls are mounted.</p>
            </div>

            <div className="scalingPreview" aria-hidden="true">
              <div className="budgetTile">
                <span />
                <span />
              </div>
              <div className="curveTile">
                <i />
                <i />
                <i />
              </div>
              <div className="measureTile">
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="choiceRow" role="group" aria-label="Scaling mechanism prediction">
              {(Object.keys(PREDICTIONS) as PredictionKey[]).map((key) => (
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
                  {PREDICTIONS[key].label}
                </button>
              ))}
            </div>

            <button type="button" className="reveal" disabled={prediction === null} onClick={() => setRevealed(true)}>
              Reveal scaling mechanism
            </button>
          </section>

          <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
            {revealed ? (
              <>
                <h4>{predictionCorrect ? 'Prediction matches.' : `${expectedPrediction.label} is the mechanism for this view.`}</h4>
                <p>{prediction === null ? expectedPrediction.response[active] : PREDICTIONS[prediction].response[active]}</p>
                <p>{current.note}</p>
              </>
            ) : (
              <p>{prediction === null ? 'Choose a mechanism to unlock this scaling lab.' : 'Reveal the mechanism to mount this scaling lab.'}</p>
            )}
          </section>

          <div className="panel" role="tabpanel" id={panelId} aria-labelledby={tabId(active)} tabIndex={0}>
            {revealed ? (
              <Active />
            ) : (
              <div className="panelGate">
                <span>{current.label} lab</span>
                <strong>Hidden until prediction reveal</strong>
                <p>Commit to a mechanism first; the interactive controls stay hidden until reveal.</p>
              </div>
            )}
          </div>
        </div>
      </VizStageAdapter>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          min-width: min(100%, 34rem);
        }

        .tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
        }

        .tab {
          appearance: none;
          border: 1px solid rgba(27, 36, 48, 0.12);
          background: rgba(255, 255, 255, 0.68);
          color: #4f5f6d;
          border-radius: 999px;
          padding: 0.42rem 0.68rem;
          font-size: 0.85rem;
          cursor: pointer;
          transition: border-color 120ms ease, transform 120ms ease, color 120ms ease;
        }

        .tab:hover {
          border-color: rgba(31, 111, 120, 0.52);
          color: #17202a;
          transform: translateY(-1px);
        }

        .tab:focus-visible {
          outline: 2px solid rgba(31, 111, 120, 0.45);
          outline-offset: 2px;
        }

        .tab.active {
          border-color: rgba(31, 111, 120, 0.78);
          background: rgba(226, 242, 239, 0.9);
          color: #143c43;
        }

        .predictionPanel,
        .result,
        .panel,
        .panelGate {
          display: grid;
          gap: 0.72rem;
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 251, 245, 0.76);
        }

        .predictionPanel,
        .result,
        .panelGate {
          padding: 0.82rem;
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
          color: #60707c;
        }

        .predictionCopy strong,
        .result h4,
        .panelGate strong {
          color: #17202a;
          line-height: 1.28;
          overflow-wrap: anywhere;
        }

        .predictionCopy p,
        .result p,
        .panelGate p {
          margin: 0;
          color: #52606c;
          line-height: 1.5;
        }

        .scalingPreview {
          display: grid;
          grid-template-columns: minmax(7rem, 0.75fr) minmax(8rem, 1fr) minmax(7rem, 0.75fr);
          align-items: center;
          gap: 0.7rem;
          min-width: 0;
          min-height: 8.25rem;
          padding: 0.75rem;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 8px;
          background:
            linear-gradient(rgba(27, 36, 48, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(27, 36, 48, 0.05) 1px, transparent 1px),
            rgba(255, 255, 255, 0.46);
          background-size: 22px 22px;
        }

        .budgetTile,
        .curveTile,
        .measureTile {
          min-width: 0;
          min-height: 5.5rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(23, 32, 42, 0.08);
        }

        .budgetTile,
        .measureTile {
          display: grid;
          align-content: center;
          gap: 0.55rem;
          padding: 0.7rem;
        }

        .budgetTile span,
        .measureTile span {
          display: block;
          height: 0.72rem;
          border-radius: 999px;
          background: rgba(31, 111, 120, 0.5);
          animation: previewPulse 3s ease-in-out infinite;
        }

        .budgetTile span:nth-child(1) { width: 76%; }
        .budgetTile span:nth-child(2) { width: 56%; background: rgba(194, 111, 52, 0.42); animation-delay: -0.35s; }
        .measureTile span:nth-child(1) { width: 42%; background: rgba(194, 111, 52, 0.44); }
        .measureTile span:nth-child(2) { width: 68%; animation-delay: -0.4s; }
        .measureTile span:nth-child(3) { width: 52%; background: rgba(124, 58, 237, 0.36); animation-delay: -0.8s; }

        .curveTile {
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(circle at 20% 74%, rgba(31, 111, 120, 0.52) 0 0.28rem, transparent 0.31rem),
            radial-gradient(circle at 48% 50%, rgba(31, 111, 120, 0.6) 0 0.28rem, transparent 0.31rem),
            radial-gradient(circle at 78% 30%, rgba(31, 111, 120, 0.7) 0 0.28rem, transparent 0.31rem),
            rgba(23, 32, 42, 0.08);
        }

        .curveTile i {
          position: absolute;
          left: 12%;
          right: 12%;
          height: 2px;
          border-radius: 999px;
          background: rgba(27, 36, 48, 0.2);
          transform-origin: left center;
        }

        .curveTile i:nth-child(1) { top: 68%; transform: rotate(-18deg); }
        .curveTile i:nth-child(2) { top: 52%; transform: rotate(-14deg); }
        .curveTile i:nth-child(3) { top: 38%; transform: rotate(-9deg); }

        .choiceRow {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.5rem;
        }

        .choiceRow button,
        .reveal {
          min-width: 0;
          min-height: 2.5rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.12);
          background: rgba(255, 255, 255, 0.72);
          color: #23303a;
          font: inherit;
          line-height: 1.2;
          cursor: pointer;
        }

        .choiceRow button {
          padding: 0.48rem 0.58rem;
          font-size: 0.82rem;
        }

        .choiceRow button:hover,
        .choiceRow button:focus-visible {
          border-color: rgba(31, 111, 120, 0.48);
        }

        .choiceRow button.selected {
          border-color: rgba(31, 111, 120, 0.72);
          background: rgba(226, 242, 239, 0.9);
          color: #143c43;
        }

        .reveal {
          justify-self: start;
          padding: 0 0.78rem;
          background: #1f6f78;
          color: #fffaf0;
          border-color: rgba(31, 111, 120, 0.8);
        }

        .reveal:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .result {
          min-height: 5rem;
          background: rgba(255, 255, 255, 0.54);
        }

        .result.shown {
          border-color: rgba(31, 111, 120, 0.25);
          background: rgba(226, 242, 239, 0.7);
        }

        .result h4 {
          margin: 0;
          font-size: 0.98rem;
        }

        .panel {
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.46);
        }

        .panelGate {
          min-height: 12rem;
          align-content: center;
          text-align: center;
          background:
            linear-gradient(rgba(27, 36, 48, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(27, 36, 48, 0.05) 1px, transparent 1px),
            rgba(255, 255, 255, 0.44);
          background-size: 26px 26px;
        }

        @keyframes previewPulse {
          0%, 100% { transform: scaleX(0.78); opacity: 0.55; }
          50% { transform: scaleX(1); opacity: 1; }
        }

        @media (max-width: 760px) {
          .choiceRow,
          .scalingPreview {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .curveTile {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 540px) {
          .choiceRow,
          .scalingPreview {
            grid-template-columns: 1fr;
          }

          .curveTile {
            grid-column: auto;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .budgetTile span,
          .measureTile span {
            animation: none;
          }
        }
      `}</style>
    </VizShell>
  )
}
