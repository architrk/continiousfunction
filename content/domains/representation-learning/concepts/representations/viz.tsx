import { useEffect, useId, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'

import dynamic from 'next/dynamic'
import { emitDemoState } from '../../../../../lib/demoState'

const LayerNormViz = dynamic(() => import('@/components/foundations/LayerNormViz'), { ssr: false })
const TaskVectorViz = dynamic(() => import('@/components/foundations/TaskVectorViz'), { ssr: false })
const EquivarianceViz = dynamic(() => import('@/components/foundations/EquivarianceViz'), { ssr: false })
const ParallelTransportViz = dynamic(() => import('@/components/foundations/ParallelTransportViz'), { ssr: false })

type TabId = 'norm' | 'task' | 'equivariance' | 'transport'
type PredictionKey = 'direction-similarity' | 'linear-direction' | 'input-symmetry' | 'tangent-transport'

const PREDICTIONS: Record<PredictionKey, { label: string; response: string }> = {
  'direction-similarity': {
    label: 'Direction similarity',
    response: 'Normalization makes the geometry care more about direction than raw vector length, which is why cosine-style similarity becomes meaningful.',
  },
  'linear-direction': {
    label: 'Linear direction',
    response: 'Task-vector views treat a behavior as a reusable displacement in representation or weight space.',
  },
  'input-symmetry': {
    label: 'Input symmetry',
    response: 'Equivariant representations preserve structure: when the input transforms, the features transform predictably instead of forgetting the symmetry.',
  },
  'tangent-transport': {
    label: 'Tangent transport',
    response: 'Curved geometry needs a rule for moving directions between points without changing what the local direction means.',
  },
}

export default function RepresentationsViz() {
  const uid = useId()
  const tabs = useMemo(
    () =>
      [
        {
          id: 'norm' as const,
          label: 'Normalization',
          note: 'Why scale and centering choices reshape geometry (and why cosine similarity is so common).',
          expected: 'direction-similarity' as const,
          invariant: 'Scale changes should not dominate the similarity judgment once direction is normalized.',
          Component: LayerNormViz,
        },
        {
          id: 'task' as const,
          label: 'Directions',
          note: 'A “concept” can be a direction: move a representation along a vector and behavior can change.',
          expected: 'linear-direction' as const,
          invariant: 'A behavior can be represented as a reusable displacement direction.',
          Component: TaskVectorViz,
        },
        {
          id: 'equivariance' as const,
          label: 'Equivariance',
          note: 'Good representations preserve structure: transform the input, and features transform predictably.',
          expected: 'input-symmetry' as const,
          invariant: 'The feature map should transform in step with the input symmetry.',
          Component: EquivarianceViz,
        },
        {
          id: 'transport' as const,
          label: 'Geometry',
          note: 'How to compare directions on curved spaces: transporting vectors without “twisting” them.',
          expected: 'tangent-transport' as const,
          invariant: 'A local direction can be compared elsewhere only after a transport rule carries it along the surface.',
          Component: ParallelTransportViz,
        },
      ] as const,
    []
  )

  const [active, setActive] = useState<TabId>('norm')
  const [prediction, setPrediction] = useState<PredictionKey | null>(null)
  const [revealed, setRevealed] = useState(false)
  const current = tabs.find((t) => t.id === active) ?? tabs[0]
  const Active = current.Component
  const expectedPrediction = PREDICTIONS[current.expected]
  const predictionCorrect = prediction === current.expected

  const panelId = `${uid}-panel`
  const tabId = (id: TabId) => `${uid}-tab-${id}`
  const selectActive = (next: TabId) => {
    setActive(next)
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
    selectActive(next)
    requestAnimationFrame(() => document.getElementById(tabId(next))?.focus())
  }

  useEffect(() => {
    const routeState = {
      conceptId: 'representations',
      label: 'Prediction-first representation invariant reveal',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : PREDICTIONS[prediction].label}; ${current.label} reveals ${expectedPrediction.label}.`
        : `Learner is predicting which invariant ${current.label} should preserve before the lab is mounted.`,
      values: [
        `active demo: ${current.label}`,
        `prediction: ${prediction === null ? 'none' : PREDICTIONS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `expected invariant: ${revealed ? expectedPrediction.label : 'hidden until reveal'}`,
        `representation invariant: ${revealed ? current.invariant : 'hidden until reveal'}`,
        `representation lab: ${revealed ? 'mounted' : 'hidden until reveal'}`,
      ],
    }

    emitDemoState(routeState)

    if (!revealed || typeof window === 'undefined') return undefined

    const timer = window.setTimeout(() => emitDemoState(routeState), 350)
    return () => window.clearTimeout(timer)
  }, [
    current.invariant,
    current.label,
    expectedPrediction.label,
    prediction,
    predictionCorrect,
    revealed,
  ])

  return (
    <div className="wrap">
      <div className="tabs" role="tablist" aria-label="Representation demos">
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
            onClick={() => selectActive(t.id)}
            onKeyDown={onKeyDown}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="note">{current.note}</div>

      <section className="predictionPanel" aria-live="polite">
        <div className="predictionCopy">
          <span>prediction checkpoint</span>
          <strong>What invariant should {current.label} preserve first?</strong>
          <p>
            Predict the geometry before the lab mounts. The reveal should make the embedding picture feel like a
            constraint, not just a scatterplot.
          </p>
        </div>

        <div className={`geometryPreview ${active}`} aria-hidden="true">
          <div className="embeddingPlane">
            <i className="point p1" />
            <i className="point p2" />
            <i className="point p3" />
            <i className="point p4" />
            <i className="point p5" />
            <i className="axis axisX" />
            <i className="axis axisY" />
            <i className="directionVector" />
          </div>
          <div className="invariantRail">
            <span>normalize</span>
            <span>direction</span>
            <span>symmetry</span>
            <span>transport</span>
          </div>
        </div>

        <div className="choiceRow" role="group" aria-label={`${current.label} invariant prediction`}>
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
          Reveal representation invariant
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : `${expectedPrediction.label} is the invariant this route emphasizes.`}</h4>
            <p>{expectedPrediction.response} Use the lab below to connect that invariant to the controls.</p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose an invariant to unlock the representation lab.' : 'Reveal the invariant to mount the lab.'}</p>
        )}
      </section>

      <div className="panel" role="tabpanel" id={panelId} aria-labelledby={tabId(active)} tabIndex={0}>
        {revealed ? (
          <Active />
        ) : (
          <div className="panelGate">
            <span>{current.label} lab</span>
            <strong>Hidden until prediction reveal</strong>
            <p>Commit to the invariant first, then inspect the geometry and measured tradeoffs.</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          min-width: 0;
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
          background: rgba(8, 12, 20, 0.35);
          color: var(--text-secondary);
          border-radius: 999px;
          padding: 0.35rem 0.65rem;
          font-size: 0.85rem;
          cursor: pointer;
          transition: border-color 120ms ease, transform 120ms ease, color 120ms ease;
        }

        .tab:hover {
          border-color: rgba(34, 197, 94, 0.7);
          color: var(--text-primary);
          transform: translateY(-1px);
        }

        .tab:focus-visible {
          outline: 2px solid rgba(148, 163, 184, 0.6);
          outline-offset: 2px;
        }

        .tab.active {
          border-color: rgba(34, 197, 94, 0.85);
          background: rgba(34, 197, 94, 0.15);
          color: rgba(187, 247, 208, 1);
        }

        .note {
          font-size: 0.9rem;
          color: var(--text-muted);
          line-height: 1.5;
        }

        .predictionPanel,
        .result,
        .panel {
          min-width: 0;
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          background: rgba(8, 12, 20, 0.25);
          padding: 0.75rem;
        }

        .predictionPanel,
        .result {
          display: grid;
          gap: 0.72rem;
        }

        .predictionCopy {
          display: grid;
          gap: 0.32rem;
          min-width: 0;
        }

        .predictionCopy span,
        .panelGate span,
        .invariantRail span {
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

        .geometryPreview {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr);
          gap: 0.7rem;
          min-width: 0;
          min-height: 9.5rem;
          padding: 0.72rem;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 8px;
          background:
            linear-gradient(rgba(148, 163, 184, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px),
            rgba(8, 12, 20, 0.24);
          background-size: 24px 24px;
        }

        .embeddingPlane {
          position: relative;
          min-width: 0;
          min-height: 8rem;
          overflow: hidden;
          border-radius: 8px;
          background: radial-gradient(circle at 50% 50%, rgba(34, 197, 94, 0.1), rgba(15, 23, 42, 0.36));
        }

        .point,
        .axis,
        .directionVector {
          position: absolute;
          display: block;
        }

        .point {
          width: 0.62rem;
          height: 0.62rem;
          border-radius: 999px;
          background: rgba(34, 197, 94, 0.9);
          animation: pointBreathe 3.4s ease-in-out infinite;
        }

        .p1 { left: 19%; top: 30%; animation-delay: -0.2s; }
        .p2 { left: 36%; top: 55%; animation-delay: -0.45s; }
        .p3 { left: 55%; top: 36%; animation-delay: -0.7s; }
        .p4 { left: 70%; top: 62%; animation-delay: -0.95s; }
        .p5 { left: 48%; top: 72%; animation-delay: -1.2s; }

        .axis {
          background: rgba(148, 163, 184, 0.28);
        }

        .axisX {
          left: 10%;
          right: 10%;
          top: 50%;
          height: 1px;
        }

        .axisY {
          top: 12%;
          bottom: 12%;
          left: 50%;
          width: 1px;
        }

        .directionVector {
          left: 50%;
          top: 50%;
          width: 34%;
          height: 0.18rem;
          border-radius: 999px;
          background: rgba(245, 158, 11, 0.9);
          transform-origin: left center;
          transform: rotate(-27deg);
          animation: vectorSweep 3.2s ease-in-out infinite;
        }

        .directionVector::after {
          content: '';
          position: absolute;
          right: -0.1rem;
          top: 50%;
          width: 0.5rem;
          height: 0.5rem;
          border-top: 0.16rem solid rgba(245, 158, 11, 0.95);
          border-right: 0.16rem solid rgba(245, 158, 11, 0.95);
          transform: translateY(-50%) rotate(45deg);
        }

        .invariantRail {
          display: grid;
          grid-template-rows: repeat(4, minmax(0, 1fr));
          gap: 0.42rem;
          min-width: 0;
        }

        .invariantRail span {
          display: grid;
          align-items: center;
          min-height: 2rem;
          padding: 0.42rem 0.54rem;
          border-radius: 8px;
          background: rgba(15, 23, 42, 0.42);
          border: 1px solid transparent;
        }

        .geometryPreview.norm .invariantRail span:nth-child(1),
        .geometryPreview.task .invariantRail span:nth-child(2),
        .geometryPreview.equivariance .invariantRail span:nth-child(3),
        .geometryPreview.transport .invariantRail span:nth-child(4) {
          border-color: rgba(34, 197, 94, 0.34);
          background: rgba(34, 197, 94, 0.12);
          color: rgba(187, 247, 208, 1);
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
          background: rgba(8, 12, 20, 0.35);
          color: var(--text-primary);
          padding: 0.45rem 0.62rem;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
        }

        .choiceRow button.selected {
          border-color: rgba(34, 197, 94, 0.58);
          background: rgba(34, 197, 94, 0.14);
        }

        .reveal {
          justify-self: start;
          background: rgba(31, 111, 120, 0.88);
          border-color: rgba(31, 111, 120, 0.7);
          color: #fffaf2;
        }

        .reveal:disabled {
          opacity: 0.58;
          cursor: not-allowed;
        }

        .result {
          min-height: 5rem;
        }

        .result.shown {
          border-color: rgba(34, 197, 94, 0.28);
          background: rgba(34, 197, 94, 0.1);
        }

        .result h4 {
          margin: 0;
          font-size: 1rem;
        }

        .panelGate {
          display: grid;
          gap: 0.4rem;
          min-height: 13rem;
          align-content: center;
          text-align: center;
          background:
            linear-gradient(rgba(148, 163, 184, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px),
            rgba(8, 12, 20, 0.22);
          background-size: 28px 28px;
        }

        @keyframes pointBreathe {
          0%, 100% { transform: translate(0, 0) scale(0.9); opacity: 0.56; }
          50% { transform: translate(0.22rem, -0.16rem) scale(1.12); opacity: 1; }
        }

        @keyframes vectorSweep {
          0%, 100% { transform: rotate(-27deg) scaleX(0.78); opacity: 0.58; }
          50% { transform: rotate(-12deg) scaleX(1); opacity: 1; }
        }

        @media (max-width: 760px) {
          .geometryPreview,
          .choiceRow {
            grid-template-columns: 1fr;
          }

          .invariantRail {
            grid-template-rows: none;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 520px) {
          .invariantRail {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
