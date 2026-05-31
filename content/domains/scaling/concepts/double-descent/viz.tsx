import { useEffect, useId, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'

import dynamic from 'next/dynamic'
import { emitDemoState } from '../../../../../lib/demoState'

const DoubleDescentViz = dynamic(() => import('@/components/foundations/DoubleDescentViz'), {
  ssr: false,
})
const GrokkingViz = dynamic(() => import('@/components/foundations/GrokkingViz'), { ssr: false })

type TabId = 'double' | 'grokking'
type PredictionKey = 'underfit-bias' | 'interpolation-threshold' | 'more-data-only' | 'late-generalization'

const PREDICTIONS: Record<PredictionKey, { label: string; response: string }> = {
  'underfit-bias': {
    label: 'Underfit bias',
    response: 'The classical left side is bias-dominated, but the surprising part of this route is what happens after the model can fit the training set.',
  },
  'interpolation-threshold': {
    label: 'Interpolation threshold',
    response: 'Double descent peaks when capacity is just enough to interpolate the training set; many fits can match train data while generalizing badly.',
  },
  'more-data-only': {
    label: 'More data only',
    response: 'More data can move the threshold, but the route is about capacity or training-time regimes where error worsens before it improves.',
  },
  'late-generalization': {
    label: 'Late generalization',
    response: 'Grokking separates memorization from structure discovery: training can look solved long before validation suddenly improves.',
  },
}

export default function DoubleDescentDemo() {
  const uid = useId()
  const tabs = useMemo(
    () =>
      [
        {
          id: 'double' as const,
          label: 'Double Descent',
          note: 'See the interpolation peak and the second descent as capacity increases.',
          expected: 'interpolation-threshold' as const,
          invariant: 'Test error can spike near the interpolation threshold, then fall again as capacity keeps increasing.',
          Component: DoubleDescentViz,
        },
        {
          id: 'grokking' as const,
          label: 'Grokking',
          note: 'A related phenomenon: memorization first, then late-emerging generalization.',
          expected: 'late-generalization' as const,
          invariant: 'Training loss can collapse before validation improves; the late drop marks structure discovery.',
          Component: GrokkingViz,
        },
      ] as const,
    []
  )

  const [active, setActive] = useState<TabId>('double')
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
      conceptId: 'double-descent',
      label: 'Prediction-first scaling curve reveal',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : PREDICTIONS[prediction].label}; ${current.label} reveals ${expectedPrediction.label}.`
        : `Learner is predicting what makes the ${current.label} curve get worse before it gets better.`,
      values: [
        `active demo: ${current.label}`,
        `prediction: ${prediction === null ? 'none' : PREDICTIONS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `expected curve mechanism: ${revealed ? expectedPrediction.label : 'hidden until reveal'}`,
        `scaling invariant: ${revealed ? current.invariant : 'hidden until reveal'}`,
        `scaling lab: ${revealed ? 'mounted' : 'hidden until reveal'}`,
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
      <div className="tabs" role="tablist" aria-label="Double descent demos">
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
          <strong>What makes the {current.label} curve get worse before it gets better?</strong>
          <p>
            Predict the curve mechanism before the lab mounts. The reveal should separate the visible U-shape from
            the capacity or training-time regime that creates it.
          </p>
        </div>

        <div className={`curvePreview ${active}`} aria-hidden="true">
          <div className="curveCanvas">
            <i className="segment s1" />
            <i className="segment s2" />
            <i className="segment s3" />
            <i className="segment s4" />
            <i className="marker m1" />
            <i className="marker m2" />
            <i className="marker m3" />
            <i className="marker m4" />
            <i className="threshold" />
          </div>
          <div className="phaseRail">
            <span>bias falls</span>
            <span>threshold spike</span>
            <span>second descent</span>
            <span>late snap</span>
          </div>
        </div>

        <div className="choiceRow" role="group" aria-label={`${current.label} curve prediction`}>
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
          Reveal curve mechanism
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : `${expectedPrediction.label} is the mechanism this route emphasizes.`}</h4>
            <p>{expectedPrediction.response} Use the lab below to inspect the curve and the measured regime.</p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose a curve mechanism to unlock the lab.' : 'Reveal the mechanism to mount the lab.'}</p>
        )}
      </section>

      <div className="panel" role="tabpanel" id={panelId} aria-labelledby={tabId(active)} tabIndex={0}>
        {revealed ? (
          <Active />
        ) : (
          <div className="panelGate">
            <span>{current.label} lab</span>
            <strong>Hidden until prediction reveal</strong>
            <p>Commit to the curve mechanism first, then inspect model capacity, training time, and test error.</p>
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
          border-color: rgba(239, 68, 68, 0.6);
          color: var(--text-primary);
          transform: translateY(-1px);
        }

        .tab:focus-visible {
          outline: 2px solid rgba(148, 163, 184, 0.6);
          outline-offset: 2px;
        }

        .tab.active {
          border-color: rgba(239, 68, 68, 0.85);
          background: rgba(239, 68, 68, 0.14);
          color: rgba(254, 226, 226, 1);
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
        .phaseRail span {
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

        .curvePreview {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
          gap: 0.7rem;
          min-width: 0;
          min-height: 9rem;
          padding: 0.72rem;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 8px;
          background:
            linear-gradient(rgba(148, 163, 184, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px),
            rgba(8, 12, 20, 0.24);
          background-size: 24px 24px;
        }

        .curveCanvas {
          position: relative;
          min-width: 0;
          min-height: 7.8rem;
          overflow: hidden;
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.18), rgba(15, 23, 42, 0.48));
        }

        .segment,
        .marker,
        .threshold {
          position: absolute;
          display: block;
        }

        .segment {
          height: 0.22rem;
          border-radius: 999px;
          background: rgba(248, 113, 113, 0.86);
          transform-origin: left center;
          animation: curveTrace 3.4s ease-in-out infinite;
        }

        .s1 { left: 10%; top: 67%; width: 24%; --angle: -22deg; transform: rotate(var(--angle)); animation-delay: -0.1s; }
        .s2 { left: 31%; top: 48%; width: 22%; --angle: 36deg; transform: rotate(var(--angle)); animation-delay: -0.35s; }
        .s3 { left: 50%; top: 67%; width: 24%; --angle: -32deg; transform: rotate(var(--angle)); animation-delay: -0.6s; }
        .s4 { left: 71%; top: 43%; width: 18%; --angle: -6deg; transform: rotate(var(--angle)); animation-delay: -0.85s; }

        .marker {
          width: 0.62rem;
          height: 0.62rem;
          border-radius: 999px;
          background: rgba(254, 226, 226, 0.96);
          box-shadow: 0 0 0 0.18rem rgba(239, 68, 68, 0.18);
          animation: markerPulse 3s ease-in-out infinite;
        }

        .m1 { left: 11%; top: 63%; animation-delay: -0.1s; }
        .m2 { left: 43%; top: 32%; animation-delay: -0.45s; }
        .m3 { left: 65%; top: 56%; animation-delay: -0.8s; }
        .m4 { left: 86%; top: 38%; animation-delay: -1.15s; }

        .threshold {
          left: 45%;
          top: 16%;
          bottom: 14%;
          width: 1px;
          background: linear-gradient(rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.9), rgba(245, 158, 11, 0.08));
          animation: thresholdGlow 2.8s ease-in-out infinite;
        }

        .phaseRail {
          display: grid;
          grid-template-rows: repeat(4, minmax(0, 1fr));
          gap: 0.42rem;
          min-width: 0;
        }

        .phaseRail span {
          display: grid;
          align-items: center;
          min-height: 2rem;
          padding: 0.42rem 0.54rem;
          border-radius: 8px;
          background: rgba(15, 23, 42, 0.42);
          border: 1px solid transparent;
        }

        .curvePreview.double .phaseRail span:nth-child(2),
        .curvePreview.grokking .phaseRail span:nth-child(4) {
          border-color: rgba(248, 113, 113, 0.36);
          background: rgba(248, 113, 113, 0.12);
          color: rgba(254, 226, 226, 1);
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
          border-color: rgba(248, 113, 113, 0.58);
          background: rgba(248, 113, 113, 0.14);
        }

        .reveal {
          justify-self: start;
          background: rgba(185, 28, 28, 0.88);
          border-color: rgba(248, 113, 113, 0.58);
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
          border-color: rgba(248, 113, 113, 0.28);
          background: rgba(248, 113, 113, 0.1);
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

        @keyframes curveTrace {
          0%, 100% { opacity: 0.52; transform: scaleX(0.75) rotate(var(--angle, 0deg)); }
          50% { opacity: 1; transform: scaleX(1) rotate(var(--angle, 0deg)); }
        }

        @keyframes markerPulse {
          0%, 100% { transform: scale(0.88); opacity: 0.58; }
          50% { transform: scale(1.1); opacity: 1; }
        }

        @keyframes thresholdGlow {
          0%, 100% { opacity: 0.44; }
          50% { opacity: 1; }
        }

        @media (max-width: 760px) {
          .curvePreview,
          .choiceRow {
            grid-template-columns: 1fr;
          }

          .phaseRail {
            grid-template-rows: none;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 520px) {
          .phaseRail {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
